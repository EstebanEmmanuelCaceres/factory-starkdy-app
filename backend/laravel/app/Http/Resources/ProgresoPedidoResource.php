<?php

namespace App\Http\Resources;

use App\Entities\ProgresoPedido;
use App\Entities\ProgresoProducto;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin ProgresoPedido
 */
class ProgresoPedidoResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'pedido_id' => $this->pedidoId,
            'codigo' => $this->codigo,
            'estado' => $this->estado,
            'porcentaje' => $this->porcentaje(),
            'productos' => array_map(fn(ProgresoProducto $producto) => [
                'producto_id' => $producto->productoId,
                'nombre' => $producto->nombre,
                'etapas_totales' => $producto->etapasTotales,
                'etapas_completadas' => $producto->etapasCompletadas,
                'porcentaje' => $producto->porcentaje(),
            ], $this->productos),
        ];
    }
}
