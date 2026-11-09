<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class ComentarioPedido extends Model
{
    use HasFactory, SoftDeletes;

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

    /**
     * Imágenes adjuntas al comentario (son imágenes del pedido: también se ven en la galería).
     */
    public function imagenes(): HasMany
    {
        return $this->hasMany(PedidoImagen::class, 'comentario_id')->orderBy('id');
    }
}
