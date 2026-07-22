<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ComentarioPedido extends Model
{
    use HasFactory;

    protected $table = 'comentarios_pedido';

    protected $fillable = [
        'pedido_id',
        'user_id',
        'cuerpo',
    ];

    /**
     * Relación: El comentario pertenece a un pedido.
     */
    public function pedido(): BelongsTo
    {
        return $this->belongsTo(Pedido::class, 'pedido_id');
    }

    /**
     * Relación: El comentario fue escrito por un usuario.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
