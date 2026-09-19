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
                'slug' => 'vendedor',
                'name' => 'Vendedor',
            ],
            [
                'slug' => 'disenador',
                'name' => 'Diseñador/a',
            ],
            [
                'slug' => 'disenadora',
                'name' => 'Diseñadora',
            ],
            [
                'slug' => 'encargado',
                'name' => 'Encargado',
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
