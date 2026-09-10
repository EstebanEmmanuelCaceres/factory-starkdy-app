<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $roles = [
            ['slug' => 'disenador', 'name' => 'Diseñadora / Diseñador'],
            ['slug' => 'disenadora', 'name' => 'Diseñadora'],
        ];

        try {
            DB::statement("SELECT setval('migrations_id_seq', (SELECT MAX(id) FROM migrations))");
            DB::statement("SELECT setval('roles_id_seq', (SELECT MAX(id) FROM roles))");
        } catch (\Throwable $e) {}

        foreach ($roles as $r) {
            $existing = DB::table('roles')->where('slug', $r['slug'])->first();
            if ($existing) {
                DB::table('roles')->where('id', $existing->id)->update([
                    'name' => $r['name'],
                    'updated_at' => now(),
                ]);
            } else {
                DB::table('roles')->insert([
                    'slug' => $r['slug'],
                    'name' => $r['name'],
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
    }
};
