<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('materias_primas', function (Blueprint $table) {
            $table->id();
            $table->string('nombre');
            $table->string('sku')->nullable()->unique();
            $table->string('unidad_medida');
            $table->decimal('stock_actual', 10, 2)->default(0.00);
            $table->decimal('stock_minimo', 10, 2)->default(0.00);
            $table->decimal('costo_unitario', 10, 2)->default(0.00);
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('materias_primas');
    }
};
