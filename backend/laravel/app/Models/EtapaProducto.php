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

    /**
     * Recalcula la columna 'orden' de las etapas de un producto según sus dependencias (por niveles).
     * El orden es solo visual: el bloqueo de etapas se decide por etapa_producto_dependencias.
     */
    public static function reordenarTopologicamentePorProducto(int $productoId): void
    {
        $etapas = static::where('producto_id', $productoId)
            ->with('dependencias')
            ->orderBy('orden', 'asc')
            ->get();

        if ($etapas->isEmpty()) {
            return;
        }

        $etapaMap = [];
        $inDegree = [];
        $adj = [];
        $originalOrdenMap = [];

        foreach ($etapas as $etapa) {
            $id = $etapa->id;
            $etapaMap[$id] = $etapa;
            $inDegree[$id] = 0;
            $adj[$id] = [];
            $originalOrdenMap[$id] = $etapa->orden;
        }

        foreach ($etapas as $etapa) {
            $id = $etapa->id;
            foreach ($etapa->dependencias as $dep) {
                $depId = $dep->id;
                if (isset($inDegree[$id]) && isset($adj[$depId])) {
                    $adj[$depId][] = $id;
                    $inDegree[$id]++;
                }
            }
        }

        $queue = [];
        foreach ($etapas as $etapa) {
            if ($inDegree[$etapa->id] === 0) {
                $queue[] = $etapa->id;
            }
        }

        usort($queue, function ($a, $b) use ($originalOrdenMap) {
            return $originalOrdenMap[$a] <=> $originalOrdenMap[$b];
        });

        $sortedIds = [];

        while (!empty($queue)) {
            $currentId = array_shift($queue);
            $sortedIds[] = $currentId;

            foreach ($adj[$currentId] as $neighborId) {
                $inDegree[$neighborId]--;
                if ($inDegree[$neighborId] === 0) {
                    $queue[] = $neighborId;
                    usort($queue, function ($a, $b) use ($originalOrdenMap) {
                        return $originalOrdenMap[$a] <=> $originalOrdenMap[$b];
                    });
                }
            }
        }

        if (count($sortedIds) === count($etapas)) {
            // Orden por niveles: 1 + el mayor orden de sus dependencias.
            // Las etapas paralelas (que dependen de las mismas etapas) comparten el mismo orden.
            $nivel = [];
            foreach ($sortedIds as $stageId) {
                $nivel[$stageId] = 1;
                foreach ($etapaMap[$stageId]->dependencias as $dep) {
                    if (isset($nivel[$dep->id])) {
                        $nivel[$stageId] = max($nivel[$stageId], $nivel[$dep->id] + 1);
                    }
                }
            }

            foreach ($nivel as $stageId => $nuevoOrden) {
                if ((int) $etapaMap[$stageId]->orden !== $nuevoOrden) {
                    static::where('id', $stageId)->update(['orden' => $nuevoOrden]);
                }
            }
        }
    }
}
