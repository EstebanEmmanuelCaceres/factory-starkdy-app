<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('producto_materias_primas', function (Blueprint $table) {
            $table->id();
            $table->foreignId('producto_id')->constrained('productos')->cascadeOnDelete();
            $table->foreignId('materia_prima_id')->constrained('materias_primas')->restrictOnDelete();
            $table->decimal('cantidad_necesaria', 12, 2)->default(1.00);
            $table->timestamps();

            $table->unique(['producto_id', 'materia_prima_id'], 'prod_mat_unique');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('producto_materias_primas');
    }
};
