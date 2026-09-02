<?php

use App\Models\Producto;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Asigna las 3 etapas predefinidas (Diseño -> Producción -> Finalizado)
     * a todos los productos que actualmente no tengan etapas asociadas.
     */
    public function up(): void
    {
        $productosSinEtapas = Producto::doesntHave('etapasProductos')->get();

        foreach ($productosSinEtapas as $producto) {
            $producto->asignarEtapasPorDefecto();
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // En migraciones de datos habitualmente no se revierten los inserts 
        // para evitar eliminar trabajo si el usuario ya modificó la secuencia.
    }
};
