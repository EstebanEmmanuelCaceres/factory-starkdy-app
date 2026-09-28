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
        $categorias = [
            'Diseño',
            'Creación de archivos',
            'Sublimacion',
            'Grabado laser',
            'Impresión 3D',
            'Papelería',
            'Impresión DTF',
        ];

        foreach ($categorias as $nombre) {
            DB::table('categorias')->updateOrInsert(
                ['nombre' => $nombre],
                [
                    'descripcion' => null,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]
            );
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::table('categorias')->whereIn('nombre', [
            'Diseño',
            'Creación de archivos',
            'Sublimacion',
            'Grabado laser',
            'Impresión 3D',
            'Papelería',
            'Impresión DTF',
        ])->delete();
    }
};
