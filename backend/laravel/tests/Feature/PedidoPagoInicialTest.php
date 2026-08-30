<?php

namespace Tests\Feature;

use App\Models\Cliente;
use App\Models\Pedido;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PedidoPagoInicialTest extends TestCase
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
            'nombre_cliente' => 'Juan Pérez',
            'nombre_empresa' => 'Empresa Test',
            'telefono' => '123456789',
        ]);
    }

    public function test_crear_pedido_sin_pago_inicial(): void
    {
        $payload = [
            'cliente_id' => $this->cliente->id,
            'codigo' => 'PD-TEST-001',
            'prioridad' => 'normal',
            'fecha_entrega' => now()->addDays(10)->toDateString(),
            'precio' => 10000.00,
            'comentario' => 'Sin pago inicial',
        ];

        $response = $this->actingAs($this->user)
            ->postJson('/api/pedidos', $payload);

        $response->assertStatus(201);
        $response->assertJsonPath('status', 'success');

        $pedidoId = $response->json('data.id');
        $pedido = Pedido::with('pagos')->find($pedidoId);

        $this->assertNotNull($pedido);
        $this->assertCount(0, $pedido->pagos);
        $this->assertEquals(0, $pedido->monto_pagado);
        $this->assertEquals(10000.00, $pedido->saldo_pendiente);
        $this->assertEquals('sin_pago', $pedido->estado_pago);
    }

    public function test_crear_pedido_con_pago_inicial_parcial(): void
    {
        $payload = [
            'cliente_id' => $this->cliente->id,
            'codigo' => 'PD-TEST-002',
            'prioridad' => 'alta',
            'fecha_entrega' => now()->addDays(10)->toDateString(),
            'precio' => 20000.00,
            'comentario' => 'Con seña inicial',
            'monto_pago_inicial' => 5000.00,
            'medio_pago_inicial' => 'transferencia',
            'observaciones_pago_inicial' => 'Transferencia bancaria seña',
        ];

        $response = $this->actingAs($this->user)
            ->postJson('/api/pedidos', $payload);

        $response->assertStatus(201);
        $response->assertJsonPath('status', 'success');

        $pedidoId = $response->json('data.id');
        $pedido = Pedido::with('pagos')->find($pedidoId);

        $this->assertNotNull($pedido);
        $this->assertCount(1, $pedido->pagos);
        $this->assertEquals(5000.00, $pedido->monto_pagado);
        $this->assertEquals(15000.00, $pedido->saldo_pendiente);
        $this->assertEquals('parcial', $pedido->estado_pago);
        $this->assertEquals('seña', $pedido->pagos[0]->tipo_cobro);
        $this->assertEquals('transferencia', $pedido->pagos[0]->medio_pago);
    }

    public function test_crear_pedido_con_pago_inicial_total(): void
    {
        $payload = [
            'cliente_id' => $this->cliente->id,
            'codigo' => 'PD-TEST-003',
            'prioridad' => 'normal',
            'fecha_entrega' => now()->addDays(10)->toDateString(),
            'precio' => 15000.00,
            'comentario' => 'Pago total por adelantado',
            'monto_pago_inicial' => 15000.00,
            'medio_pago_inicial' => 'efectivo',
            'observaciones_pago_inicial' => 'Pago adelantado completo',
        ];

        $response = $this->actingAs($this->user)
            ->postJson('/api/pedidos', $payload);

        $response->assertStatus(201);

        $pedidoId = $response->json('data.id');
        $pedido = Pedido::with('pagos')->find($pedidoId);

        $this->assertNotNull($pedido);
        $this->assertCount(1, $pedido->pagos);
        $this->assertEquals(15000.00, $pedido->monto_pagado);
        $this->assertEquals(0.00, $pedido->saldo_pendiente);
        $this->assertEquals('pagado', $pedido->estado_pago);
        $this->assertEquals('unico', $pedido->pagos[0]->tipo_cobro);
    }

    public function test_pago_inicial_mayor_al_precio_retorna_error(): void
    {
        $payload = [
            'cliente_id' => $this->cliente->id,
            'codigo' => 'PD-TEST-004',
            'prioridad' => 'normal',
            'fecha_entrega' => now()->addDays(10)->toDateString(),
            'precio' => 10000.00,
            'monto_pago_inicial' => 15000.00,
        ];

        $response = $this->actingAs($this->user)
            ->postJson('/api/pedidos', $payload);

        $response->assertStatus(422);
        $response->assertJsonPath('status', 'error');
    }
}
