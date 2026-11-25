<?php

namespace App\Repositories;

use App\Models\Pedido;

/**
 * Repositorio de acceso a datos para la entidad Pedido (`pedidos`).
 *
 * Única responsabilidad: construir y ejecutar las queries, cargando de una vez las relaciones
 * que se van a usar (sin N+1). No tiene lógica de negocio.
 */
class PedidoRepository
{
    /**
     * Pedido con sus líneas y el nombre de cada producto (para armar una reposición).
     */
    public function buscarConLineas(int $id): ?Pedido
    {
        return Pedido::query()
            ->select('id', 'cliente_id', 'user_id', 'codigo', 'prioridad', 'tipo', 'pedido_origen_id')
            ->with([
                'lineas:id,pedido_id,producto_id,cantidad,atributos',
                'lineas.producto' => fn($q) => $q->withTrashed()->select('id', 'nombre', 'atributos'),
            ])
            ->find($id);
    }

    /**
     * Venta original bloqueada hasta el fin de la transacción: dos reposiciones creadas a la vez
     * no pueden calcular el mismo correlativo. Debe llamarse dentro de DB::transaction().
     */
    public function bloquearParaReposicion(int $id): Pedido
    {
        return Pedido::query()->select('id', 'codigo')->lockForUpdate()->findOrFail($id);
    }

    /**
     * Cantidad de reposiciones de una venta, contando las borradas (sus códigos siguen ocupados).
     */
    public function contarReposiciones(int $origenId): int
    {
        return Pedido::withTrashed()->where('pedido_origen_id', $origenId)->count();
    }

    public function existeCodigo(string $codigo): bool
    {
        return Pedido::withTrashed()->where('codigo', $codigo)->exists();
    }

    /**
     * Reposición recién creada con lo que muestra ReposicionResource:
     * venta original, cliente, vendedor y líneas con los atributos definidos en cada producto.
     */
    public function cargarReposicion(Pedido $reposicion): Pedido
    {
        return $reposicion->load([
            'pedidoOrigen:id,codigo',
            'cliente:id,nombre_cliente,nombre_empresa',
            'user:id,name',
            'lineas:id,pedido_id,producto_id,cantidad,atributos',
            'lineas.producto' => fn($q) => $q->withTrashed()->select('id', 'nombre', 'atributos'),
        ]);
    }
}
