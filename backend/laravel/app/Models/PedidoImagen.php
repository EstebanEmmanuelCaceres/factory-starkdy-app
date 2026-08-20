<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PedidoImagen extends Model
{
    use HasFactory;

    protected $table = 'pedido_imagenes';

    protected $fillable = [
        'pedido_id',
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
     * Relación pertenencia a Pedido.
     */
    public function pedido(): BelongsTo
    {
        return $this->belongsTo(Pedido::class, 'pedido_id');
    }
}
