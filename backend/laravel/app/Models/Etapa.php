<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Etapa extends Model
{
    use HasFactory;

    protected $table = 'etapas';

    protected $fillable = [
        'producto_id',
        'nombre',
        'posicion',
        'estado',
        'fecha_inicio',
        'fecha_fin',
    ];

    /**
     * Relación: Una etapa pertenece a un producto.
     */
    public function producto(): BelongsTo
    {
        return $this->belongsTo(Producto::class);
    }

    /**
     * Relación: Operarios asignados a la etapa (N a N).
     */
    public function operarios(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'etapa_operarios', 'etapa_id', 'user_id')
                    ->withPivot('asignado_at');
    }

    /**
     * Relación: Responsabilidades (skills) requeridas para la etapa (N a N).
     */
    public function responsabilidades(): BelongsToMany
    {
        return $this->belongsToMany(Responsabilidad::class, 'etapa_responsabilidades', 'etapa_id', 'responsabilidad_id');
    }
}
