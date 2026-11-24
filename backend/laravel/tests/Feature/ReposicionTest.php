<?php

namespace Tests\Feature;

use App\Models\Cliente;
use App\Models\Pedido;
use App\Models\Producto;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ReposicionTest extends TestCase
{
    use RefreshDatabase;

    private User $encargado;
    private User $vendedor;
    private Pedido $venta;

    protected function setUp(): void
    {
        parent::setUp();

        $crearUsuario = fn(string $slug) => User::create([
            'name' => ucfirst($slug),
            'email' => "{$slug}@example.com",
            'password' => bcrypt('password'),
            'role_id' => Role::create(['name' => ucfirst($slug), 'slug' => $slug])->id,
        ]);
        $this->encargado = $crearUsuario('encargado');
        $this->vendedor = $crearUsuario('vendedor');

        $cliente = Cliente::create(['nombre_cliente' => 'Ana', 'nombre_empresa' => 'Kiosco', 'telefono' => '1']);
        $this->venta = Pedido::create([
            'cliente_id' => $cliente->id,
            'user_id' => $this->vendedor->id,
            'codigo' => 'PD-473612',
            'prioridad' => 'normal',
            'precio' => 5000,
            'estado' => 'enviado',
        ]);

        $llavero = Producto::create([
            'nombre' => 'Llavero',
            'precio' => 10,
            'atributos' => [['clave' => 'tamano', 'etiqueta' => 'Tamaño', 'tipo' => 'opciones', 'opciones' => [['valor' => 'Chico', 'recargo' => 0]]]],
        ]);
        $taza = Producto::create(['nombre' => 'Taza', 'precio' => 20]);
        $this->venta->productos()->attach($llavero->id, ['cantidad' => 50, 'atributos' => ['tamano' => 'Chico']]);
        $this->venta->productos()->attach($taza->id, ['cantidad' => 10, 'atributos' => []]);
    }

    private function lineaDe(Pedido $pedido, string $producto): int
    {
        return $pedido->lineas()->whereHas('producto', fn($q) => $q->where('nombre', $producto))->value('id');
    }

    private function reponer(Pedido $pedido, array $lineas, ?User $usuario = null)
    {
        return $this->actingAs($usuario ?? $this->encargado)->postJson("/api/pedidos/{$pedido->id}/reposicion", [
            'motivo' => 'danado_envio',
            'detalle' => 'Llegaron rotos',
            'lineas' => $lineas,
        ]);
    }

    public function test_crea_la_reposicion_solo_con_las_lineas_elegidas(): void
    {
        $respuesta = $this->reponer($this->venta, [['linea_id' => $this->lineaDe($this->venta, 'Llavero'), 'cantidad' => 20]])
            ->assertCreated()
            ->assertJsonPath('data.codigo', 'DV-473612-1')
            ->assertJsonPath('data.tipo', Pedido::TIPO_REPOSICION)
            ->assertJsonPath('data.pedido_origen.codigo', 'PD-473612')
            ->assertJsonPath('data.motivo', ['clave' => 'danado_envio', 'etiqueta' => 'Dañado en el envío'])
            ->assertJsonPath('data.cliente.nombre_empresa', 'Kiosco')
            ->assertJsonPath('data.vendedor.id', $this->vendedor->id)
            ->assertJsonPath('data.unidades', 20)
            ->assertJsonCount(1, 'data.lineas')
            ->assertJsonPath('data.lineas.0.producto', 'Llavero')
            ->assertJsonPath('data.lineas.0.cantidad', 20)
            ->assertJsonPath('data.lineas.0.atributos', [['clave' => 'tamano', 'etiqueta' => 'Tamaño', 'valor' => 'Chico']])
            // Solo lo que define el Resource: nada de montos ni del resto del pedido
            ->assertJsonMissingPath('data.precio')
            ->assertJsonMissingPath('data.monto_pagado');

        $reposicion = Pedido::find($respuesta->json('data.id'));
        $this->assertSame('pendiente', $reposicion->estado);
        $this->assertEquals(0, $reposicion->precio);
        $this->assertSame($this->venta->cliente_id, $reposicion->cliente_id);
        $this->assertSame($this->vendedor->id, $reposicion->user_id);

        $linea = $reposicion->lineas()->first();
        $this->assertSame(20, (int) $linea->cantidad);
        $this->assertSame(['tamano' => 'Chico'], (array) $linea->atributos);

        // Queda registrado en la venta original
        $this->assertDatabaseHas('comentarios_pedido', [
            'pedido_id' => $this->venta->id,
            'user_id' => $this->encargado->id,
            'cuerpo' => 'Se creó la reposición DV-473612-1. Motivo: Dañado en el envío.',
        ]);
    }

    public function test_una_reposicion_de_una_reposicion_apunta_a_la_venta_original(): void
    {
        $primera = Pedido::find($this->reponer($this->venta, [['linea_id' => $this->lineaDe($this->venta, 'Taza'), 'cantidad' => 10]])->json('data.id'));

        $this->reponer($primera, [['linea_id' => $this->lineaDe($primera, 'Taza'), 'cantidad' => 5]])
            ->assertCreated()
            ->assertJsonPath('data.codigo', 'DV-473612-2')
            ->assertJsonPath('data.pedido_origen.id', $this->venta->id);
    }

    public function test_rechaza_lineas_ajenas_o_cantidades_mayores_a_las_del_pedido(): void
    {
        $this->reponer($this->venta, [['linea_id' => 999999, 'cantidad' => 1]])->assertStatus(422);
        $this->reponer($this->venta, [['linea_id' => $this->lineaDe($this->venta, 'Taza'), 'cantidad' => 11]])->assertStatus(422);
        $this->reponer($this->venta, [])->assertStatus(422);

        $this->assertSame(0, Pedido::deReposicion()->count());
    }

    public function test_solo_admin_o_encargado_pueden_crear_reposiciones(): void
    {
        $this->reponer($this->venta, [['linea_id' => $this->lineaDe($this->venta, 'Taza'), 'cantidad' => 1]], $this->vendedor)
            ->assertForbidden();
    }

    public function test_una_reposicion_no_cambia_de_precio_ni_recibe_pagos(): void
    {
        $id = $this->reponer($this->venta, [['linea_id' => $this->lineaDe($this->venta, 'Taza'), 'cantidad' => 1]])->json('data.id');

        $this->actingAs($this->encargado)->patchJson("/api/pedidos/{$id}", ['precio' => 1000])->assertStatus(422);
        $this->actingAs($this->encargado)->patchJson("/api/pedidos/{$id}", ['precio' => 0, 'prioridad' => 'alta'])->assertOk();

        $this->actingAs($this->encargado)->postJson("/api/pedidos/{$id}/pagos", [
            'monto' => 100, 'medio_pago' => 'efectivo', 'tipo_cobro' => 'unico',
        ])->assertStatus(422);
    }

    public function test_el_listado_filtra_por_tipo(): void
    {
        $this->reponer($this->venta, [['linea_id' => $this->lineaDe($this->venta, 'Taza'), 'cantidad' => 1]]);

        $codigos = $this->actingAs($this->encargado)->getJson('/api/pedidos?tipo=reposicion&estado=todos')
            ->assertOk()->json('data.*.codigo');

        $this->assertSame(['DV-473612-1'], $codigos);
    }
}
