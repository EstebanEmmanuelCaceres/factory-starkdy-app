<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('clientes', function (Blueprint $table) {
            $table->id();
            $table->string('nombre_cliente')->default('');
            $table->string('nombre_empresa')->default('');
            $table->string('telefono')->default('');
            $table->string('email')->nullable();
            $table->string('dni', 50)->nullable();
            $table->string('direccion', 255)->nullable();
            $table->string('provincia', 100)->nullable();
            $table->string('cp', 20)->nullable();
            $table->string('localidad', 100)->nullable();
            $table->decimal('ingreso', 10, 2)->default(0.00);
            $table->decimal('valor_total', 10, 2)->default(0.00);
            $table->decimal('saldo', 10, 2)->default(0.00);
            $table->text('observaciones')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('clientes');
    }
};
