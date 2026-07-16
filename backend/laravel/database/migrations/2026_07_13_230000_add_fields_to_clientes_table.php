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
        Schema::table('clientes', function (Blueprint $table) {
            $table->string('dni', 50)->nullable()->after('telefono');
            $table->string('direccion', 255)->nullable()->after('dni');
            $table->string('provincia', 100)->nullable()->after('direccion');
            $table->string('cp', 20)->nullable()->after('provincia');
            $table->string('localidad', 100)->nullable()->after('cp');
            $table->decimal('ingreso', 10, 2)->default(0.00)->after('localidad');
            $table->decimal('valor_total', 10, 2)->default(0.00)->after('ingreso');
            $table->decimal('saldo', 10, 2)->default(0.00)->after('valor_total');
            $table->text('observaciones')->nullable()->after('saldo');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('clientes', function (Blueprint $table) {
            $table->dropColumn([
                'dni',
                'direccion',
                'provincia',
                'cp',
                'localidad',
                'ingreso',
                'valor_total',
                'saldo',
                'observaciones',
            ]);
        });
    }
};
