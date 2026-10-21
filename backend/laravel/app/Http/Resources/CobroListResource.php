<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Formato reducido para el listado de cobros (GET /admin/cobros).
 * Solo lo que muestra la tabla: fecha, pedido / cliente, vendedor, medio · tipo, monto y estado.
 *
 * @mixin \App\Models\Pago
 */
class CobroListResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $cliente = $this->pedido?->cliente;

        return [
            'id' => $this->id,
            'fecha_pago' => ($this->fecha_pago ?? $this->pagado_at ?? $this->created_at)?->toIso8601String(),
            'pedido' => $this->pedido ? [
                'id' => $this->pedido->id,
                'codigo' => $this->pedido->codigo,
            ] : null,
            'cliente' => $cliente ? [
                'nombre_cliente' => $cliente->nombre_cliente,
                'nombre_empresa' => $cliente->nombre_empresa,
            ] : null,
            'vendedor' => $this->vendedor?->name,
            'medio_pago' => $this->medio_pago ?? $this->medio,
            'tipo_cobro' => $this->tipo_cobro,
            'monto' => (float) $this->monto,
            'estado' => $this->estado,
        ];
    }
}
