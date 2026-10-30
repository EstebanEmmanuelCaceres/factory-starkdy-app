<?php

namespace App\Services;

use App\Entities\ProgresoPedido;
use App\Entities\ProgresoProducto;
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
 * Se cuenta sobre las tareas (responsables_etapas) del pedido, que son la "foto" de las etapas
 * que tenía cada producto al entrar al pedido. Así, agregar o quitar etapas al producto después
 * no cambia el progreso de los pedidos existentes.
 * - Etapas totales de un producto: sus tareas en el pedido.
 * - Etapas completadas: esas tareas en estado 'completado'.
 */
class PedidoProgresoService
{
    /**
     * Progreso de varios pedidos con una consulta de tareas en total (sin N+1).
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

        // Tareas de todos los pedidos con el producto de su etapa. El join no filtra las etapas
        // borradas lógicamente: una etapa quitada del producto sigue contando en los pedidos que la tenían.
        $tareasPorPedido = ResponsableEtapa::query()
            ->join('etapas_productos', 'etapas_productos.id', '=', 'responsables_etapas.etapa_producto_id')
            ->whereIn('responsables_etapas.pedido_id', $pedidos->pluck('id'))
            ->get(['responsables_etapas.pedido_id', 'etapas_productos.producto_id', 'responsables_etapas.estado'])
            ->groupBy('pedido_id');

        return $pedidos->mapWithKeys(fn(Pedido $pedido) => [
            $pedido->id => $this->calcular($pedido, $tareasPorPedido->get($pedido->id, collect())),
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
     * @param Collection<int, ResponsableEtapa> $tareas tareas del pedido (con producto_id y estado)
     */
    private function calcular(Pedido $pedido, Collection $tareas): ProgresoPedido
    {
        $productos = $pedido->productos
            ->unique('id')
            ->map(function ($producto) use ($tareas) {
                $tareasDelProducto = $tareas->where('producto_id', $producto->id);

                return new ProgresoProducto(
                    productoId: $producto->id,
                    nombre: $producto->nombre,
                    etapasTotales: $tareasDelProducto->count(),
                    etapasCompletadas: $tareasDelProducto->where('estado', ResponsableEtapa::ESTADO_COMPLETADO)->count(),
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
