<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Producto extends Model
{
    use HasFactory;

    protected $table = 'productos';

    protected $fillable = [
        'nombre',
        'sku',
        'descripcion',
    ];

    /**
     * Relación Muchos a Muchos con Pedidos.
     */
    public function pedidos(): BelongsToMany
    {
        return $this->belongsToMany(Pedido::class, 'pedido_productos', 'producto_id', 'pedido_id')
                    ->using(PedidoProducto::class)
                    ->withPivot('cantidad')
                    ->withTimestamps();
    }

    /**
     * Relación Uno a Muchos con Etapas.
     */
    public function etapas(): HasMany
    {
        return $this->hasMany(Etapa::class);
    }
}
