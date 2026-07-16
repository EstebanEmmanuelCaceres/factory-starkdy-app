<?php

namespace Tests\Feature;

use App\Models\Cliente;
use App\Models\Etapa;
use App\Models\Pedido;
use App\Models\Producto;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PedidoTaskGenerationTest extends TestCase
{
    use RefreshDatabase;

    public function test_pedido_generation_creates_tasks_and_logs_state_change_without_errors(): void
    {
        // 1. Create a role
        $role = Role::create([
            'name' => 'Admin',
            'slug' => 'admin',
        ]);

        // 2. Create a user
        $user = User::create([
            'name' => 'Test User',
            'email' => 'test@example.com',
            'password' => bcrypt('password'),
            'role_id' => $role->id,
        ]);

        // 3. Create a client
        $cliente = Cliente::create([
            'nombre_cliente' => 'John Doe',
            'nombre_empresa' => 'Doe Corp',
            'email' => 'john@example.com',
        ]);

        // 4. Create a product
        $producto = Producto::create([
            'nombre' => 'Test Product',
            'sku' => 'PROD-123',
            'cantidad' => 10,
            'precio' => 100.0,
        ]);

        // 5. Create an etapa for the product
        $etapa = Etapa::create([
            'producto_id' => $producto->id,
            'nombre' => 'Initial Stage',
            'orden' => 1,
        ]);

        // 6. Create an order (Pedido) and associate the product
        $pedido = Pedido::create([
            'cliente_id' => $cliente->id,
            'user_id' => $user->id,
            'codigo' => 'PED-999',
            'prioridad' => 'normal',
            'estado' => 'pendiente',
        ]);

        $pedido->productos()->attach($producto->id, ['cantidad' => 2]);

        // 7. Generate tasks
        $pedido->generarTareas();

        // 8. Verify task was generated
        $this->assertDatabaseHas('responsables_etapas', [
            'pedido_id' => $pedido->id,
            'etapa_id' => $etapa->id,
            'estado' => 'pendiente',
        ]);

        // 9. Verify state change log was written correctly without errors
        $this->assertDatabaseHas('etapa_historial_estado', [
            'estado_nuevo' => 'pendiente',
            'observacion' => 'Creación automática/manual de tarea',
        ]);
    }

    public function test_manual_generation_endpoint(): void
    {
        $role = Role::create(['name' => 'Admin', 'slug' => 'admin']);
        $user = User::create([
            'name' => 'Test User',
            'email' => 'test@example.com',
            'password' => bcrypt('password'),
            'role_id' => $role->id,
        ]);
        
        $cliente = Cliente::create([
            'nombre_cliente' => 'John Doe',
            'nombre_empresa' => 'Doe Corp',
            'email' => 'john@example.com',
        ]);
        
        $producto = Producto::create([
            'nombre' => 'Test Product',
            'sku' => 'PROD-123',
            'cantidad' => 10,
            'precio' => 100.0,
        ]);
        
        $etapa = Etapa::create([
            'producto_id' => $producto->id,
            'nombre' => 'Initial Stage',
            'orden' => 1,
        ]);
        
        // When creating a Pedido, no tasks should be automatically generated now
        $pedido = Pedido::create([
            'cliente_id' => $cliente->id,
            'user_id' => $user->id,
            'codigo' => 'PED-999',
            'prioridad' => 'normal',
            'estado' => 'pendiente',
        ]);
        $pedido->productos()->attach($producto->id, ['cantidad' => 2]);
        
        // Assert that the database does NOT have the tasks yet
        $this->assertDatabaseMissing('responsables_etapas', [
            'pedido_id' => $pedido->id,
        ]);
        
        // Call the manual generation endpoint
        $response = $this->actingAs($user)->postJson("/api/pedidos/{$pedido->id}/generar-tareas");
        
        $response->assertStatus(200);
        
        // Assert that the database now has the task
        $this->assertDatabaseHas('responsables_etapas', [
            'pedido_id' => $pedido->id,
            'etapa_id' => $etapa->id,
        ]);
    }
}
