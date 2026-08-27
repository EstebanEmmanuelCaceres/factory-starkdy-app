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

class ProductoDefaultEtapasTest extends TestCase
{
    use RefreshDatabase;

    public function test_new_product_automatically_gets_three_default_etapas_and_dependencies(): void
    {
        $producto = Producto::create([
            'nombre' => 'Producto Nuevo Demo',
            'precio' => 5000.0,
        ]);

        // Verificar que las 3 etapas globales se crearon/existan en el catálogo
        $this->assertDatabaseHas('etapas', ['nombre' => 'diseño']);
        $this->assertDatabaseHas('etapas', ['nombre' => 'produccion']);
        $this->assertDatabaseHas('etapas', ['nombre' => 'finalizado']);

        // Verificar que el producto tiene 3 etapas asociadas
        $etapasProductos = EtapaProducto::where('producto_id', $producto->id)->orderBy('orden', 'asc')->get();
        $this->assertCount(3, $etapasProductos);

        $epDiseno = $etapasProductos->where('orden', 1)->first();
        $epProduccion = $etapasProductos->where('orden', 2)->first();
        $epFinalizado = $etapasProductos->where('orden', 3)->first();

        $this->assertEquals('diseño', $epDiseno->etapa->nombre);
        $this->assertEquals('produccion', $epProduccion->etapa->nombre);
        $this->assertEquals('finalizado', $epFinalizado->etapa->nombre);

        // Verificar dependencias
        $depsProduccion = $epProduccion->dependencias->pluck('id')->toArray();
        $this->assertContains($epDiseno->id, $depsProduccion);

        $depsFinalizado = $epFinalizado->dependencias->pluck('id')->toArray();
        $this->assertContains($epProduccion->id, $depsFinalizado);
    }

    public function test_pedido_tasks_follow_the_locked_unlocked_sequence(): void
    {
        $role = Role::create(['name' => 'Admin', 'slug' => 'admin']);
        $user = User::create([
            'name' => 'Admin User',
            'email' => 'admin@example.com',
            'password' => bcrypt('password'),
            'role_id' => $role->id,
        ]);
        $cliente = Cliente::create([
            'nombre_cliente' => 'Cliente Demo',
            'email' => 'cliente@example.com',
        ]);

        $producto = Producto::create([
            'nombre' => 'Silla Gamer',
            'precio' => 25000.0,
        ]);

        $pedido = Pedido::create([
            'codigo' => 'PED-TEST-100',
            'cliente_id' => $cliente->id,
            'user_id' => $user->id,
            'prioridad' => 'normal',
            'estado' => 'presupuestado',
            'monto_total' => 25000.0,
        ]);

        $pedido->productos()->attach($producto->id, ['cantidad' => 1]);
        $pedido->generarTareas();

        // Obtener tareas generadas
        $tareaDiseno = ResponsableEtapa::where('pedido_id', $pedido->id)
            ->whereHas('etapaProducto.etapa', function ($q) {
                $q->where('nombre', 'diseño');
            })->first();

        $tareaProduccion = ResponsableEtapa::where('pedido_id', $pedido->id)
            ->whereHas('etapaProducto.etapa', function ($q) {
                $q->where('nombre', 'produccion');
            })->first();

        $tareaFinalizado = ResponsableEtapa::where('pedido_id', $pedido->id)
            ->whereHas('etapaProducto.etapa', function ($q) {
                $q->where('nombre', 'finalizado');
            })->first();

        // 1. Estado inicial
        $this->assertEquals('pendiente', $tareaDiseno->estado, 'Diseño debe estar disponible (pendiente).');
        $this->assertEquals('bloqueada', $tareaProduccion->estado, 'Producción debe estar bloqueada.');
        $this->assertEquals('bloqueada', $tareaFinalizado->estado, 'Finalizado debe estar bloqueado.');

        // 2. Marcar diseño como completado
        $tareaDiseno->update(['estado' => 'completado']);
        ResponsableEtapa::logStateChange($tareaDiseno, 'pendiente', 'completado', 'Diseño completado');
        ResponsableEtapa::unblockDependentTasks($tareaDiseno);

        $tareaProduccion->refresh();
        $tareaFinalizado->refresh();

        $this->assertEquals('pendiente', $tareaProduccion->estado, 'Producción debe desbloquearse (pendiente).');
        $this->assertEquals('bloqueada', $tareaFinalizado->estado, 'Finalizado aún debe seguir bloqueado.');

        // 3. Marcar producción como completada
        $tareaProduccion->update(['estado' => 'completado']);
        ResponsableEtapa::logStateChange($tareaProduccion, 'pendiente', 'completado', 'Producción completada');
        ResponsableEtapa::unblockDependentTasks($tareaProduccion);

        $tareaFinalizado->refresh();
        $this->assertEquals('pendiente', $tareaFinalizado->estado, 'Finalizado debe desbloquearse (pendiente).');
    }
}
