<?php

namespace App\Http\Resources;

use App\Models\PedidoProducto;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Formato de una reposición (respuesta de POST /api/pedidos/{id}/reposicion).
 * Lo necesario para confirmarla: código, motivo, de qué venta sale y qué se repone.
 * Las relaciones las carga PedidoRepository::cargarReposicion.
 *
 * @mixin \App\Models\Pedido
 */
class ReposicionResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $lineas = $this->whenLoaded('lineas', fn() => $this->lineas->map(fn(PedidoProducto $linea) => [
            'id' => $linea->id,
            'producto_id' => $linea->producto_id,
            'producto' => $linea->producto?->nombre ?? "Producto #{$linea->producto_id}",
            'cantidad' => (int) $linea->cantidad,
            // [{clave, etiqueta, valor}] en el orden que define el producto
            'atributos' => $linea->producto?->etiquetarAtributos((array) $linea->atributos) ?? [],
        ])->values());

        return [
            'id' => $this->id,
            'codigo' => $this->codigo,
            'tipo' => $this->tipo,
            'estado' => $this->estado,
            'prioridad' => $this->prioridad,
            'fecha_entrega' => $this->fecha_entrega,
            'motivo' => [
                'clave' => $this->motivo_reposicion,
                'etiqueta' => $this->etiquetaMotivoReposicion(),
            ],
            'pedido_origen' => $this->whenLoaded('pedidoOrigen', fn() => [
                'id' => $this->pedidoOrigen->id,
                'codigo' => $this->pedidoOrigen->codigo,
            ]),
            'cliente' => $this->whenLoaded('cliente', fn() => [
                'id' => $this->cliente->id,
                'nombre_cliente' => $this->cliente->nombre_cliente,
                'nombre_empresa' => $this->cliente->nombre_empresa,
            ]),
            'vendedor' => $this->whenLoaded('user', fn() => $this->user ? [
                'id' => $this->user->id,
                'name' => $this->user->name,
            ] : null),
            'lineas' => $lineas,
            'unidades' => $this->whenLoaded('lineas', fn() => (int) $this->lineas->sum('cantidad')),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
