<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // ── Llamar a RoleSeeder para los nuevos roles ────────────────────
        $this->call(RoleSeeder::class);

        // ── Crear o buscar los roles del sistema ─────────────────────────
        $roles = [
            'admin'      => Role::firstOrCreate(['slug' => 'admin'], ['name' => 'Administrador']),
            'supervisor' => Role::firstOrCreate(['slug' => 'supervisor'], ['name' => 'Supervisor']),
            'operator'   => Role::firstOrCreate(['slug' => 'operator'], ['name' => 'Operador']),
            'user'       => Role::firstOrCreate(['slug' => 'user'], ['name' => 'Usuario']),
        ];

        $this->command->info('✅ Roles creados.');

        // ── Usuarios de demostración ─────────────────────────────────────
        $users = [
            [
                'name'     => 'Administrador',
                'email'    => 'admin@fabrica.com',
                'password' => Hash::make('password'),
                'role_id'  => $roles['admin']->id,
            ],
            [
                'name'     => 'Supervisor Principal',
                'email'    => 'supervisor@fabrica.com',
                'password' => Hash::make('password'),
                'role_id'  => $roles['supervisor']->id,
            ],
            [
                'name'     => 'Operador 1',
                'email'    => 'operador@fabrica.com',
                'password' => Hash::make('password'),
                'role_id'  => $roles['operator']->id,
            ],
        ];

        foreach ($users as $data) {
            User::firstOrCreate(
                ['email' => $data['email']],
                $data
            );
        }

        $this->command->info('✅ Usuarios de demostración creados.');
    }
}
