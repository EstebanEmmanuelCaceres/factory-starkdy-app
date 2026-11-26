<?php

namespace Tests\Feature;

use App\Models\Cliente;
use App\Models\Pedido;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CompletadosSinDatosTest extends TestCase
{
    use RefreshDatabase;

    private function usuario(string $slug): User
    {
        return User::create([
            'name' => ucfirst($slug),
            'email' => "{$slug}@example.com",
            'password' => bcrypt('password'),
            'role_id' => Role::firstOrCreate(['slug' => $slug], ['name' => ucfirst($slug)])->id,
        ]);
    }

    private function pedido(User $vendedor, Cliente $cliente, string $codigo, string $estado = 'completado'): Pedido
    {
        return Pedido::create([
            'cliente_id' => $cliente->id,
            'user_id' => $vendedor->id,
            'codigo' => $codigo,
            'prioridad' => 'normal',
            'precio' => 1000,
            'estado' => $estado,
        ]);
    }

    private function completo(): array
    {
        return [
            'nombre_cliente' => 'Ana', 'nombre_empresa' => 'Kiosco', 'telefono' => '1155', 'dni' => '30111222',
            'email' => 'ana@example.com', 'direccion' => 'Calle 1', 'provincia' => 'Salta', 'localidad' => 'Salta', 'cp' => '4400',
        ];
    }

    public function test_lista_los_completados_con_datos_de_envio_faltantes_del_vendedor(): void
    {
        $vendedor = $this->usuario('vendedor');
        $otro = User::create(['name' => 'Otro', 'email' => 'otro@example.com', 'password' => bcrypt('x'), 'role_id' => $vendedor->role_id]);

        // Falta todo salvo el teléfono; "-" y espacios cuentan como no cargado
        $incompleto = Cliente::create(['nombre_cliente' => 'Ana', 'nombre_empresa' => 'Kiosco', 'telefono' => '1155', 'dni' => '-', 'direccion' => '  ']);
        $completo = Cliente::create($this->completo());

        $this->pedido($vendedor, $incompleto, 'PD-1');
        $this->pedido($vendedor, $completo, 'PD-2');                       // datos completos: no entra
        $this->pedido($vendedor, $incompleto, 'PD-3', 'en_progreso');      // sin completar: no entra
        $this->pedido($otro, $incompleto, 'PD-4');                         // de otro vendedor: no entra

        $respuesta = $this->actingAs($vendedor)->getJson('/api/pedidos/completados-sin-datos')->assertOk();

        $this->assertSame(['PD-1'], $respuesta->json('data.*.codigo'));
        $this->assertSame(
            ['dni', 'email', 'direccion', 'provincia', 'localidad', 'cp'],
            array_column($respuesta->json('data.0.datos_faltantes'), 'clave')
        );
        $respuesta->assertJsonMissingPath('data.0.precio');
    }

    public function test_el_pedido_sale_de_la_lista_al_completar_los_datos(): void
    {
        $vendedor = $this->usuario('vendedor');
        $cliente = Cliente::create(['nombre_cliente' => 'Ana', 'nombre_empresa' => 'Kiosco', 'telefono' => '1155']);
        $this->pedido($vendedor, $cliente, 'PD-1', 'completado_pd');

        $this->actingAs($vendedor)->getJson('/api/pedidos/completados-sin-datos')->assertJsonCount(1, 'data');

        $cliente->update($this->completo());

        $this->actingAs($vendedor)->getJson('/api/pedidos/completados-sin-datos')->assertJsonCount(0, 'data');
    }

    public function test_los_demas_roles_ven_los_de_todos_los_vendedores(): void
    {
        $vendedor = $this->usuario('vendedor');
        $cliente = Cliente::create(['nombre_cliente' => 'Ana', 'nombre_empresa' => 'Kiosco', 'telefono' => '1155']);
        $this->pedido($vendedor, $cliente, 'PD-1');

        $this->actingAs($this->usuario('admin'))->getJson('/api/pedidos/completados-sin-datos')->assertJsonCount(1, 'data');
    }
}
