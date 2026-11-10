<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * productos.sku: código con el que se relaciona cada producto con su par en Tiendanube.
 * Nullable + único (varios NULL no chocan): los productos existentes quedan sin SKU hasta que se cargue.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('productos', 'sku')) {
            return;
        }

        Schema::table('productos', function (Blueprint $table) {
            $table->string('sku')->nullable()->unique();
        });
    }

    public function down(): void
    {
        if (!Schema::hasColumn('productos', 'sku')) {
            return;
        }

        Schema::table('productos', function (Blueprint $table) {
            $table->dropUnique(['sku']);
            $table->dropColumn('sku');
        });
    }
};
