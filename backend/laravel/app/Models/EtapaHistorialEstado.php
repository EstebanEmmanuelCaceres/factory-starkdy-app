<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EtapaHistorialEstado extends Model
{
    use HasFactory;

    protected $table = 'etapa_historial_estado';

    public $timestamps = false; // Manejado a nivel base de datos (created_at useCurrent)

    protected $fillable = [
        'etapa_id',
        'user_id',
        'estado_anterior',
        'estado_nuevo',
        'comentario',
    ];

    /**
     * Relación: El registro pertenece a una etapa.
     */
    public function etapa(): BelongsTo
    {
        return $this->belongsTo(Etapa::class);
    }

    /**
     * Relación: El registro pertenece al usuario que realizó la transición.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
