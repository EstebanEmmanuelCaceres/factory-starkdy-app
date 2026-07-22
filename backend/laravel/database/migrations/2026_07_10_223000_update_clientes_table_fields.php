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
            if (Schema::hasColumn('clientes', 'razon_social')) {
                $table->renameColumn('razon_social', 'nombre_empresa');
            }
            if (!Schema::hasColumn('clientes', 'nombre_cliente')) {
                $table->string('nombre_cliente')->default('');
            }
            $table->string('telefono')->nullable(false)->default('')->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('clientes', function (Blueprint $table) {
            if (Schema::hasColumn('clientes', 'nombre_empresa')) {
                $table->renameColumn('nombre_empresa', 'razon_social');
            }
            if (Schema::hasColumn('clientes', 'nombre_cliente')) {
                $table->dropColumn('nombre_cliente');
            }
            $table->string('telefono')->nullable()->default(null)->change();
        });
    }
};
