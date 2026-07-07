<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Pago extends Model
{
    use HasFactory;

    protected $table = 'pagos';

    protected $fillable = [
        'pedido_id',
        'registrado_por',
        'medio',
        'estado',
        'monto',
        'moneda',
        'referencia_externa',
        'comprobante_url',
        'pagado_at',
    ];

    /**
     * Relación: El pago pertenece a un pedido.
     */
    public function pedido(): BelongsTo
    {
        return $this->belongsTo(Pedido::class, 'pedido_id');
    }

    /**
     * Relación: El pago fue registrado por un usuario.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'registrado_por');
    }

    /**
     * Relación Uno a Muchos con PagoIntentos.
     */
    public function intentos(): HasMany
    {
        return $this->hasMany(PagoIntento::class, 'pago_id');
    }
}
