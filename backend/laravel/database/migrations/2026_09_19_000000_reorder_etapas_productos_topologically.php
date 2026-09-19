<?php

use Illuminate\Database\Migrations\Migration;
use App\Models\Producto;
use App\Models\EtapaProducto;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $productoIds = Producto::pluck('id');
        foreach ($productoIds as $pId) {
            EtapaProducto::reordenarTopologicamentePorProducto((int) $pId);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // No operation needed for reverse
    }
};
