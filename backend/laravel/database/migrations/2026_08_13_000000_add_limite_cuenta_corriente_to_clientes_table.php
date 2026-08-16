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
            $table->boolean('tiene_limite_cuenta_corriente')->default(false)->after('saldo');
            $table->decimal('limite_cuenta_corriente', 12, 2)->nullable()->default(null)->after('tiene_limite_cuenta_corriente');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('clientes', function (Blueprint $table) {
            $table->dropColumn(['tiene_limite_cuenta_corriente', 'limite_cuenta_corriente']);
        });
    }
};
