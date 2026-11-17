<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\Pivot;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Modelo PedidoProducto (tabla `pedido_productos`).
 * Representa cada línea de producto dentro de un pedido: producto + cantidad + valores de atributos.
 */
class PedidoProducto extends Pivot
{
    use SoftDeletes;

    protected $table = 'pedido_productos';

    // La tabla tiene id propio: un producto puede estar en varias líneas con distintos atributos
    public $incrementing = true;

    protected $fillable = [
        'pedido_id',
        'producto_id',
        'cantidad',
        'atributos',
    ];

    protected function casts(): array
    {
        return [
            'pedido_id' => 'integer',
            'producto_id' => 'integer',
            'cantidad' => 'integer',
            // Objeto {clave: valor}; como objeto se serializa {} aunque esté vacío (la columna exige un objeto)
            'atributos' => 'object',
        ];
    }

    /**
     * Relación: La línea pertenece a un Pedido.
     */
    public function pedido(): BelongsTo
    {
        return $this->belongsTo(Pedido::class, 'pedido_id');
    }

    /**
     * Relación: La línea referencia a un Producto del catálogo.
     */
    public function producto(): BelongsTo
    {
        return $this->belongsTo(Producto::class, 'producto_id');
    }
}
