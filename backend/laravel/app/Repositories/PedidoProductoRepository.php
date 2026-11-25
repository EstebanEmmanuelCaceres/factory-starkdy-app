<?php

namespace App\Repositories;

use App\Models\Pedido;
use App\Models\PedidoProducto;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

/**
 * Repositorio de acceso a datos para la entidad PedidoProducto (`pedido_productos`).
 *
 * Única responsabilidad: construir y ejecutar las queries estructuradas hacia la base de datos
 * (tanto con relaciones como agrupadas por producto y mes), sin lógica de negocio.
 */
class PedidoProductoRepository
{
    /**
     * Query base de líneas de pedido válidas (no eliminadas) cuyos pedidos fueron creados
     * dentro del intervalo [$desde, $hasta] y no están en estado 'cancelado'.
     */
    private function queryBaseEnIntervalo(Carbon $desde, Carbon $hasta, ?int $vendedorId = null): Builder
    {
        return PedidoProducto::query()
            ->join('pedidos', 'pedidos.id', '=', 'pedido_productos.pedido_id')
            ->whereNull('pedidos.deleted_at')
            ->where('pedidos.tipo', Pedido::TIPO_VENTA) // las reposiciones no son unidades vendidas
            ->whereBetween('pedidos.created_at', [$desde, $hasta])
            ->whereNotExists(function ($subquery) {
                $subquery->selectRaw('1')
                    ->from('pedido_historial_estado as phe')
                    ->whereColumn('phe.pedido_id', 'pedidos.id')
                    ->whereRaw('phe.id = (SELECT phe2.id FROM pedido_historial_estado phe2 WHERE phe2.pedido_id = pedidos.id ORDER BY phe2.created_at DESC, phe2.id DESC LIMIT 1)')
                    ->where('phe.estado', 'cancelado');
            })
            ->when($vendedorId !== null, fn (Builder $q) => $q->where('pedidos.user_id', $vendedorId))
            ->whereHas('producto');
    }

    /**
     * Obtiene las unidades vendidas agrupadas por `producto_id`, `anio` y `mes`
     * dentro del intervalo indicado, precargando la relación `producto` (id, nombre, sku).
     *
     * @return Collection<int, PedidoProducto>
     */
    public function obtenerUnidadesPorProductoYMes(
        Carbon $desde,
        Carbon $hasta,
        ?int $vendedorId = null
    ): Collection {
        return $this->queryBaseEnIntervalo($desde, $hasta, $vendedorId)
            ->with(['producto:id,nombre,sku'])
            ->selectRaw('pedido_productos.producto_id as producto_id')
            ->selectRaw('EXTRACT(YEAR FROM pedidos.created_at)::int as anio')
            ->selectRaw('EXTRACT(MONTH FROM pedidos.created_at)::int as mes')
            ->selectRaw('SUM(pedido_productos.cantidad) as unidades_vendidas')
            ->selectRaw('COUNT(DISTINCT pedido_productos.pedido_id) as cantidad_pedidos')
            ->groupByRaw('pedido_productos.producto_id, EXTRACT(YEAR FROM pedidos.created_at), EXTRACT(MONTH FROM pedidos.created_at)')
            ->orderBy('pedido_productos.producto_id')
            ->get();
    }

    /**
     * Obtiene las líneas individuales de `pedido_productos` dentro del intervalo con sus
     * relaciones `pedido` y `producto` cargadas.
     *
     * @return Collection<int, PedidoProducto>
     */
    public function obtenerLineasConRelacionesEnIntervalo(
        Carbon $desde,
        Carbon $hasta,
        ?int $vendedorId = null
    ): Collection {
        return PedidoProducto::query()
            ->whereHas('pedido', function (Builder $pedidoQuery) use ($desde, $hasta, $vendedorId) {
                $pedidoQuery
                    ->ventas()
                    ->whereBetween('pedidos.created_at', [$desde, $hasta])
                    ->whereDoesntHave('ultimoEstado', fn (Builder $eq) => $eq->where('estado', 'cancelado'));

                if ($vendedorId !== null) {
                    $pedidoQuery->where('pedidos.user_id', $vendedorId);
                }
            })
            ->whereHas('producto')
            ->with([
                'pedido:id,codigo,user_id,created_at',
                'producto:id,nombre,sku',
            ])
            ->orderByDesc('id')
            ->get();
    }
}
