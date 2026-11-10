<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Pago;
use App\Models\Pedido;
use App\Models\User;
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

    /**
     * Métricas diarias por vendedor para gráfico de líneas.
     *
     * Parámetros:
     * - fecha_desde: string (YYYY-MM-DD), default: primer día del mes actual.
     * - fecha_hasta: string (YYYY-MM-DD), default: día de hoy.
     * - vendedor_id: integer (opcional, para filtrar un solo vendedor).
     */
    public function vendedoresDiario(Request $request): JsonResponse
    {
        $currentUser = auth()->user();
        $role = $currentUser?->role?->slug;

        if (in_array($role, self::ROLES_SIN_ACCESO)) {
            return response()->json([
                'status' => 'error',
                'message' => 'No autorizado para ver métricas de vendedores.'
            ], 403);
        }

        $validated = $request->validate([
            'fecha_desde' => 'nullable|date',
            'fecha_hasta' => 'nullable|date',
            'vendedor_id' => 'nullable|integer|exists:users,id',
        ]);

        $now = now();
        $desde = !empty($validated['fecha_desde'])
            ? Carbon::parse($validated['fecha_desde'])->startOfDay()
            : $now->copy()->startOfMonth()->startOfDay();

        $hasta = !empty($validated['fecha_hasta'])
            ? Carbon::parse($validated['fecha_hasta'])->endOfDay()
            : $now->copy()->endOfDay();

        if ($desde->gt($hasta)) {
            [$desde, $hasta] = [$hasta->copy()->startOfDay(), $desde->copy()->endOfDay()];
        }

        // Limitamos el rango a un máximo razonable de 90 días para evitar sobrecarga
        if ($desde->diffInDays($hasta) > 90) {
            $desde = $hasta->copy()->subDays(90)->startOfDay();
        }

        // Vendedores propios solo ven sus propios datos
        $vendedorId = in_array($role, self::ROLES_PROPIOS)
            ? $currentUser->id
            : ($validated['vendedor_id'] ?? null);

        // Generamos la lista de días en formato Y-m-d
        $fechas = [];
        $cursor = $desde->copy()->startOfDay();
        $hastaDay = $hasta->copy()->startOfDay();
        while ($cursor->lte($hastaDay)) {
            $fechas[] = $cursor->format('Y-m-d');
            $cursor->addDay();
        }

        // Obtenemos los usuarios con rol vendedor o que hayan registrado pedidos/pagos en el sistema
        $vendedoresQuery = User::query()
            ->where(function ($q) {
                $q->whereHas('role', fn ($rq) => $rq->whereIn('slug', ['vendedor', 'vendedora']))
                  ->orWhereHas('pedidos');
            });

        if ($vendedorId) {
            $vendedoresQuery->where('id', $vendedorId);
        }

        $vendedores = $vendedoresQuery->select('id', 'name')->orderBy('name')->get();

        // ── Cobros por día y vendedor ────────────────────────────────
        $pagosQuery = Pago::query()
            ->join('pedidos', 'pedidos.id', '=', 'pagos.pedido_id')
            ->where('pagos.estado', 'pagado')
            ->whereRaw('COALESCE(pagos.fecha_pago, pagos.pagado_at, pagos.created_at) BETWEEN ? AND ?', [$desde, $hasta])
            ->selectRaw('DATE(COALESCE(pagos.fecha_pago, pagos.pagado_at, pagos.created_at)) as fecha')
            ->selectRaw('pedidos.user_id as vendedor_id')
            ->selectRaw('SUM(pagos.monto) as total')
            ->groupByRaw('DATE(COALESCE(pagos.fecha_pago, pagos.pagado_at, pagos.created_at)), pedidos.user_id');

        if ($vendedorId) {
            $pagosQuery->where('pedidos.user_id', $vendedorId);
        }

        $pagosRows = $pagosQuery->get();

        // Mapeamos [vendedor_id][fecha] => total
        $cobrosMap = [];
        foreach ($pagosRows as $row) {
            $cobrosMap[$row->vendedor_id][$row->fecha] = (float) $row->total;
        }

        // ── Ventas (pedidos creados) por día y vendedor ───────────────
        $pedidosQuery = Pedido::query()
            ->whereBetween('created_at', [$desde, $hasta])
            ->whereDoesntHave('ultimoEstado', fn ($q) => $q->where('estado', 'cancelado'))
            ->selectRaw('DATE(created_at) as fecha')
            ->selectRaw('user_id as vendedor_id')
            ->selectRaw('SUM(precio) as total')
            ->groupByRaw('DATE(created_at), user_id');

        if ($vendedorId) {
            $pedidosQuery->where('user_id', $vendedorId);
        }

        $pedidosRows = $pedidosQuery->get();

        $ventasMap = [];
        foreach ($pedidosRows as $row) {
            $ventasMap[$row->vendedor_id][$row->fecha] = (float) $row->total;
        }

        // Armamos las series para cada vendedor
        $vendedoresData = [];
        $totalesPorDiaCobros = array_fill_keys($fechas, 0.0);
        $totalesPorDiaVentas = array_fill_keys($fechas, 0.0);

        foreach ($vendedores as $vend) {
            $serieCobros = [];
            $serieVentas = [];
            $totalCobradoVend = 0.0;
            $totalVentasVend = 0.0;

            foreach ($fechas as $fecha) {
                $cobradoDia = $cobrosMap[$vend->id][$fecha] ?? 0.0;
                $ventasDia = $ventasMap[$vend->id][$fecha] ?? 0.0;

                $serieCobros[] = round($cobradoDia, 2);
                $serieVentas[] = round($ventasDia, 2);

                $totalCobradoVend += $cobradoDia;
                $totalVentasVend += $ventasDia;

                $totalesPorDiaCobros[$fecha] += $cobradoDia;
                $totalesPorDiaVentas[$fecha] += $ventasDia;
            }

            // Solo incluimos vendedores que tengan alguna actividad en el período o si fueron explícitamente filtrados
            if ($totalCobradoVend > 0 || $totalVentasVend > 0 || $vendedorId) {
                $vendedoresData[] = [
                    'id' => $vend->id,
                    'name' => $vend->name,
                    'total_cobrado' => round($totalCobradoVend, 2),
                    'total_ventas' => round($totalVentasVend, 2),
                    'series' => [
                        'cobros' => $serieCobros,
                        'ventas' => $serieVentas,
                    ],
                ];
            }
        }

        return response()->json([
            'status' => 'success',
            'data' => [
                'periodo' => [
                    'desde' => $desde->toDateString(),
                    'hasta' => $hasta->toDateString(),
                ],
                'fechas' => $fechas,
                'vendedores' => $vendedoresData,
                'totales_por_dia' => [
                    'cobros' => array_values(array_map(fn ($v) => round($v, 2), $totalesPorDiaCobros)),
                    'ventas' => array_values(array_map(fn ($v) => round($v, 2), $totalesPorDiaVentas)),
                ],
            ],
        ]);
    }
}
