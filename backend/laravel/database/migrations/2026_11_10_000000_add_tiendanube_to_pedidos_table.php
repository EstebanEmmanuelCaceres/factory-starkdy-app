<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Integración Tiendanube (aditiva).
 *
 * - pedidos.tiendanube_order_id: id de la orden en Tiendanube. Único para que reintentos del webhook no dupliquen pedidos.
 *   (nullable: los pedidos cargados a mano lo dejan en NULL, y NULL no choca con el índice único)
 * - pedidos.origen: de dónde vino el pedido ('manual' | 'tiendanube').
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pedidos', function (Blueprint $table) {
            $table->string('tiendanube_order_id')->nullable()->unique();
            $table->string('origen')->default('manual');
        });
    }

    public function down(): void
    {
        Schema::table('pedidos', function (Blueprint $table) {
            $table->dropUnique(['tiendanube_order_id']);
            $table->dropColumn(['tiendanube_order_id', 'origen']);
        });
    }
};
