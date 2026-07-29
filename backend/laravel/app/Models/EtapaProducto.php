<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class EtapaProducto extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'etapas_productos';

    protected $fillable = [
        'producto_id',
        'etapa_id',
        'orden',
    ];

    /**
     * Relación: Pertenece a un producto.
     */
    public function producto(): BelongsTo
    {
        return $this->belongsTo(Producto::class, 'producto_id');
    }

    /**
     * Relación: Pertenece a una etapa del catálogo maestro.
     */
    public function etapa(): BelongsTo
    {
        return $this->belongsTo(Etapa::class, 'etapa_id');
    }

    /**
     * Relación: Etapas del mismo producto de las que depende esta etapa (Many-to-Many).
     */
    public function dependencias(): BelongsToMany
    {
        return $this->belongsToMany(
            EtapaProducto::class,
            'etapa_producto_dependencias',
            'etapa_producto_id',
            'depende_de_etapa_producto_id'
        );
    }

    /**
     * Relación: Etapas del mismo producto que dependen de esta etapa (Many-to-Many).
     */
    public function dependientes(): BelongsToMany
    {
        return $this->belongsToMany(
            EtapaProducto::class,
            'etapa_producto_dependencias',
            'depende_de_etapa_producto_id',
            'etapa_producto_id'
        );
    }

    /**
     * Relación: Tareas de pedidos generadas para esta etapa del producto.
     */
    public function responsablesEtapas(): HasMany
    {
        return $this->hasMany(ResponsableEtapa::class, 'etapa_producto_id');
    }
}
