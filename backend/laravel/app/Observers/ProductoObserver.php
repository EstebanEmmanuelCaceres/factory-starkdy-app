<?php

namespace App\Observers;

use App\Models\Producto;

class ProductoObserver
{
    /**
     * Handle the Producto "created" event.
     */
    public function created(Producto $producto): void
    {
        $producto->asignarEtapasPorDefecto();
    }
}
