<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pagos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pedido_id')->constrained('pedidos')->cascadeOnDelete();
            $table->foreignId('registrado_por')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('vendedor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('medio')->nullable();
            $table->string('medio_pago')->nullable();
            $table->string('estado')->default('pendiente');
            $table->decimal('monto', 12, 2);
            $table->string('moneda', 10)->default('ARS');
            $table->string('referencia_externa')->nullable();
            $table->string('comprobante_url')->nullable();
            $table->timestamp('pagado_at')->nullable();
            $table->timestamp('fecha_pago')->nullable();
            $table->string('tipo_cobro')->nullable();
            $table->text('observaciones')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pagos');
    }
};
