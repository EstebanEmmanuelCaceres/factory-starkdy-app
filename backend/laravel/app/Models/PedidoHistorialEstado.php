<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PedidoHistorialEstado extends Model
{
    use HasFactory;

    protected $table = 'pedido_historial_estado';

    public $timestamps = false;

    protected $fillable = [
        'pedido_id',
        'estado',
        'created_at',
    ];

    /**
     * Relación: El registro del historial pertenece a un pedido.
     */
    public function pedido(): BelongsTo
    {
        return $this->belongsTo(Pedido::class, 'pedido_id');
    }
}
