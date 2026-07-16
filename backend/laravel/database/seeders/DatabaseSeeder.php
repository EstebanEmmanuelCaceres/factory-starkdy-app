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
        $this->call(ProductoCatalogSeeder::class);

        // ── Crear o buscar los roles del sistema ─────────────────────────
        $roles = [
            'admin'      => Role::firstOrCreate(['slug' => 'admin'], ['name' => 'Administrador']),
            'supervisor' => Role::firstOrCreate(['slug' => 'supervisor'], ['name' => 'Supervisor']),
            'vendedor'   => Role::firstOrCreate(['slug' => 'vendedor'], ['name' => 'Vendedor']),
            'disenador'  => Role::firstOrCreate(['slug' => 'disenador'], ['name' => 'Diseñador']),
            'encargado'  => Role::firstOrCreate(['slug' => 'encargado'], ['name' => 'Encargado']),
            'operario'   => Role::firstOrCreate(['slug' => 'operario'], ['name' => 'Operario']),
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
                'name'     => 'Vendedor Demo',
                'email'    => 'vendedor@fabrica.com',
                'password' => Hash::make('password'),
                'role_id'  => $roles['vendedor']->id,
            ],
            [
                'name'     => 'Diseñador Demo',
                'email'    => 'disenador@fabrica.com',
                'password' => Hash::make('password'),
                'role_id'  => $roles['disenador']->id,
            ],
            [
                'name'     => 'Encargado Demo',
                'email'    => 'encargado@fabrica.com',
                'password' => Hash::make('password'),
                'role_id'  => $roles['encargado']->id,
            ],
            [
                'name'     => 'Operario Demo',
                'email'    => 'operario@fabrica.com',
                'password' => Hash::make('password'),
                'role_id'  => $roles['operario']->id,
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
