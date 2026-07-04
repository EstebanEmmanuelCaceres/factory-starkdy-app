<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Role;

class RoleSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $roles = [
            [
                'slug' => 'vendedores',
                'name' => 'Vendedores',
            ],
            [
                'slug' => 'disenadoras',
                'name' => 'Diseñadoras',
            ],
            [
                'slug' => 'encargada',
                'name' => 'Encargada',
            ],
            [
                'slug' => 'operario',
                'name' => 'Operario',
            ],
        ];

        foreach ($roles as $roleData) {
            Role::firstOrCreate(
                ['slug' => $roleData['slug']],
                ['name' => $roleData['name']]
            );
        }
    }
}
