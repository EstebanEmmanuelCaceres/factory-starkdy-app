<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('etapa_producto_dependencias', function (Blueprint $table) {
            $table->id();
            $table->foreignId('etapa_producto_id')->constrained('etapas_productos')->cascadeOnDelete();
            $table->foreignId('depende_de_etapa_producto_id')->constrained('etapas_productos')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['etapa_producto_id', 'depende_de_etapa_producto_id'], 'uq_etapa_prod_dep');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('etapa_producto_dependencias');
    }
};
