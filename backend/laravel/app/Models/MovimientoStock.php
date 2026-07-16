<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MovimientoStock extends Model
{
    use HasFactory;

    protected $table = 'movimientos_stock';

    protected $fillable = [
        'materia_prima_id',
        'tipo',
        'cantidad',
        'etapa_id',
        'user_id',
        'observaciones',
    ];

    /**
     * Relación: El movimiento pertenece a una materia prima.
     */
    public function materiaPrima(): BelongsTo
    {
        return $this->belongsTo(MateriaPrima::class, 'materia_prima_id');
    }

    /**
     * Relación: El movimiento pertenece a una etapa (consumo automático, si aplica).
     */
    public function etapa(): BelongsTo
    {
        return $this->belongsTo(Etapa::class, 'etapa_id');
    }

    /**
     * Relación: El movimiento fue generado por un usuario.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
