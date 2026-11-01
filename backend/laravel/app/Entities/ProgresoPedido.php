<?php

namespace App\Entities;

/**
 * Progreso de un pedido a partir del progreso de cada uno de sus productos.
 *
 * Regla: porcentaje = promedio simple de los porcentajes de los productos que tienen etapas.
 * Si ningún producto tiene etapas, el pedido queda en 0%.
 */
final class ProgresoPedido
{
    /**
     * @param ProgresoProducto[] $productos
     */
    public function __construct(
        public readonly int $pedidoId,
        public readonly string $codigo,
        public readonly string $estado,
        public readonly array $productos,
    ) {}

    public function porcentaje(): float
    {
        $porcentajes = array_values(array_filter(
            array_map(fn(ProgresoProducto $p) => $p->porcentaje(), $this->productos),
            fn(?float $porcentaje) => $porcentaje !== null
        ));

        if (empty($porcentajes)) {
            return 0.0;
        }

        return round(array_sum($porcentajes) / count($porcentajes), 2);
    }
}
