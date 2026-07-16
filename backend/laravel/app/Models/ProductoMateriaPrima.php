<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\Pivot;

class ProductoMateriaPrima extends Pivot
{
    protected $table = 'producto_materias_primas';
}
