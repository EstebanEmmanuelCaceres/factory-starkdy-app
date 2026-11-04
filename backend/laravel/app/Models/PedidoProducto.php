<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\Pivot;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Línea de un pedido: producto + cantidad + valores de sus atributos.
 * Ver App\Services\PedidoLineasService.
 */
class PedidoProducto extends Pivot
{
    use SoftDeletes;

    protected $table = 'pedido_productos';

    // La tabla tiene id propio: un producto puede estar en varias líneas con distintos atributos
    public $incrementing = true;

    protected function casts(): array
    {
        return [
            // Objeto {clave: valor}; como objeto se serializa {} aunque esté vacío (la columna exige un objeto)
            'atributos' => 'object',
        ];
    }
}
