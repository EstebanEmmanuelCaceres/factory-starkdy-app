<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Pedido extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'pedidos';

    protected $fillable = [
        'cliente_id',
        'user_id',
        'codigo',
        'estado',
        'prioridad',
        'fecha_entrega',
        'dias_vencimiento',
        'observaciones',
    ];

    /**
     * Relación: El pedido pertenece a un cliente.
     */
    public function cliente(): BelongsTo
    {
        return $this->belongsTo(Cliente::class, 'cliente_id');
    }

    /**
     * Relación: El pedido fue creado por un usuario.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /**
     * Relación Muchos a Muchos con Productos.
     */
    public function productos(): BelongsToMany
    {
        return $this->belongsToMany(Producto::class, 'pedido_productos', 'pedido_id', 'producto_id')
                    ->using(PedidoProducto::class)
                    ->withPivot('cantidad')
                    ->withTimestamps();
    }

    /**
     * Relación Uno a Uno con Pago.
     */
    public function pago(): \Illuminate\Database\Eloquent\Relations\HasOne
    {
        return $this->hasOne(Pago::class, 'pedido_id');
    }
}
