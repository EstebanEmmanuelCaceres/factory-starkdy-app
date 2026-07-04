<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('datos_cliente', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cliente_id')->constrained('clientes')->cascadeOnDelete();
            $table->string('clave');
            $table->text('valor')->nullable();
            $table->timestamps();
            $table->unique(['cliente_id', 'clave']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('datos_cliente');
    }
};
