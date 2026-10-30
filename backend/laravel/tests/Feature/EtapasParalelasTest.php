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
use App\Services\PedidoWorkflowService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * El bloqueo de etapas sigue solo etapa_producto_dependencias:
 *
 *        ┌─→ B ─┐
 *   A ───┤      ├──→ D      (B y C dependen de A; D depende de B y C)
 *        └─→ C ─┘
 */
class EtapasParalelasTest extends TestCase
{
    use RefreshDatabase;

    private User $user;
    private Pedido $pedido;
    /** @var array<string, EtapaProducto> */
    private array $etapas = [];

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
        $cliente = Cliente::create([
            'nombre_cliente' => 'John Doe',
            'nombre_empresa' => 'Doe Corp',
            'email' => 'john@example.com',
        ]);

        // Reemplazar las etapas por defecto por el flujo A → (B, C) → D
        $producto = Producto::create(['nombre' => 'Carpeta', 'precio' => 100]);
        EtapaProducto::where('producto_id', $producto->id)->forceDelete();

        foreach (['A' => 1, 'B' => 2, 'C' => 3, 'D' => 4] as $nombre => $orden) {
            $this->etapas[$nombre] = EtapaProducto::create([
                'producto_id' => $producto->id,
                'etapa_id' => Etapa::create(['nombre' => "Etapa {$nombre}"])->id,
                'orden' => $orden, // orden "aplanado" como lo dejaba el sistema anterior
            ]);
        }
        $this->etapas['B']->dependencias()->attach($this->etapas['A']->id);
        $this->etapas['C']->dependencias()->attach($this->etapas['A']->id);
        $this->etapas['D']->dependencias()->attach([$this->etapas['B']->id, $this->etapas['C']->id]);

        $this->pedido = Pedido::create([
            'cliente_id' => $cliente->id,
            'user_id' => $this->user->id,
            'codigo' => 'PED-1',
            'prioridad' => 'normal',
            'estado' => 'en_progreso',
        ]);
        $this->pedido->productos()->attach($producto->id, ['cantidad' => 1]);
        $this->pedido->generarTareas();
    }

    private function tarea(string $nombre): ResponsableEtapa
    {
        return ResponsableEtapa::where('pedido_id', $this->pedido->id)
            ->where('etapa_producto_id', $this->etapas[$nombre]->id)
            ->firstOrFail();
    }

    private function completar(string $nombre): void
    {
        $this->actingAs($this->user)
            ->postJson("/api/operario/tasks/{$this->tarea($nombre)->id}/complete")
            ->assertOk();
    }

    public function test_al_completar_la_etapa_inicial_se_habilitan_las_dos_paralelas(): void
    {
        $this->assertFalse($this->tarea('A')->isBlockedByDependencies());
        $this->assertTrue($this->tarea('B')->isBlockedByDependencies());
        $this->assertTrue($this->tarea('C')->isBlockedByDependencies());

        $this->completar('A');

        // Aunque C tenga un orden mayor que B, no depende de B: se habilitan juntas
        $this->assertSame('pendiente', $this->tarea('B')->estado);
        $this->assertSame('pendiente', $this->tarea('C')->estado);
        $this->assertSame('bloqueada', $this->tarea('D')->estado);

        $this->completar('C');
        $this->completar('B');
    }

    public function test_la_etapa_que_depende_de_dos_paralelas_espera_a_ambas(): void
    {
        $this->completar('A');
        $this->completar('B');

        $this->assertTrue($this->tarea('D')->isBlockedByDependencies());
        $this->actingAs($this->user)
            ->postJson("/api/operario/tasks/{$this->tarea('D')->id}/start")
            ->assertStatus(422);
        $this->actingAs($this->user)
            ->postJson("/api/operario/tasks/{$this->tarea('D')->id}/complete")
            ->assertStatus(422);

        $this->completar('C');

        $this->assertSame('pendiente', $this->tarea('D')->estado);
        $this->completar('D');
    }

    public function test_un_estado_bloqueada_desactualizado_no_impide_completar(): void
    {
        $this->completar('A');

        // Simula una tarea que quedó 'bloqueada' con la regla anterior aunque su dependencia ya está completa
        $this->tarea('C')->update(['estado' => 'bloqueada']);

        $this->completar('C');
        $this->assertSame('completado', $this->tarea('C')->estado);
    }

    public function test_el_orden_se_calcula_por_niveles_y_las_paralelas_comparten_orden(): void
    {
        EtapaProducto::reordenarTopologicamentePorProducto($this->etapas['A']->producto_id);

        $orden = fn(string $nombre) => $this->etapas[$nombre]->fresh()->orden;
        $this->assertSame(1, $orden('A'));
        $this->assertSame(2, $orden('B'));
        $this->assertSame(2, $orden('C'));
        $this->assertSame(3, $orden('D'));
    }

    public function test_consultar_las_etapas_de_un_producto_no_modifica_su_orden(): void
    {
        $this->actingAs($this->user)
            ->getJson("/api/productos/{$this->etapas['A']->producto_id}/etapas")
            ->assertOk();

        // El GET ya no reescribe el orden (sigue el 1, 2, 3, 4 de origen)
        $this->assertSame(3, $this->etapas['C']->fresh()->orden);
        $this->assertSame(4, $this->etapas['D']->fresh()->orden);
    }
}
