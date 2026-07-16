<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

use Illuminate\Database\Eloquent\SoftDeletes;

class Etapa extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'etapas';

    protected $fillable = [
        'producto_id',
        'nombre',
        'orden',
        'responsabilidad_id',
    ];

    /**
     * Relación: Una etapa pertenece a un producto.
     */
    public function producto(): BelongsTo
    {
        return $this->belongsTo(Producto::class);
    }

    /**
     * Relación: Una etapa puede requerir una responsabilidad específica (1 a N).
     */
    public function responsabilidad(): BelongsTo
    {
        return $this->belongsTo(Responsabilidad::class, 'responsabilidad_id');
    }

    /**
     * Relación: Etapas previas de las que depende esta etapa (Many-to-Many).
     */
    public function dependencias(): BelongsToMany
    {
        return $this->belongsToMany(Etapa::class, 'etapa_dependencias', 'etapa_id', 'depende_de_etapa_id');
    }

    /**
     * Relación: Etapas posteriores que dependen de esta etapa (Many-to-Many).
     */
    public function dependientes(): BelongsToMany
    {
        return $this->belongsToMany(Etapa::class, 'etapa_dependencias', 'depende_de_etapa_id', 'etapa_id');
    }

    /**
     * Relación: Responsabilidades (skills) requeridas para la etapa (N a N).
     */
    public function responsabilidades(): BelongsToMany
    {
        return $this->belongsToMany(Responsabilidad::class, 'etapa_responsabilidades', 'etapa_id', 'responsabilidad_id');
    }

    /**
     * Relación Muchos a Muchos con Materias Primas (Consumo por etapa).
     */
    public function materiasPrimas(): BelongsToMany
    {
        return $this->belongsToMany(MateriaPrima::class, 'etapa_materias_primas', 'etapa_id', 'materia_prima_id')
                    ->using(EtapaMateriaPrima::class)
                    ->withPivot('cantidad_consumida')
                    ->withTimestamps();
    }
}
