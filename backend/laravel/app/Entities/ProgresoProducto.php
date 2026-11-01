<?php

namespace App\Entities;

/**
 * Progreso de un producto dentro de un pedido.
 *
 * Regla: porcentaje = etapas completadas / etapas totales del producto * 100.
 * Un producto sin etapas no tiene progreso medible (porcentaje null) y no cuenta en el promedio del pedido.
 */
final class ProgresoProducto
{
    public function __construct(
        public readonly int $productoId,
        public readonly string $nombre,
        public readonly int $etapasTotales,
        public readonly int $etapasCompletadas,
    ) {}

    public function tieneEtapas(): bool
    {
        return $this->etapasTotales > 0;
    }

    public function porcentaje(): ?float
    {
        if (!$this->tieneEtapas()) {
            return null;
        }

        return round(min($this->etapasCompletadas, $this->etapasTotales) / $this->etapasTotales * 100, 2);
    }
}
