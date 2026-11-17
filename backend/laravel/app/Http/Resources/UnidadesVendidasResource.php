<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Resource principal para la tabla mensual de Unidades Vendidas:
 * - `periodo`: año, rango de meses y etiquetas de los meses comparados
 * - `meses`: columnas de la tabla
 * - `productos`: filas de productos con sus unidades mes a mes, total y variación %
 * - `fila_total`: fila "Total unidades" al pie de la tabla
 */
class UnidadesVendidasResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $periodo = $this->resource['periodo'] ?? [];
        $meses = $this->resource['meses'] ?? [];
        $productos = $this->resource['productos'] ?? [];
        $filaTotal = $this->resource['fila_total'] ?? [];

        return [
            'periodo' => [
                'anio' => (int) ($periodo['anio'] ?? now()->year),
                'mes_desde' => (int) ($periodo['mes_desde'] ?? 1),
                'mes_hasta' => (int) ($periodo['mes_hasta'] ?? 12),
                'desde' => (string) ($periodo['desde'] ?? ''),
                'hasta' => (string) ($periodo['hasta'] ?? ''),
                'comparacion' => $periodo['comparacion'] ?? [
                    'mes_actual_clave' => '',
                    'mes_actual_etiqueta' => '',
                    'mes_anterior_clave' => '',
                    'mes_anterior_etiqueta' => '',
                ],
            ],
            'meses' => array_values($meses),
            'productos' => ProductoUnidadesVendidasResource::collection(collect($productos))->resolve($request),
            'fila_total' => [
                'por_mes' => (array) ($filaTotal['por_mes'] ?? []),
                'total_unidades' => (int) ($filaTotal['total_unidades'] ?? 0),
                'unidades_mes_comparado' => (int) ($filaTotal['unidades_mes_comparado'] ?? 0),
                'unidades_mes_anterior' => (int) ($filaTotal['unidades_mes_anterior'] ?? 0),
                'variacion_pct' => isset($filaTotal['variacion_pct'])
                    ? (float) $filaTotal['variacion_pct']
                    : null,
                'total_productos' => (int) ($filaTotal['total_productos'] ?? 0),
            ],
        ];
    }
}
