<?php

namespace Tests\Feature;

use App\Models\Cliente;
use App\Models\Pedido;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PrioridadesPedidoTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::create([
            'name' => 'Admin',
            'email' => 'admin@example.com',
            'password' => bcrypt('password'),
            'role_id' => Role::create(['name' => 'Admin', 'slug' => 'admin'])->id,
        ]);
    }

    public function test_solo_se_aceptan_las_prioridades_normal_y_alta(): void
    {
        $this->assertSame(['normal', 'alta'], Pedido::PRIORIDADES);

        $admin = $this->admin();
        $cliente = Cliente::create(['nombre_cliente' => 'Ana', 'nombre_empresa' => 'Kiosco', 'telefono' => '1']);
        $pedido = Pedido::create([
            'cliente_id' => $cliente->id, 'user_id' => $admin->id, 'codigo' => 'PD-1',
            'prioridad' => 'normal', 'precio' => 100, 'estado' => 'pendiente',
        ]);

        foreach (['baja', 'critica'] as $obsoleta) {
            $this->actingAs($admin)->patchJson("/api/pedidos/{$pedido->id}", ['prioridad' => $obsoleta])
                ->assertStatus(422)
                ->assertJsonValidationErrors('prioridad');
        }

        $this->actingAs($admin)->patchJson("/api/pedidos/{$pedido->id}", ['prioridad' => 'alta'])->assertOk();
        $this->assertSame('alta', $pedido->fresh()->prioridad);
    }

    public function test_completado_pd_ya_no_es_un_estado_valido(): void
    {
        $admin = $this->admin();
        $cliente = Cliente::create(['nombre_cliente' => 'Ana', 'nombre_empresa' => 'Kiosco', 'telefono' => '1']);
        $pedido = Pedido::create([
            'cliente_id' => $cliente->id, 'user_id' => $admin->id, 'codigo' => 'PD-1',
            'prioridad' => 'normal', 'precio' => 100, 'estado' => 'pendiente',
        ]);

        $this->actingAs($admin)->patchJson('/api/pedidos/estado', ['ids' => [$pedido->id], 'estado' => 'completado_pd'])
            ->assertStatus(422);
        $this->actingAs($admin)->patchJson('/api/pedidos/estado', ['ids' => [$pedido->id], 'estado' => 'completado'])
            ->assertOk();
    }
}
