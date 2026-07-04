<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\Pivot;
use Illuminate\Database\Eloquent\SoftDeletes;

class PedidoProducto extends Pivot
{
    use SoftDeletes;

    protected $table = 'pedido_productos';
}
