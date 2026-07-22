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

    protected $hidden = [
        'pedido',
    ];

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
        'tipo_cobro',
        'vendedor_id',
        'medio_pago',
        'observaciones',
        'fecha_pago',
    ];

    protected $casts = [
        'fecha_pago' => 'datetime',
        'pagado_at' => 'datetime',
        'monto' => 'decimal:2',
    ];

    /**
     * Relación: El pago pertenece a un pedido.
     */
    public function pedido(): BelongsTo
    {
        return $this->belongsTo(Pedido::class, 'pedido_id');
    }

    /**
     * Relación: El pago fue registrado por un usuario (historico).
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'registrado_por');
    }

    /**
     * Relación: El cobro fue realizado por un vendedor.
     */
    public function vendedor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'vendedor_id');
    }

    /**
     * Relación Uno a Muchos con PagoIntentos.
     */
    public function intentos(): HasMany
    {
        return $this->hasMany(PagoIntento::class, 'pago_id');
    }
}
