<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Pago;
use App\Models\Pedido;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MetricaController extends Controller
{
    /**
     * Roles que solo pueden ver sus propias métricas (mismo criterio que el dashboard).
     */
    private const ROLES_PROPIOS = ['vendedor', 'disenador', 'disenadora'];

    /**
     * Roles sin acceso a información financiera.
     */
    private const ROLES_SIN_ACCESO = ['operario', 'operator'];

    /**
     * Métricas de cobros de un período.
     *
     * Parámetros (todos opcionales):
     * - mes: 1-12. Si no se envía, se usa el mes actual. 0 = todo el año.
     * - anio: si no se envía, se usa el año actual.
     * - vendedor_id: filtra por el vendedor del pedido (pedidos.user_id). Sin él, trae todos.
     *
     * Criterios:
     * - cobrado: pagos con estado 'pagado' RECIBIDOS en el período (por fecha de pago),
     *   sin importar cuándo se creó el pedido ni en qué estado está.
     * - total_pedidos / por_cobrar: pedidos CREADOS en el período, excluyendo cancelados.
     *   por_cobrar es la suma de (precio - total pagado) de cada uno de esos pedidos.
     */
    public function cobros(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'mes' => 'nullable|integer|between:0,12',
            'anio' => 'nullable|integer|between:2000,2100',
            'vendedor_id' => 'nullable|integer|exists:users,id',
        ]);

        $currentUser = auth()->user();
        $role = $currentUser?->role?->slug;

        if (in_array($role, self::ROLES_SIN_ACCESO)) {
            return response()->json([
                'status' => 'error',
                'message' => 'No autorizado para ver métricas de cobros.'
            ], 403);
        }

        $now = now();
        $mes = isset($validated['mes']) ? (int) $validated['mes'] : $now->month;
        $anio = isset($validated['anio']) ? (int) $validated['anio'] : $now->year;

        if ($mes === 0) {
            $desde = Carbon::create($anio, 1, 1)->startOfYear();
            $hasta = $desde->copy()->endOfYear();
        } else {
            $desde = Carbon::create($anio, $mes, 1)->startOfMonth();
            $hasta = $desde->copy()->endOfMonth();
        }

        // Vendedores y diseñadores solo ven lo propio, aunque manden otro vendedor_id
        $vendedorId = in_array($role, self::ROLES_PROPIOS)
            ? $currentUser->id
            : ($validated['vendedor_id'] ?? null);

        // ── Cobrado: pagos recibidos en el período ─────────────────────
        // Fecha del pago: fecha_pago, o pagado_at / created_at para registros viejos sin fecha_pago
        $pagosQuery = Pago::query()
            ->where('estado', 'pagado')
            ->whereRaw('COALESCE(fecha_pago, pagado_at, created_at) BETWEEN ? AND ?', [$desde, $hasta]);

        if ($vendedorId) {
            $pagosQuery->whereHas('pedido', fn ($q) => $q->where('user_id', $vendedorId));
        }

        $cobrado = (float) (clone $pagosQuery)->sum('monto');
        $cantidadPagos = (clone $pagosQuery)->count();

        // ── Pedidos del período (valor total y saldo por cobrar) ───────
        $pedidosQuery = Pedido::query()
            ->whereBetween('created_at', [$desde, $hasta])
            ->whereDoesntHave('ultimoEstado', fn ($q) => $q->where('estado', 'cancelado'));

        if ($vendedorId) {
            $pedidosQuery->where('user_id', $vendedorId);
        }

        $pedidos = $pedidosQuery
            ->select('id', 'precio')
            ->addSelect([
                'total_pagado' => Pago::selectRaw('COALESCE(SUM(monto), 0)')
                    ->whereColumn('pagos.pedido_id', 'pedidos.id')
                    ->where('estado', 'pagado'),
            ])
            ->toBase()
            ->get();

        $totalPedidos = 0.0;
        $porCobrar = 0.0;
        foreach ($pedidos as $pedido) {
            $precio = (float) ($pedido->precio ?? 0);
            $totalPedidos += $precio;
            $porCobrar += max(0, $precio - (float) $pedido->total_pagado);
        }

        return response()->json([
            'status' => 'success',
            'data' => [
                'periodo' => [
                    'mes' => $mes,
                    'anio' => $anio,
                    'desde' => $desde->toDateString(),
                    'hasta' => $hasta->toDateString(),
                ],
                'vendedor_id' => $vendedorId,
                'total_pedidos' => round($totalPedidos, 2),
                'cantidad_pedidos' => $pedidos->count(),
                'cobrado' => round($cobrado, 2),
                'cantidad_pagos' => $cantidadPagos,
                'por_cobrar' => round($porCobrar, 2),
            ],
        ]);
    }
}
