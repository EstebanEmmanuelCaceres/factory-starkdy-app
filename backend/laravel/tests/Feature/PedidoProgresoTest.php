<?php

namespace Tests\Feature;

use App\Models\Cliente;
use App\Models\Etapa;
use App\Models\EtapaProducto;
use App\Models\Pedido;
use App\Models\Producto;
use App\Models\ResponsableEtapa;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PedidoProgresoTest extends TestCase
{
    use RefreshDatabase;

    private User $user;
    private Cliente $cliente;

    protected function setUp(): void
    {
        parent::setUp();

        $role = Role::create(['name' => 'Admin', 'slug' => 'admin']);
        $this->user = User::create([
            'name' => 'Admin User',
            'email' => 'admin@example.com',
            'password' => bcrypt('password'),
            'role_id' => $role->id,
        ]);
        $this->cliente = Cliente::create([
            'nombre_cliente' => 'John Doe',
            'nombre_empresa' => 'Doe Corp',
            'email' => 'john@example.com',
        ]);
    }

    private function crearPedido(string $codigo, string $estado, array $productos): Pedido
    {
        $pedido = Pedido::create([
            'cliente_id' => $this->cliente->id,
            'user_id' => $this->user->id,
            'codigo' => $codigo,
            'prioridad' => 'normal',
            'estado' => $estado,
        ]);
        foreach ($productos as $producto) {
            $pedido->productos()->attach($producto->id, ['cantidad' => 1]);
        }
        $pedido->generarTareas();

        return $pedido;
    }

    private function completarEtapas(Pedido $pedido, Producto $producto, int $cantidad): void
    {
        $etapaIds = $producto->etapasProductos()->pluck('id')->take($cantidad);

        ResponsableEtapa::where('pedido_id', $pedido->id)
            ->whereIn('etapa_producto_id', $etapaIds)
            ->update(['estado' => ResponsableEtapa::ESTADO_COMPLETADO]);
    }

    public function test_calcula_porcentaje_por_producto_y_promedio_del_pedido(): void
    {
        // Cada producto recibe 3 etapas por defecto (diseño, producción, finalizado)
        $mate = Producto::create(['nombre' => 'Mate', 'precio' => 100]);
        $termo = Producto::create(['nombre' => 'Termo', 'precio' => 200]);

        $pedido = $this->crearPedido('PED-1', 'en_progreso', [$mate, $termo]);
        $this->completarEtapas($pedido, $mate, 1);
        $this->completarEtapas($pedido, $termo, 3);

        // Pedido de otro estado: no aparece en el listado
        $this->crearPedido('PED-2', 'pendiente', [$mate]);

        $response = $this->actingAs($this->user)->getJson('/api/pedidos/progreso');

        $response->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.codigo', 'PED-1')
            ->assertJsonPath('data.0.productos.0.etapas_totales', 3)
            ->assertJsonPath('data.0.productos.0.etapas_completadas', 1)
            ->assertJsonPath('data.0.productos.0.porcentaje', 33.33)
            ->assertJsonPath('data.0.productos.1.porcentaje', 100)
            ->assertJsonPath('data.0.porcentaje', 66.67);
    }

    public function test_el_listado_de_pedidos_incluye_el_progreso(): void
    {
        $mate = Producto::create(['nombre' => 'Mate', 'precio' => 100]);
        $pedido = $this->crearPedido('PED-4', 'en_progreso', [$mate]);
        $this->completarEtapas($pedido, $mate, 1);

        $this->actingAs($this->user)
            ->getJson('/api/pedidos')
            ->assertOk()
            ->assertJsonPath('data.0.progreso.porcentaje', 33.33)
            ->assertJsonPath('data.0.progreso.productos.0.etapas_completadas', 1);
    }

    public function test_el_detalle_del_pedido_incluye_el_progreso(): void
    {
        $mate = Producto::create(['nombre' => 'Mate', 'precio' => 100]);
        $pedido = $this->crearPedido('PED-5', 'en_progreso', [$mate]);
        $this->completarEtapas($pedido, $mate, 3);

        $this->actingAs($this->user)
            ->getJson("/api/pedidos/{$pedido->id}")
            ->assertOk()
            ->assertJsonPath('data.progreso.porcentaje', 100);
    }

    public function test_agregar_una_etapa_al_producto_no_cambia_el_progreso_de_pedidos_viejos(): void
    {
        $mate = Producto::create(['nombre' => 'Mate', 'precio' => 100]);
        $pedido = $this->crearPedido('PED-10', 'completado', [$mate]);
        $this->completarEtapas($pedido, $mate, 3);

        // Al producto se le agrega una etapa después de crear el pedido
        EtapaProducto::create([
            'producto_id' => $mate->id,
            'etapa_id' => Etapa::create(['nombre' => 'control'])->id,
            'orden' => 4,
        ]);

        // El pedido sigue con sus 3 etapas y completo
        $this->actingAs($this->user)
            ->getJson("/api/pedidos/{$pedido->id}/progreso")
            ->assertOk()
            ->assertJsonPath('data.productos.0.etapas_totales', 3)
            ->assertJsonPath('data.porcentaje', 100);

        // Un pedido nuevo con el mismo producto tiene las 4
        $nuevo = $this->crearPedido('PED-11', 'en_progreso', [$mate]);
        $this->actingAs($this->user)
            ->getJson("/api/pedidos/{$nuevo->id}/progreso")
            ->assertOk()
            ->assertJsonPath('data.productos.0.etapas_totales', 4);
    }

    public function test_muestra_el_progreso_de_un_pedido_puntual(): void
    {
        $mate = Producto::create(['nombre' => 'Mate', 'precio' => 100]);
        $pedido = $this->crearPedido('PED-3', 'en_progreso', [$mate]);
        $this->completarEtapas($pedido, $mate, 2);

        $this->actingAs($this->user)
            ->getJson("/api/pedidos/{$pedido->id}/progreso")
            ->assertOk()
            ->assertJsonPath('data.pedido_id', $pedido->id)
            ->assertJsonPath('data.porcentaje', 66.67);
    }

    public function test_completa_todas_las_etapas_de_un_producto_en_un_solo_pedido(): void
    {
        $mate = Producto::create(['nombre' => 'Mate', 'precio' => 100]);
        $termo = Producto::create(['nombre' => 'Termo', 'precio' => 200]);
        $pedido = $this->crearPedido('PED-6', 'en_progreso', [$mate, $termo]);
        $this->completarEtapas($pedido, $mate, 1);

        $this->actingAs($this->user)
            ->postJson("/api/pedidos/{$pedido->id}/productos/{$mate->id}/completar-etapas")
            ->assertOk()
            ->assertJsonPath('data.completadas', 2)
            ->assertJsonPath('data.progreso.productos.0.porcentaje', 100)
            ->assertJsonPath('data.progreso.productos.1.porcentaje', 0)
            ->assertJsonPath('data.progreso.porcentaje', 50);

        // Las etapas del otro producto no se tocan
        $this->assertSame(0, ResponsableEtapa::where('pedido_id', $pedido->id)
            ->whereIn('etapa_producto_id', $termo->etapasProductos()->pluck('id'))
            ->completadas()
            ->count());
    }

    public function test_completar_todos_los_productos_completa_el_pedido(): void
    {
        $mate = Producto::create(['nombre' => 'Mate', 'precio' => 100]);
        $pedido = $this->crearPedido('PED-7', 'en_progreso', [$mate]);

        $this->actingAs($this->user)
            ->postJson("/api/pedidos/{$pedido->id}/productos/{$mate->id}/completar-etapas")
            ->assertOk()
            ->assertJsonPath('data.estado', 'completado')
            ->assertJsonPath('data.progreso.porcentaje', 100);
    }

    public function test_no_completa_etapas_de_un_pedido_pendiente_ni_de_un_producto_ajeno(): void
    {
        $mate = Producto::create(['nombre' => 'Mate', 'precio' => 100]);
        $termo = Producto::create(['nombre' => 'Termo', 'precio' => 200]);
        $pendiente = $this->crearPedido('PED-8', 'pendiente', [$mate]);
        $enProgreso = $this->crearPedido('PED-9', 'en_progreso', [$mate]);

        $this->actingAs($this->user)
            ->postJson("/api/pedidos/{$pendiente->id}/productos/{$mate->id}/completar-etapas")
            ->assertStatus(422);

        $this->actingAs($this->user)
            ->postJson("/api/pedidos/{$enProgreso->id}/productos/{$termo->id}/completar-etapas")
            ->assertNotFound();
    }
}
