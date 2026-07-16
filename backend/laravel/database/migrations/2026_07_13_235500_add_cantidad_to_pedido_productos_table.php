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
        Schema::table('pedido_productos', function (Blueprint $table) {
            $table->integer('cantidad')->default(1)->after('producto_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('pedido_productos', function (Blueprint $table) {
            $table->dropColumn('cantidad');
        });
    }
};
