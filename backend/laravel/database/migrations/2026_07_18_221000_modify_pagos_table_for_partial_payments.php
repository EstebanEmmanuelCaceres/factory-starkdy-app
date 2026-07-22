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
        Schema::table('pagos', function (Blueprint $table) {
            // Quitar restricción unique de pedido_id
            $table->dropUnique(['pedido_id']);

            // Agregar campos nuevos
            $table->string('tipo_cobro')->default('parcial')->after('monto');
            $table->foreignId('vendedor_id')->nullable()
                  ->constrained('users')->nullOnDelete()
                  ->after('tipo_cobro');
            $table->string('medio_pago')->nullable()->after('vendedor_id');
            $table->text('observaciones')->nullable()->after('medio_pago');
            $table->timestamp('fecha_pago')->nullable()->after('observaciones');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('pagos', function (Blueprint $table) {
            $table->unique(['pedido_id']);
            $table->dropColumn(['tipo_cobro', 'vendedor_id', 'medio_pago', 'observaciones', 'fecha_pago']);
        });
    }
};
