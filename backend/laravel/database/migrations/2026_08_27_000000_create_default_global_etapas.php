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
        $etapas = ['diseño', 'produccion', 'finalizado'];

        foreach ($etapas as $nombre) {
            DB::table('etapas')->updateOrInsert(
                ['nombre' => $nombre],
                [
                    'descripcion' => 'Etapa global por defecto: ' . ucfirst($nombre),
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
        // No eliminamos las etapas para evitar problemas con datos existentes en rollback
    }
};
