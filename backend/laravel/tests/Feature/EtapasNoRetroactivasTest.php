<?php

namespace Tests\Feature;

use App\Models\Cliente;
use App\Models\EtapaProducto;
use App\Models\Pedido;
use App\Models\Producto;
use App\Models\ResponsableEtapa;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * Agregar o quitar etapas a un producto no es retroactivo para los pedidos viejos
 * (cualquier estado que no sea pendiente, en progreso o listo para producción): conservan
 * las etapas (tareas) que tenían. Los pedidos activos sí reciben los cambios.
 */
class EtapasNoRetroactivasTest extends TestCase
{
    use RefreshDatabase;

    private User $user;
    private Cliente $cliente;
    private Producto $producto;

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

        // Etapas por defecto: diseño → produccion → finalizado
        $this->producto = Producto::create(['nombre' => 'Mate', 'precio' => 100]);
    }

    public static function estadosViejos(): array
    {
        return [['completado'], ['completado_pd'], ['enviado'], ['enviado_faltante'], ['cancelado']];
    }

    public static function estadosActivos(): array
    {
        return [['pendiente'], ['en_progreso'], ['listo_para_produccion']];
    }

    // Por defecto el pedido es "viejo" (enviado): no recibe cambios de etapas del producto
    private function crearPedido(string $codigo, array $productos, string $estado = 'enviado'): Pedido
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

    /** @return array<string, EtapaProducto> etapas del producto por nombre */
    private function etapas(): array
    {
        return EtapaProducto::where('producto_id', $this->producto->id)->with('etapa')->get()
            ->keyBy(fn($ep) => $ep->etapa->nombre)->all();
    }

    /**
     * Guarda las etapas del producto como lo hace la pantalla de productos.
     * $config: [nombre => [ids o temp_ids de los que depende]]
     */
    private function guardarEtapas(array $config): TestResponse
    {
        $actuales = $this->etapas();
        $items = [];
        $orden = 1;
        foreach ($config as $nombre => $dependeDe) {
            $items[] = [
                'id' => isset($actuales[$nombre]) ? $actuales[$nombre]->id : null,
                'temp_id' => isset($actuales[$nombre]) ? null : "temp_{$nombre}",
                'nombre' => $nombre,
                'orden' => $orden++,
                'depende_de_ids' => array_map(
                    fn($dep) => isset($actuales[$dep]) ? $actuales[$dep]->id : "temp_{$dep}",
                    $dependeDe
                ),
            ];
        }

        return $this->actingAs($this->user)
            ->postJson("/api/productos/{$this->producto->id}/etapas/sync", ['etapas' => $items])
            ->assertOk();
    }

    private function completar(Pedido $pedido, string $nombreEtapa): void
    {
        $this->actingAs($this->user)
            ->postJson("/api/operario/tasks/{$this->tareaDe($pedido, $nombreEtapa)->id}/complete")
            ->assertOk();
    }

    /** @return array<string, string> estado de cada tarea del pedido por nombre de etapa */
    private function estadosDeTareas(Pedido $pedido): array
    {
        return ResponsableEtapa::where('pedido_id', $pedido->id)
            ->with(['etapaProducto' => fn($q) => $q->withTrashed()->with('etapa')])
            ->get()
            ->mapWithKeys(fn($t) => [$t->etapaProducto->etapa->nombre => $t->estado])
            ->sortKeys()
            ->all();
    }

    private function tareaDe(Pedido $pedido, string $nombreEtapa): ResponsableEtapa
    {
        return ResponsableEtapa::where('pedido_id', $pedido->id)
            ->whereHas('etapaProducto.etapa', fn($q) => $q->where('nombre', $nombreEtapa))
            ->firstOrFail();
    }

    #[DataProvider('estadosViejos')]
    public function test_agregar_una_etapa_al_producto_no_la_agrega_a_pedidos_viejos(string $estado): void
    {
        $viejo = $this->crearPedido('PED-1', [$this->producto], $estado);
        $this->assertSame(3, $viejo->tareas()->count());

        // Nueva etapa "control" entre produccion y finalizado
        $this->guardarEtapas([
            'diseño' => [],
            'produccion' => ['diseño'],
            'control' => ['produccion'],
            'finalizado' => ['control'],
        ]);

        $this->assertSame(3, $viejo->tareas()->count());

        // Editar el pedido viejo tampoco se la agrega
        $this->actingAs($this->user)
            ->patchJson("/api/pedidos/{$viejo->id}", ['precio' => 500])
            ->assertOk();
        $this->assertSame(3, $viejo->tareas()->count());

        // Los pedidos nuevos sí la tienen
        $nuevo = $this->crearPedido('PED-2', [$this->producto]);
        $this->assertSame(4, $nuevo->tareas()->count());
    }

    public function test_una_dependencia_nueva_no_traba_a_los_pedidos_existentes(): void
    {
        $viejo = $this->crearPedido('PED-1', [$this->producto]);

        // finalizado ahora depende de "control", que el pedido viejo no tiene
        $this->guardarEtapas([
            'diseño' => [],
            'produccion' => ['diseño'],
            'control' => ['produccion'],
            'finalizado' => ['control'],
        ]);

        foreach (['diseño', 'produccion'] as $etapa) {
            $this->actingAs($this->user)
                ->postJson("/api/operario/tasks/{$this->tareaDe($viejo, $etapa)->id}/complete")
                ->assertOk();
        }

        // finalizado espera solo lo que el pedido tiene (produccion), no la etapa nueva
        $this->assertFalse($this->tareaDe($viejo, 'finalizado')->isBlockedByDependencies());
        $this->actingAs($this->user)
            ->postJson("/api/operario/tasks/{$this->tareaDe($viejo, 'finalizado')->id}/complete")
            ->assertOk();
    }

    public function test_quitar_una_etapa_del_producto_no_la_quita_de_pedidos_existentes(): void
    {
        $viejo = $this->crearPedido('PED-1', [$this->producto]);
        $this->actingAs($this->user)
            ->postJson("/api/operario/tasks/{$this->tareaDe($viejo, 'diseño')->id}/complete")
            ->assertOk();

        // Se quita "produccion" del producto
        $this->guardarEtapas([
            'diseño' => [],
            'finalizado' => ['diseño'],
        ]);

        // El pedido viejo conserva sus 3 tareas (y el avance) y la etapa quitada sigue visible
        $this->assertSame(3, $viejo->tareas()->count());
        $this->assertSame('completado', $this->tareaDe($viejo, 'diseño')->estado);

        $this->actingAs($this->user)
            ->getJson("/api/responsables-etapas?pedido_id={$viejo->id}")
            ->assertOk()
            ->assertJsonCount(3, 'data')
            ->assertJsonFragment(['nombre' => 'produccion']);

        // Los pedidos nuevos ya no la tienen
        $nuevo = $this->crearPedido('PED-2', [$this->producto]);
        $this->assertSame(2, $nuevo->tareas()->count());
    }

    #[DataProvider('estadosActivos')]
    public function test_agregar_una_etapa_al_producto_la_agrega_a_pedidos_activos(string $estado): void
    {
        $activo = $this->crearPedido('PED-1', [$this->producto], $estado);
        $viejo = $this->crearPedido('PED-2', [$this->producto], 'completado');

        $response = $this->guardarEtapas([
            'diseño' => [],
            'produccion' => ['diseño'],
            'control' => ['produccion'],
            'finalizado' => ['control'],
        ]);

        // Solo cambió el pedido activo
        $response->assertJsonPath('pedidos_actualizados', 1);
        $this->assertSame(4, $activo->tareas()->count());
        $this->assertSame(3, $viejo->tareas()->count());

        // La etapa nueva espera a produccion
        $this->assertSame('bloqueada', $this->tareaDe($activo, 'control')->estado);
        $this->assertSame($estado, $activo->fresh()->estado);
    }

    public function test_en_un_pedido_activo_la_etapa_nueva_entra_en_la_secuencia(): void
    {
        $activo = $this->crearPedido('PED-1', [$this->producto], 'en_progreso');
        $this->completar($activo, 'diseño');
        $this->completar($activo, 'produccion');

        // Se agrega "control" entre produccion (ya completada) y finalizado
        $this->guardarEtapas([
            'diseño' => [],
            'produccion' => ['diseño'],
            'control' => ['produccion'],
            'finalizado' => ['control'],
        ]);

        // control queda lista para hacer y finalizado ahora la espera
        $this->assertSame([
            'control' => 'pendiente',
            'diseño' => 'completado',
            'finalizado' => 'bloqueada',
            'produccion' => 'completado',
        ], $this->estadosDeTareas($activo));

        $this->completar($activo, 'control');
        $this->assertFalse($this->tareaDe($activo, 'finalizado')->isBlockedByDependencies());
    }

    #[DataProvider('estadosActivos')]
    public function test_quitar_una_etapa_no_empezada_la_quita_de_pedidos_activos(string $estado): void
    {
        $activo = $this->crearPedido('PED-1', [$this->producto], $estado);
        $viejo = $this->crearPedido('PED-2', [$this->producto], 'cancelado');

        $this->guardarEtapas([
            'diseño' => [],
            'finalizado' => ['diseño'],
        ]);

        $this->assertSame(['diseño' => 'pendiente', 'finalizado' => 'bloqueada'], $this->estadosDeTareas($activo));
        $this->assertSame(3, $viejo->tareas()->count());
    }

    public function test_en_un_pedido_activo_no_se_pierde_una_etapa_quitada_que_ya_se_hizo(): void
    {
        $activo = $this->crearPedido('PED-1', [$this->producto], 'en_progreso');
        $this->completar($activo, 'diseño');

        // Se quita "diseño" del producto: en este pedido ya estaba completada, se conserva
        $this->guardarEtapas([
            'produccion' => [],
            'finalizado' => ['produccion'],
        ]);

        $this->assertSame([
            'diseño' => 'completado',
            'finalizado' => 'bloqueada',
            'produccion' => 'pendiente',
        ], $this->estadosDeTareas($activo));
    }

    public function test_quitar_la_ultima_etapa_pendiente_completa_el_pedido_activo(): void
    {
        $activo = $this->crearPedido('PED-1', [$this->producto], 'en_progreso');
        $this->completar($activo, 'diseño');
        $this->completar($activo, 'produccion');

        // Solo faltaba "finalizado" y se quita del producto
        $this->guardarEtapas([
            'diseño' => [],
            'produccion' => ['diseño'],
        ]);

        $this->assertSame('completado', $activo->fresh()->estado);
    }

    public function test_agregar_o_quitar_un_producto_del_pedido_crea_o_borra_sus_tareas(): void
    {
        $viejo = $this->crearPedido('PED-1', [$this->producto]);
        $termo = Producto::create(['nombre' => 'Termo', 'precio' => 200]);

        $this->actingAs($this->user)
            ->patchJson("/api/pedidos/{$viejo->id}", [
                'productos' => [['id' => $this->producto->id, 'cantidad' => 1], ['id' => $termo->id, 'cantidad' => 1]],
            ])
            ->assertOk();
        $this->assertSame(6, $viejo->tareas()->count());

        $this->actingAs($this->user)
            ->patchJson("/api/pedidos/{$viejo->id}", [
                'productos' => [['id' => $termo->id, 'cantidad' => 1]],
            ])
            ->assertOk();
        $this->assertSame(3, $viejo->tareas()->count());
        $this->assertSame(0, $viejo->tareas()->whereHas('etapaProducto', fn($q) => $q->where('producto_id', $this->producto->id))->count());
    }
}
