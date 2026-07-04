<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PedidoHistorialEstado extends Model
{
    use HasFactory;

    protected $table = 'pedido_historial_estado';

    public $timestamps = false; // Manejado a nivel base de datos (created_at useCurrent)

    protected $fillable = [
        'pedido_id',
        'user_id',
        'estado_anterior',
        'estado_nuevo',
        'comentario',
    ];

    /**
     * Relación: El registro pertenece a un pedido.
     */
    public function pedido(): BelongsTo
    {
        return $this->belongsTo(Pedido::class);
    }

    /**
     * Relación: El registro pertenece al usuario que realizó la transición.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
