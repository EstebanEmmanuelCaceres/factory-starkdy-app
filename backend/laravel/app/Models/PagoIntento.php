<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PagoIntento extends Model
{
    use HasFactory;

    protected $table = 'pago_intentos';

    // Desactivar updated_at ya que la tabla es inmutable y solo tiene created_at
    const UPDATED_AT = null;

    protected $fillable = [
        'pago_id',
        'medio',
        'estado',
        'error_codigo',
        'error_mensaje',
        'referencia_gateway',
    ];

    /**
     * Relación: El intento pertenece a un pago.
     */
    public function pago(): BelongsTo
    {
        return $this->belongsTo(Pago::class, 'pago_id');
    }
}
