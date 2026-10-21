<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Formato de detalle de un cobro (GET /admin/cobros/{id} y respuestas de crear / editar / cancelar).
 * Incluye lo que muestra el modal de detalle y lo que necesita el formulario de edición.
 * Para el listado se usa CobroListResource.
 *
 * @mixin \App\Models\Pago
 */
class CobroResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $cliente = $this->pedido?->cliente;

        return [
            'id' => $this->id,
            'estado' => $this->estado,
            'monto' => (float) $this->monto,
            'fecha_pago' => ($this->fecha_pago ?? $this->pagado_at ?? $this->created_at)?->toIso8601String(),
            'medio_pago' => $this->medio_pago ?? $this->medio,
            'tipo_cobro' => $this->tipo_cobro,
            'pedido' => $this->pedido ? [
                'id' => $this->pedido->id,
                'codigo' => $this->pedido->codigo,
                'precio' => (float) $this->pedido->precio,
            ] : null,
            'cliente' => $cliente ? [
                'nombre_cliente' => $cliente->nombre_cliente,
                'nombre_empresa' => $cliente->nombre_empresa,
            ] : null,
            'vendedor' => $this->vendedor ? [
                'id' => $this->vendedor->id,
                'name' => $this->vendedor->name,
            ] : null,
            'registrado_por' => $this->user?->name,
            'observaciones' => $this->observaciones,
            // Se muestran solo si tienen valor; el formulario de edición los necesita para no perderlos
            'referencia_externa' => $this->referencia_externa,
            'comprobante_url' => $this->comprobante_url,
        ];
    }
}
