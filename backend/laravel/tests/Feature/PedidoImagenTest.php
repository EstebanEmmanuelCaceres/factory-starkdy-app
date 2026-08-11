<?php

namespace Tests\Feature;

use App\Models\Cliente;
use App\Models\Pedido;
use App\Models\PedidoImagen;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class PedidoImagenTest extends TestCase
{
    use RefreshDatabase;

    private $user;
    private $cliente;
    private $pedido;

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
            'nombre_cliente' => 'Juan Pérez',
            'nombre_empresa' => 'Empresa Test',
            'telefono' => '12345678',
        ]);

        $this->pedido = Pedido::create([
            'cliente_id' => $this->cliente->id,
            'user_id' => $this->user->id,
            'codigo' => 'PED-TEST-1001',
            'prioridad' => 'normal',
            'precio' => 15000.0,
        ]);

        Storage::fake('public');
    }

    public function test_can_upload_first_image_as_primary(): void
    {
        $file = UploadedFile::fake()->image('pedido-logo.jpg', 600, 600);

        $response = $this->actingAs($this->user)
            ->postJson("/api/pedidos/{$this->pedido->id}/imagenes", [
                'imagen' => $file
            ]);

        $response->assertStatus(201);
        $response->assertJsonPath('status', 'success');

        $this->assertDatabaseHas('pedido_imagenes', [
            'pedido_id' => $this->pedido->id,
            'orden' => 1,
            'es_principal' => true,
        ]);
    }

    public function test_subsequent_images_are_secondary(): void
    {
        $file1 = UploadedFile::fake()->image('portada.jpg');
        $file2 = UploadedFile::fake()->image('plano-diseno.jpg');

        $this->actingAs($this->user)
            ->postJson("/api/pedidos/{$this->pedido->id}/imagenes", ['imagen' => $file1]);

        $response2 = $this->actingAs($this->user)
            ->postJson("/api/pedidos/{$this->pedido->id}/imagenes", ['imagen' => $file2]);

        $response2->assertStatus(201);

        $this->assertDatabaseHas('pedido_imagenes', [
            'pedido_id' => $this->pedido->id,
            'orden' => 2,
            'es_principal' => false,
        ]);
    }

    public function test_can_change_primary_image(): void
    {
        $img1 = PedidoImagen::create([
            'pedido_id' => $this->pedido->id,
            'url' => 'https://example.com/img1.jpg',
            'orden' => 1,
            'es_principal' => true,
        ]);

        $img2 = PedidoImagen::create([
            'pedido_id' => $this->pedido->id,
            'url' => 'https://example.com/img2.jpg',
            'orden' => 2,
            'es_principal' => false,
        ]);

        $response = $this->actingAs($this->user)
            ->patchJson("/api/pedidos/{$this->pedido->id}/imagenes/{$img2->id}/principal");

        $response->assertStatus(200);

        $this->assertTrue((bool)$img2->fresh()->es_principal);
        $this->assertFalse((bool)$img1->fresh()->es_principal);
    }

    public function test_deleting_primary_promotes_next_image(): void
    {
        $img1 = PedidoImagen::create([
            'pedido_id' => $this->pedido->id,
            'url' => 'https://example.com/img1.jpg',
            'orden' => 1,
            'es_principal' => true,
        ]);

        $img2 = PedidoImagen::create([
            'pedido_id' => $this->pedido->id,
            'url' => 'https://example.com/img2.jpg',
            'orden' => 2,
            'es_principal' => false,
        ]);

        $response = $this->actingAs($this->user)
            ->deleteJson("/api/pedidos/{$this->pedido->id}/imagenes/{$img1->id}");

        $response->assertStatus(200);

        $this->assertDatabaseMissing('pedido_imagenes', ['id' => $img1->id]);
        $this->assertTrue((bool)$img2->fresh()->es_principal);
    }
}
