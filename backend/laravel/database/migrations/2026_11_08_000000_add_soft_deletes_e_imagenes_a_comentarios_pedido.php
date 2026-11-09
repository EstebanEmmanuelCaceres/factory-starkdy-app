<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Comentarios del pedido: se pueden borrar (soft delete) y llevar imágenes.
 * Las imágenes de un comentario son imágenes del pedido (pedido_imagenes) con comentario_id,
 * así aparecen también en la galería sin duplicar nada.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('comentarios_pedido', function (Blueprint $table) {
            $table->softDeletes();
        });

        Schema::table('pedido_imagenes', function (Blueprint $table) {
            $table->foreignId('comentario_id')->nullable()->after('pedido_id')
                ->constrained('comentarios_pedido')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('pedido_imagenes', function (Blueprint $table) {
            $table->dropConstrainedForeignId('comentario_id');
        });

        Schema::table('comentarios_pedido', function (Blueprint $table) {
            $table->dropSoftDeletes();
        });
    }
};
