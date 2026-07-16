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
        Schema::create('movimientos_stock', function (Blueprint $table) {
            $table->id();
            $table->foreignId('materia_prima_id')->constrained('materias_primas')->restrictOnDelete();
            $table->string('tipo'); // entrada, salida, ajuste
            $table->decimal('cantidad', 12, 2);
            $table->foreignId('etapa_id')->nullable()->constrained('etapas')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->restrictOnDelete();
            $table->text('observaciones')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('movimientos_stock');
    }
};
