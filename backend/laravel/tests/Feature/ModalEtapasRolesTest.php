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

class ModalEtapasRolesTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $vendedor;
    private User $operario;
    private Pedido $pedido;
    private Producto $producto;

    protected function setUp(): void
    {
        parent::setUp();

        $roleAdmin = Role::create(['name' => 'Admin', 'slug' => 'admin']);
        $roleVendedor = Role::create(['name' => 'Vendedor', 'slug' => 'vendedor']);
        $roleOperario = Role::create(['name' => 'Operario', 'slug' => 'operario']);

        $this->admin = User::create([
            'name' => 'Admin User',
            'email' => 'admin@test.com',
            'password' => bcrypt('password'),
            'role_id' => $roleAdmin->id,
        ]);

        $this->vendedor = User::create([
            'name' => 'Vendedor User',
            'email' => 'vendedor@test.com',
            'password' => bcrypt('password'),
            'role_id' => $roleVendedor->id,
        ]);

        $this->operario = User::create([
            'name' => 'Operario User',
            'email' => 'operario@test.com',
            'password' => bcrypt('password'),
            'role_id' => $roleOperario->id,
        ]);

        $cliente = Cliente::create([
            'nombre_cliente' => 'Cliente Test',
            'nombre_empresa' => 'Empresa Test',
        ]);

        $this->producto = Producto::create(['nombre' => 'Producto 1', 'precio' => 1000]);

        $this->pedido = Pedido::create([
            'codigo' => 'PED-TEST-1',
            'prioridad' => 'normal',
            'cliente_id' => $cliente->id,
            'user_id' => $this->vendedor->id,
            'estado' => 'listo_para_produccion',
            'precio' => 1000,
            'fecha_entrega' => now()->addDays(5)->toDateString(),
        ]);

        $this->pedido->productos()->attach($this->producto->id, ['cantidad' => 1]);
        $this->pedido->generarTareas();
    }

    public function test_vendedor_puede_ver_las_etapas_de_su_pedido(): void
    {
        $response = $this->actingAs($this->vendedor)
            ->getJson("/api/responsables-etapas?pedido_id={$this->pedido->id}");

        $response->assertOk();
        $this->assertNotEmpty($response->json('data'), 'El vendedor debe ver las etapas del pedido.');
    }

    public function test_operario_puede_ver_las_etapas_del_pedido(): void
    {
        $response = $this->actingAs($this->operario)
            ->getJson("/api/responsables-etapas?pedido_id={$this->pedido->id}");

        $response->assertOk();
        $this->assertNotEmpty($response->json('data'), 'El operario debe ver las etapas del pedido.');
    }

    public function test_solo_admin_o_encargado_puede_completar_todas_las_etapas(): void
    {
        // Vendedor intenta completar todas
        $this->actingAs($this->vendedor)
            ->postJson("/api/pedidos/{$this->pedido->id}/productos/{$this->producto->id}/completar-etapas")
            ->assertStatus(403);

        // Operario intenta completar todas
        $this->actingAs($this->operario)
            ->postJson("/api/pedidos/{$this->pedido->id}/productos/{$this->producto->id}/completar-etapas")
            ->assertStatus(403);

        // Admin sí puede completar todas
        $this->actingAs($this->admin)
            ->postJson("/api/pedidos/{$this->pedido->id}/productos/{$this->producto->id}/completar-etapas")
            ->assertOk();
    }
}
