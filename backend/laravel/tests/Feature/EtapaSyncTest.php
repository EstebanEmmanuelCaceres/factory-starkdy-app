<?php

namespace Tests\Feature;

use App\Models\Etapa;
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
        // 1. Create an initial stage in DB to test update/delete
        $etapa1 = Etapa::create([
            'producto_id' => $this->producto->id,
            'nombre' => 'Corte Inicial',
            'orden' => 1,
        ]);

        $etapa2ToDelete = Etapa::create([
            'producto_id' => $this->producto->id,
            'nombre' => 'Etapa a eliminar',
            'orden' => 2,
        ]);

        // 2. Prepare payload:
        // - Update stage 1: change name to "Corte Modificado"
        // - Create new stage "Grabado" (temp_1) depending on stage 1
        // - Create new stage "Pintado" (temp_2) depending on "Grabado" (temp_1)
        // - Omit $etapa2ToDelete to test deletion
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

        // Verify Corte was updated
        $this->assertDatabaseHas('etapas', [
            'id' => $etapa1->id,
            'nombre' => 'Corte Modificado',
            'orden' => 1,
        ]);

        // Verify Etapa a eliminar was soft-deleted
        $this->assertSoftDeleted('etapas', [
            'id' => $etapa2ToDelete->id,
        ]);

        // Verify new stages were created
        $this->assertDatabaseHas('etapas', [
            'producto_id' => $this->producto->id,
            'nombre' => 'Grabado',
            'orden' => 2,
        ]);

        $this->assertDatabaseHas('etapas', [
            'producto_id' => $this->producto->id,
            'nombre' => 'Pintado',
            'orden' => 3,
        ]);

        $grabado = Etapa::where('nombre', 'Grabado')->first();
        $pintado = Etapa::where('nombre', 'Pintado')->first();

        // Verify dependencies
        $this->assertDatabaseHas('etapa_dependencias', [
            'etapa_id' => $grabado->id,
            'depende_de_etapa_id' => $etapa1->id,
        ]);

        $this->assertDatabaseHas('etapa_dependencias', [
            'etapa_id' => $pintado->id,
            'depende_de_etapa_id' => $grabado->id,
        ]);
    }

    public function test_sync_etapas_prevents_cycles(): void
    {
        // Create 2 stages
        $etapa1 = Etapa::create([
            'producto_id' => $this->producto->id,
            'nombre' => 'Corte',
            'orden' => 1,
        ]);

        $etapa2 = Etapa::create([
            'producto_id' => $this->producto->id,
            'nombre' => 'Grabado',
            'orden' => 2,
        ]);

        // Try to sync establishing dependencies that form a cycle:
        // - Corte depends on Grabado
        // - Grabado depends on Corte
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
