<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('etapa_materias_primas', function (Blueprint $table) {
            $table->id();
            $table->foreignId('etapa_producto_id')->constrained('etapas_productos')->cascadeOnDelete();
            $table->foreignId('materia_prima_id')->constrained('materias_primas')->cascadeOnDelete();
            $table->decimal('cantidad_consumida', 10, 2);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('etapa_materias_primas');
    }
};
