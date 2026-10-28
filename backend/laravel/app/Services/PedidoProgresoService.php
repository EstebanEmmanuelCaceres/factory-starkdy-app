<?php

namespace App\Services;

use App\Entities\ProgresoPedido;
use App\Entities\ProgresoProducto;
use App\Models\EtapaProducto;
use App\Models\Pedido;
use App\Models\ResponsableEtapa;
use App\Models\User;
use Illuminate\Support\Collection;

/**
 * Calcula el progreso de producción de los pedidos.
 *
 * Este servicio solo arma los datos (consultas a la base); las reglas de cálculo
 * viven en las entidades ProgresoProducto y ProgresoPedido.
 *
 * - Etapas totales de un producto: sus etapas_productos configuradas.
 * - Etapas completadas: tareas (responsables_etapas) del pedido en estado 'completado'
 *   que corresponden a esas etapas.
 */
class PedidoProgresoService
{
    /**
     * Progreso de varios pedidos con dos consultas en total (sin N+1).
     * Los pedidos deben tener cargada la relación 'productos' (si no, se carga).
     *
     * @param Collection<int, Pedido> $pedidos
     * @return Collection<int, ProgresoPedido> indexado por id de pedido
     */
    public function progresosDe(Collection $pedidos): Collection
    {
        if ($pedidos->isEmpty()) {
            return collect();
        }

        $pedidos->each(fn(Pedido $pedido) => $pedido->loadMissing('productos'));
        $productoIds = $pedidos->flatMap(fn(Pedido $pedido) => $pedido->productos->pluck('id'))->unique();

        $etapasPorProducto = EtapaProducto::query()
            ->whereIn('producto_id', $productoIds)
            ->get(['id', 'producto_id'])
            ->groupBy('producto_id')
            ->map(fn($etapas) => $etapas->pluck('id'));

        $completadasPorPedido = ResponsableEtapa::query()
            ->completadas()
            ->whereIn('pedido_id', $pedidos->pluck('id'))
            ->get(['pedido_id', 'etapa_producto_id'])
            ->groupBy('pedido_id')
            ->map(fn($tareas) => $tareas->pluck('etapa_producto_id')->unique());

        return $pedidos->mapWithKeys(fn(Pedido $pedido) => [
            $pedido->id => $this->calcular(
                $pedido,
                $etapasPorProducto,
                $completadasPorPedido->get($pedido->id, collect())
            ),
        ]);
    }

    public function progresoDe(Pedido $pedido): ProgresoPedido
    {
        return $this->progresosDe(collect([$pedido]))->get($pedido->id);
    }

    /**
     * Progreso de todos los pedidos en estado 'en_progreso'.
     * Un vendedor solo ve los pedidos que creó (mismo criterio que el listado de pedidos).
     *
     * @return Collection<int, ProgresoPedido>
     */
    public function listarEnProgreso(?User $usuario = null): Collection
    {
        $pedidos = Pedido::query()
            ->enProgreso()
            ->select('id', 'codigo')
            ->when($usuario?->role?->slug === 'vendedor', fn($q) => $q->where('user_id', $usuario->id))
            ->with('productos:productos.id,productos.nombre')
            ->latest('id')
            ->get();

        return $this->progresosDe($pedidos)->values();
    }

    /**
     * @param Collection<int, Collection<int, int>> $etapasPorProducto
     * @param Collection<int, int> $etapasCompletadas ids de etapa_producto completadas en el pedido
     */
    private function calcular(Pedido $pedido, Collection $etapasPorProducto, Collection $etapasCompletadas): ProgresoPedido
    {
        $productos = $pedido->productos
            ->unique('id')
            ->map(function ($producto) use ($etapasPorProducto, $etapasCompletadas) {
                $etapasDelProducto = $etapasPorProducto->get($producto->id, collect());

                return new ProgresoProducto(
                    productoId: $producto->id,
                    nombre: $producto->nombre,
                    etapasTotales: $etapasDelProducto->count(),
                    etapasCompletadas: $etapasDelProducto->intersect($etapasCompletadas)->count(),
                );
            })
            ->values()
            ->all();

        return new ProgresoPedido(
            pedidoId: $pedido->id,
            codigo: $pedido->codigo,
            estado: $pedido->estado,
            productos: $productos,
        );
    }
}
