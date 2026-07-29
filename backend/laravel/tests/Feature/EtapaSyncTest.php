<?php

namespace Tests\Feature;

use App\Models\Etapa;
use App\Models\EtapaProducto;
use App\Models\Producto;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class EtapaSyncTest extends TestCase
{
    use RefreshDatabase;

    private $user;
    private $producto;

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

        $this->producto = Producto::create([
            'nombre' => 'Mate Imperial',
            'precio' => 1500.0,
        ]);
    }

    public function test_sync_etapas_can_create_update_and_delete_in_bulk(): void
    {
        $corteCat = Etapa::create(['nombre' => 'Corte Inicial']);
        $eliminarCat = Etapa::create(['nombre' => 'Etapa a eliminar']);

        // 1. Create initial product stages
        $etapa1 = EtapaProducto::create([
            'producto_id' => $this->producto->id,
            'etapa_id' => $corteCat->id,
            'orden' => 1,
        ]);

        $etapa2ToDelete = EtapaProducto::create([
            'producto_id' => $this->producto->id,
            'etapa_id' => $eliminarCat->id,
            'orden' => 2,
        ]);

        $payload = [
            'etapas' => [
                [
                    'id' => $etapa1->id,
                    'temp_id' => null,
                    'nombre' => 'Corte Modificado',
                    'orden' => 1,
                    'depende_de_ids' => [],
                ],
                [
                    'id' => null,
                    'temp_id' => 'temp_1',
                    'nombre' => 'Grabado',
                    'orden' => 2,
                    'depende_de_ids' => [$etapa1->id],
                ],
                [
                    'id' => null,
                    'temp_id' => 'temp_2',
                    'nombre' => 'Pintado',
                    'orden' => 3,
                    'depende_de_ids' => ['temp_1'],
                ]
            ]
        ];

        $response = $this->actingAs($this->user)
            ->postJson("/api/productos/{$this->producto->id}/etapas/sync", $payload);

        $response->assertStatus(200);
        $response->assertJsonPath('status', 'success');

        // Verify catalog item created/updated
        $this->assertDatabaseHas('etapas', [
            'nombre' => 'Corte Modificado',
        ]);

        // Verify Etapa2ToDelete was soft deleted from etapas_productos
        $this->assertSoftDeleted('etapas_productos', [
            'id' => $etapa2ToDelete->id,
        ]);

        // Verify new product stages created
        $grabadoCat = Etapa::where('nombre', 'Grabado')->first();
        $pintadoCat = Etapa::where('nombre', 'Pintado')->first();

        $this->assertDatabaseHas('etapas_productos', [
            'producto_id' => $this->producto->id,
            'etapa_id' => $grabadoCat->id,
            'orden' => 2,
        ]);

        $this->assertDatabaseHas('etapas_productos', [
            'producto_id' => $this->producto->id,
            'etapa_id' => $pintadoCat->id,
            'orden' => 3,
        ]);

        $grabadoEP = EtapaProducto::where('etapa_id', $grabadoCat->id)->first();
        $pintadoEP = EtapaProducto::where('etapa_id', $pintadoCat->id)->first();

        // Verify dependencies
        $this->assertDatabaseHas('etapa_producto_dependencias', [
            'etapa_producto_id' => $grabadoEP->id,
            'depende_de_etapa_producto_id' => $etapa1->id,
        ]);

        $this->assertDatabaseHas('etapa_producto_dependencias', [
            'etapa_producto_id' => $pintadoEP->id,
            'depende_de_etapa_producto_id' => $grabadoEP->id,
        ]);
    }

    public function test_sync_etapas_prevents_cycles(): void
    {
        $corteCat = Etapa::create(['nombre' => 'Corte']);
        $grabadoCat = Etapa::create(['nombre' => 'Grabado']);

        $etapa1 = EtapaProducto::create([
            'producto_id' => $this->producto->id,
            'etapa_id' => $corteCat->id,
            'orden' => 1,
        ]);

        $etapa2 = EtapaProducto::create([
            'producto_id' => $this->producto->id,
            'etapa_id' => $grabadoCat->id,
            'orden' => 2,
        ]);

        $payload = [
            'etapas' => [
                [
                    'id' => $etapa1->id,
                    'nombre' => 'Corte',
                    'orden' => 1,
                    'depende_de_ids' => [$etapa2->id],
                ],
                [
                    'id' => $etapa2->id,
                    'nombre' => 'Grabado',
                    'orden' => 2,
                    'depende_de_ids' => [$etapa1->id],
                ]
            ]
        ];

        $response = $this->actingAs($this->user)
            ->postJson("/api/productos/{$this->producto->id}/etapas/sync", $payload);

        $response->assertStatus(422);
        $response->assertJsonPath('status', 'error');
        $response->assertJsonFragment([
            'message' => 'La configuración generaría un ciclo infinito en el proceso de fabricación'
        ]);
    }
}
