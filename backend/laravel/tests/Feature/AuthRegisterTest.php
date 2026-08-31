<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthRegisterTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_register_successfully()
    {
        $response = $this->postJson('/api/auth/register', [
            'name'                  => 'Juan Perez',
            'email'                 => 'juan@example.com',
            'password'              => 'password123',
        ]);

        $response->assertStatus(201)
                 ->assertJsonStructure([
                     'message',
                     'user' => ['id', 'name', 'email'],
                     'token',
                 ]);

        $this->assertDatabaseHas('users', [
            'email' => 'juan@example.com',
            'name'  => 'Juan Perez',
        ]);

        $this->assertDatabaseHas('roles', [
            'slug' => 'operario',
            'name' => 'Operario',
        ]);
    }
}
