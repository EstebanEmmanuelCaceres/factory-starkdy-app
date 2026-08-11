<?php

namespace Tests\Feature;

use App\Models\Producto;
use App\Models\ProductoImagen;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ProductoImagenTest extends TestCase
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
            'nombre' => 'Termo Stanley 1L',
            'precio' => 45000.0,
        ]);

        Storage::fake('public');
    }

    public function test_can_upload_first_image_as_primary_logo(): void
    {
        $file = UploadedFile::fake()->image('termo-logo.jpg', 600, 600);

        $response = $this->actingAs($this->user)
            ->postJson("/api/productos/{$this->producto->id}/imagenes", [
                'imagen' => $file
            ]);

        $response->assertStatus(201);
        $response->assertJsonPath('status', 'success');

        $this->assertDatabaseHas('producto_imagenes', [
            'producto_id' => $this->producto->id,
            'orden' => 1,
            'es_principal' => true,
        ]);
    }

    public function test_subsequent_images_are_secondary(): void
    {
        $file1 = UploadedFile::fake()->image('logo.jpg');
        $file2 = UploadedFile::fake()->image('vista-lateral.jpg');

        $this->actingAs($this->user)
            ->postJson("/api/productos/{$this->producto->id}/imagenes", ['imagen' => $file1]);

        $response2 = $this->actingAs($this->user)
            ->postJson("/api/productos/{$this->producto->id}/imagenes", ['imagen' => $file2]);

        $response2->assertStatus(201);

        $this->assertDatabaseHas('producto_imagenes', [
            'producto_id' => $this->producto->id,
            'orden' => 2,
            'es_principal' => false,
        ]);
    }

    public function test_can_change_primary_logo(): void
    {
        $img1 = ProductoImagen::create([
            'producto_id' => $this->producto->id,
            'url' => 'https://example.com/img1.jpg',
            'orden' => 1,
            'es_principal' => true,
        ]);

        $img2 = ProductoImagen::create([
            'producto_id' => $this->producto->id,
            'url' => 'https://example.com/img2.jpg',
            'orden' => 2,
            'es_principal' => false,
        ]);

        $response = $this->actingAs($this->user)
            ->patchJson("/api/productos/{$this->producto->id}/imagenes/{$img2->id}/principal");

        $response->assertStatus(200);

        $this->assertTrue((bool)$img2->fresh()->es_principal);
        $this->assertFalse((bool)$img1->fresh()->es_principal);
    }

    public function test_deleting_primary_promotes_next_image(): void
    {
        $img1 = ProductoImagen::create([
            'producto_id' => $this->producto->id,
            'url' => 'https://example.com/img1.jpg',
            'orden' => 1,
            'es_principal' => true,
        ]);

        $img2 = ProductoImagen::create([
            'producto_id' => $this->producto->id,
            'url' => 'https://example.com/img2.jpg',
            'orden' => 2,
            'es_principal' => false,
        ]);

        $response = $this->actingAs($this->user)
            ->deleteJson("/api/productos/{$this->producto->id}/imagenes/{$img1->id}");

        $response->assertStatus(200);

        $this->assertDatabaseMissing('producto_imagenes', ['id' => $img1->id]);
        $this->assertTrue((bool)$img2->fresh()->es_principal);
    }
}
