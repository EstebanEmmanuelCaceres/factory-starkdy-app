<?php

namespace Tests\Feature;

use App\Models\Cliente;
use App\Models\Pedido;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PedidoDescripcionTest extends TestCase
{
    use RefreshDatabase;

    private $user;
    private $cliente;

    protected function setUp(): void
    {
        parent::setUp();

        $role = Role::create(['name' => 'Admin', 'slug' => 'admin']);
        $this->user = User::create([
            'name' => 'Admin Test',
            'email' => 'admin@example.com',
            'password' => bcrypt('password'),
            'role_id' => $role->id,
        ]);

        $this->cliente = Cliente::create([
            'nombre_cliente' => 'Cliente Test',
            'nombre_empresa' => 'Empresa Test',
            'telefono' => '123456789',
        ]);
    }

    public function test_crear_pedido_con_comentario_y_obtenerlo_en_index(): void
    {
        $payload = [
            'cliente_id' => $this->cliente->id,
            'codigo' => 'PD-DESC-001',
            'prioridad' => 'normal',
            'fecha_entrega' => now()->addDays(5)->toDateString(),
            'precio' => 15000.00,
            'comentario' => 'Descripción detallada del pedido 001',
        ];

        $response = $this->actingAs($this->user)->postJson('/api/pedidos', $payload);
        $response->assertStatus(201);
        $this->assertEquals('Descripción detallada del pedido 001', $response->json('data.comentario'));
        $this->assertEquals('Descripción detallada del pedido 001', $response->json('data.descripcion'));

        // Verificar que GET /api/pedidos retorna comentario y descripcion sin ocultarlo
        $indexResponse = $this->actingAs($this->user)->getJson('/api/pedidos');
        $indexResponse->assertStatus(200);
        $primerPedido = $indexResponse->json('data.0');
        $this->assertEquals('Descripción detallada del pedido 001', $primerPedido['comentario']);
        $this->assertEquals('Descripción detallada del pedido 001', $primerPedido['descripcion']);
    }

    public function test_crear_pedido_con_descripcion_alias(): void
    {
        $payload = [
            'cliente_id' => $this->cliente->id,
            'codigo' => 'PD-DESC-002',
            'prioridad' => 'alta',
            'fecha_entrega' => now()->addDays(3)->toDateString(),
            'precio' => 20000.00,
            'descripcion' => 'Descripción enviada mediante campo descripcion',
        ];

        $response = $this->actingAs($this->user)->postJson('/api/pedidos', $payload);
        $response->assertStatus(201);
        $this->assertEquals('Descripción enviada mediante campo descripcion', $response->json('data.comentario'));
        $this->assertEquals('Descripción enviada mediante campo descripcion', $response->json('data.descripcion'));
    }

    public function test_editar_pedido_actualiza_descripcion(): void
    {
        $pedido = Pedido::create([
            'cliente_id' => $this->cliente->id,
            'user_id' => $this->user->id,
            'codigo' => 'PD-DESC-003',
            'prioridad' => 'normal',
            'fecha_entrega' => now()->addDays(7)->toDateString(),
            'precio' => 5000.00,
            'comentario' => 'Original',
        ]);

        $updateResponse = $this->actingAs($this->user)->patchJson("/api/pedidos/{$pedido->id}", [
            'descripcion' => 'Descripción editada desde modal',
        ]);

        $updateResponse->assertStatus(200);
        $this->assertEquals('Descripción editada desde modal', $updateResponse->json('data.comentario'));
        $this->assertEquals('Descripción editada desde modal', $updateResponse->json('data.descripcion'));

        $this->assertDatabaseHas('pedidos', [
            'id' => $pedido->id,
            'comentario' => 'Descripción editada desde modal',
        ]);
    }
}
