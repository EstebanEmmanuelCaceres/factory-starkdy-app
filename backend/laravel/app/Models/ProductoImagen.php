<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductoImagen extends Model
{
    use HasFactory;

    protected $table = 'producto_imagenes';

    protected $fillable = [
        'producto_id',
        'url',
        'path_almacenamiento',
        'orden',
        'es_principal',
    ];

    protected $casts = [
        'es_principal' => 'boolean',
        'orden' => 'integer',
    ];

    /**
     * Relación pertenencia a Producto.
     */
    public function producto(): BelongsTo
    {
        return $this->belongsTo(Producto::class, 'producto_id');
    }
}
