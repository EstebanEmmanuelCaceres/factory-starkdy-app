<?php

namespace App\Services;

use App\Models\User;
use App\Repositories\PedidoProductoRepository;
use Carbon\Carbon;

/**
 * Servicio de lógica de negocio para la matriz mensual de Unidades Vendidas por Producto.
 *
 * Única responsabilidad: recibir los datos crudos de `PedidoProductoRepository` y construir:
 * - Las columnas de meses del rango seleccionado (`mes_desde` .. `mes_hasta` de `anio`)
 * - Las unidades por mes y el total por cada producto
 * - La fila de "Total unidades" por mes y total general
 * - La variación porcentual (%) del último mes evaluado contra su mes inmediato anterior
 */
class UnidadesVendidasService
{
    private const ROLES_SOLO_PROPIOS = ['vendedor'];

    private const NOMBRES_MESES_CORTOS = [
        1 => 'Ene',
        2 => 'Feb',
        3 => 'Mar',
        4 => 'Abr',
        5 => 'May',
        6 => 'Jun',
        7 => 'Jul',
        8 => 'Ago',
        9 => 'Sep',
        10 => 'Oct',
        11 => 'Nov',
        12 => 'Dic',
    ];

    private const NOMBRES_MESES_LARGOS = [
        1 => 'Enero',
        2 => 'Febrero',
        3 => 'Marzo',
        4 => 'Abril',
        5 => 'Mayo',
        6 => 'Junio',
        7 => 'Julio',
        8 => 'Agosto',
        9 => 'Septiembre',
        10 => 'Octubre',
        11 => 'Noviembre',
        12 => 'Diciembre',
    ];

    public function __construct(
        private readonly PedidoProductoRepository $pedidoProductoRepository
    ) {
    }

    /**
     * Construye la tabla matricial de unidades vendidas por producto y mes,
     * con columna Total, fila Total unidades y variación % contra el mes anterior.
     *
     * @param array{anio: int, mes_desde: int, mes_hasta: int, vendedor_id: int|null} $filtros
     * @return array<string, mixed>
     */
    public function obtenerUnidadesVendidasPorIntervalo(array $filtros, ?User $usuarioActual = null): array
    {
        $anio = (int) $filtros['anio'];
        $mesDesde = (int) $filtros['mes_desde'];
        $mesHasta = (int) $filtros['mes_hasta'];

        $rol = $usuarioActual?->role?->slug;
        $vendedorId = in_array($rol, self::ROLES_SOLO_PROPIOS, true)
            ? $usuarioActual?->id
            : ($filtros['vendedor_id'] ?? null);

        $inicioRangoVisible = Carbon::create($anio, $mesDesde, 1)->startOfMonth()->startOfDay();
        $finRangoVisible = Carbon::create($anio, $mesHasta, 1)->endOfMonth()->endOfDay();

        // Determinar cuál es el mes de referencia para calcular "% vs mes anterior":
        // Si se consulta el año actual y mes_hasta supera el mes en curso, comparamos el mes en curso
        // (salvo que mes_desde sea posterior al mes en curso).
        $ahora = now();
        $mesReferencia = ($anio === $ahora->year && $mesHasta >= $ahora->month && $mesDesde <= $ahora->month)
            ? $ahora->month
            : $mesHasta;

        $fechaMesReferencia = Carbon::create($anio, $mesReferencia, 1)->startOfMonth();
        $fechaMesAnterior = $fechaMesReferencia->copy()->subMonthNoOverflow()->startOfMonth();

        // Si el mes anterior cae antes de $inicioRangoVisible (ej. Enero -> Diciembre del año previo,
        // o cuando mes_desde == mes_hasta), extendemos el inicio de consulta al repositorio 1 mes atrás
        // para poder calcular la variación % contra el mes anterior sin hacer una segunda query.
        $desdeConsulta = $fechaMesAnterior->lt($inicioRangoVisible)
            ? $fechaMesAnterior->copy()->startOfDay()
            : $inicioRangoVisible->copy();

        $registros = $this->pedidoProductoRepository->obtenerUnidadesPorProductoYMes(
            $desdeConsulta,
            $finRangoVisible,
            $vendedorId
        );

        // 1. Armar metadatos de las columnas de meses visibles (mes_desde .. mes_hasta)
        $columnasMeses = [];
        $totalesPorMes = [];
        for ($m = $mesDesde; $m <= $mesHasta; $m++) {
            $clave = sprintf('%04d-%02d', $anio, $m);
            $columnasMeses[] = [
                'mes' => $m,
                'anio' => $anio,
                'clave' => $clave,
                'etiqueta_corta' => self::NOMBRES_MESES_CORTOS[$m],
                'etiqueta_larga' => self::NOMBRES_MESES_LARGOS[$m],
            ];
            $totalesPorMes[$clave] = 0;
        }

        $claveMesActualComp = sprintf('%04d-%02d', $fechaMesReferencia->year, $fechaMesReferencia->month);
        $claveMesAnteriorComp = sprintf('%04d-%02d', $fechaMesAnterior->year, $fechaMesAnterior->month);

        // 2. Agrupar los registros del repositorio por producto
        $mapaProductos = [];
        $totalGeneralMesActualComp = 0;
        $totalGeneralMesAnteriorComp = 0;

        foreach ($registros as $fila) {
            $prodId = (int) $fila->producto_id;
            $filaAnio = (int) $fila->anio;
            $filaMes = (int) $fila->mes;
            $unidades = (int) $fila->unidades_vendidas;
            $claveFila = sprintf('%04d-%02d', $filaAnio, $filaMes);

            if (!isset($mapaProductos[$prodId])) {
                $porMesInicial = [];
                foreach ($columnasMeses as $col) {
                    $porMesInicial[$col['clave']] = 0;
                }

                $mapaProductos[$prodId] = [
                    'producto_id' => $prodId,
                    'nombre' => $fila->producto?->nombre ?? "Producto #{$prodId}",
                    'sku' => $fila->producto?->sku,
                    'por_mes' => $porMesInicial,
                    'total_unidades' => 0,
                    'unidades_mes_comparado' => 0,
                    'unidades_mes_anterior' => 0,
                ];
            }

            // Si el registro pertenece a uno de los meses visibles del rango, suma a la tabla y al total
            if (array_key_exists($claveFila, $mapaProductos[$prodId]['por_mes'])) {
                $mapaProductos[$prodId]['por_mes'][$claveFila] += $unidades;
                $mapaProductos[$prodId]['total_unidades'] += $unidades;
                $totalesPorMes[$claveFila] += $unidades;
            }

            if ($claveFila === $claveMesActualComp) {
                $mapaProductos[$prodId]['unidades_mes_comparado'] += $unidades;
                $totalGeneralMesActualComp += $unidades;
            }

            if ($claveFila === $claveMesAnteriorComp) {
                $mapaProductos[$prodId]['unidades_mes_anterior'] += $unidades;
                $totalGeneralMesAnteriorComp += $unidades;
            }
        }

        // 3. Filtrar productos que tengan al menos 1 unidad vendida en el rango visible (o en la comparación)
        // y calcular la variación % contra el mes anterior para cada producto
        $productosFinales = [];
        foreach ($mapaProductos as $prod) {
            if ($prod['total_unidades'] <= 0) {
                continue;
            }

            $prod['variacion_pct'] = $this->calcularVariacionPorcentual(
                $prod['unidades_mes_comparado'],
                $prod['unidades_mes_anterior']
            );

            $productosFinales[] = $prod;
        }

        // Ordenar productos de mayor a menor total de unidades vendidas en el rango
        usort($productosFinales, fn (array $a, array $b) => $b['total_unidades'] <=> $a['total_unidades']);

        $granTotalUnidades = array_sum($totalesPorMes);
        $variacionTotalGeneral = $this->calcularVariacionPorcentual(
            $totalGeneralMesActualComp,
            $totalGeneralMesAnteriorComp
        );

        return [
            'periodo' => [
                'anio' => $anio,
                'mes_desde' => $mesDesde,
                'mes_hasta' => $mesHasta,
                'desde' => $inicioRangoVisible->toDateString(),
                'hasta' => $finRangoVisible->toDateString(),
                'comparacion' => [
                    'mes_actual_clave' => $claveMesActualComp,
                    'mes_actual_etiqueta' => self::NOMBRES_MESES_CORTOS[$fechaMesReferencia->month] . ' ' . $fechaMesReferencia->year,
                    'mes_anterior_clave' => $claveMesAnteriorComp,
                    'mes_anterior_etiqueta' => self::NOMBRES_MESES_CORTOS[$fechaMesAnterior->month] . ' ' . $fechaMesAnterior->year,
                ],
            ],
            'meses' => $columnasMeses,
            'productos' => $productosFinales,
            'fila_total' => [
                'por_mes' => $totalesPorMes,
                'total_unidades' => $granTotalUnidades,
                'unidades_mes_comparado' => $totalGeneralMesActualComp,
                'unidades_mes_anterior' => $totalGeneralMesAnteriorComp,
                'variacion_pct' => $variacionTotalGeneral,
                'total_productos' => count($productosFinales),
            ],
        ];
    }

    /**
     * Calcula la variación porcentual de $actual respecto de $anterior.
     * - Si ambos son 0 -> 0.0
     * - Si $anterior es 0 y $actual > 0 -> null (crecimiento desde base 0 / nuevo)
     */
    private function calcularVariacionPorcentual(int $actual, int $anterior): ?float
    {
        if ($anterior === 0) {
            return $actual === 0 ? 0.0 : null;
        }

        return round((($actual - $anterior) / $anterior) * 100, 1);
    }
}
