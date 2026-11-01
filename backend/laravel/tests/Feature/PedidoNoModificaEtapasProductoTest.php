<?php

namespace Tests\Feature;

use App\Models\Cliente;
use App\Models\EtapaProducto;
use App\Models\Pedido;
use App\Models\Producto;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Las etapas son configuración del producto: crear o editar un pedido nunca debe crearlas, cambiarlas ni borrarlas.
 */
class PedidoNoModificaEtapasProductoTest extends TestCase
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

    private function etapasActivas(Producto $producto): array
    {
        return EtapaProducto::where('producto_id', $producto->id)->orderBy('id')->get(['id', 'etapa_id', 'orden'])->toArray();
    }

    public function test_editar_un_pedido_con_etapas_vacias_no_borra_las_etapas_del_producto(): void
    {
        // Cada producto recibe 3 etapas por defecto
        $mate = Producto::create(['nombre' => 'Mate', 'precio' => 100]);
        $antes = $this->etapasActivas($mate);

        $pedido = Pedido::create([
            'cliente_id' => $this->cliente->id,
            'user_id' => $this->user->id,
            'codigo' => 'PED-1',
            'prioridad' => 'normal',
            'estado' => 'en_progreso',
        ]);
        $pedido->productos()->attach($mate->id, ['cantidad' => 1]);
        $pedido->generarTareas();

        // Lo que mandaba el front cuando fallaba la carga de etapas
        $this->actingAs($this->user)
            ->patchJson("/api/pedidos/{$pedido->id}", [
                'precio' => 500,
                'productos' => [['id' => $mate->id, 'cantidad' => 1]],
                'etapas' => [],
            ])
            ->assertOk();

        $this->assertCount(3, $antes);
        $this->assertSame($antes, $this->etapasActivas($mate));
        $this->assertSame(3, $pedido->tareas()->count());
    }

    public function test_crear_un_pedido_no_modifica_las_etapas_del_producto(): void
    {
        $mate = Producto::create(['nombre' => 'Mate', 'precio' => 100]);
        $antes = $this->etapasActivas($mate);

        $this->actingAs($this->user)
            ->postJson('/api/pedidos', [
                'cliente_id' => $this->cliente->id,
                'codigo' => 'PED-2',
                'prioridad' => 'normal',
                'fecha_entrega' => now()->addDays(10)->toDateString(),
                'precio' => 100,
                'productos' => [['id' => $mate->id, 'cantidad' => 1]],
                'etapas' => [['producto_id' => $mate->id, 'nombre' => 'Etapa inventada', 'orden' => 1]],
            ])
            ->assertCreated();

        $this->assertSame($antes, $this->etapasActivas($mate));
    }
}
