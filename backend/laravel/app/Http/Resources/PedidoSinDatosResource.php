<?php

namespace App\Http\Resources;

use App\Models\Cliente;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Pedido completado al que le faltan datos de envío del cliente (GET /pedidos/completados-sin-datos).
 * Solo lo que muestra la caja del dashboard: pedido, cliente, vendedor y qué datos faltan.
 *
 * @mixin \App\Models\Pedido
 */
class PedidoSinDatosResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $faltantes = $this->cliente?->datosEnvioFaltantes() ?? [];

        return [
            'id' => $this->id,
            'codigo' => $this->codigo,
            'created_at' => $this->created_at?->toIso8601String(),
            'cliente' => $this->cliente ? [
                'id' => $this->cliente->id,
                'nombre_cliente' => $this->cliente->nombre_cliente,
                'nombre_empresa' => $this->cliente->nombre_empresa,
            ] : null,
            'vendedor' => $this->user ? ['id' => $this->user->id, 'name' => $this->user->name] : null,
            'datos_faltantes' => array_map(
                fn(string $campo) => ['clave' => $campo, 'etiqueta' => Cliente::DATOS_ENVIO[$campo]],
                $faltantes
            ),
        ];
    }
}
