<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class MateriaPrima extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'materias_primas';

    protected $fillable = [
        'nombre',
        'sku',
        'unidad_medida',
        'stock_actual',
        'stock_minimo',
        'costo_unitario',
    ];

    /**
     * Relación Muchos a Muchos con Productos (Receta / BOM).
     */
    public function productos(): BelongsToMany
    {
        return $this->belongsToMany(Producto::class, 'producto_materias_primas', 'materia_prima_id', 'producto_id')
                    ->using(ProductoMateriaPrima::class)
                    ->withPivot('cantidad_necesaria')
                    ->withTimestamps();
    }

    /**
     * Relación Muchos a Muchos con Etapas (Consumo de materiales por etapa).
     */
    public function etapas(): BelongsToMany
    {
        return $this->belongsToMany(Etapa::class, 'etapa_materias_primas', 'materia_prima_id', 'etapa_id')
                    ->using(EtapaMateriaPrima::class)
                    ->withPivot('cantidad_consumida')
                    ->withTimestamps();
    }

    /**
     * Relación Uno a Muchos con Movimientos de Stock.
     */
    public function movimientosStock(): HasMany
    {
        return $this->hasMany(MovimientoStock::class, 'materia_prima_id');
    }
}
