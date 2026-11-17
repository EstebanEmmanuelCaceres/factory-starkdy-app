<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Resource que formatea una fila de producto dentro de la tabla mensual de unidades vendidas.
 */
class ProductoUnidadesVendidasResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'producto_id' => (int) ($this->resource['producto_id'] ?? 0),
            'nombre' => (string) ($this->resource['nombre'] ?? ''),
            'sku' => $this->resource['sku'] ?? null,
            'por_mes' => (array) ($this->resource['por_mes'] ?? []),
            'total_unidades' => (int) ($this->resource['total_unidades'] ?? 0),
            'unidades_mes_comparado' => (int) ($this->resource['unidades_mes_comparado'] ?? 0),
            'unidades_mes_anterior' => (int) ($this->resource['unidades_mes_anterior'] ?? 0),
            'variacion_pct' => isset($this->resource['variacion_pct'])
                ? (float) $this->resource['variacion_pct']
                : null,
        ];
    }
}
