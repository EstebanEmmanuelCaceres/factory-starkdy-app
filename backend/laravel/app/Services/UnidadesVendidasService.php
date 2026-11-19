<?php

namespace App\Services;

use App\Models\User;
use App\Repositories\PedidoProductoRepository;
use Carbon\Carbon;

/**
 * Servicio de lógica de negocio para la matriz mensual de Unidades Vendidas por Producto.
 *
 * Única responsabilidad: recibir los datos crudos de `PedidoProductoRepository` y construir:
 * - Las columnas de meses del rango seleccionado (por defecto: del mes actual a 6 meses hacia atrás)
 * - Las unidades por mes y el total por cada producto
 * - La fila de "Total unidades" por mes y total general
 * - La variación porcentual (%) del último mes cerrado contra su mes inmediato anterior (omitiendo el mes corriente por estar incompleto)
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
     * @param array{anio: int, mes_desde: int|null, mes_hasta: int|null, vendedor_id: int|null} $filtros
     * @return array<string, mixed>
     */
    public function obtenerUnidadesVendidasPorIntervalo(array $filtros, ?User $usuarioActual = null): array
    {
        $ahora = now();
        $anio = (int) ($filtros['anio'] ?? $ahora->year);
        $mesDesde = $filtros['mes_desde'] ?? null;
        $mesHasta = $filtros['mes_hasta'] ?? null;

        // Si no se especificaron meses (o si mes_desde > mes_hasta al cruzar de año),
        // se toma desde el mes actual (o mes_hasta) hacia 6 meses atrás.
        if ($mesDesde === null && $mesHasta === null) {
            $finRangoVisible = Carbon::create($anio, $ahora->month, 1)->endOfMonth()->endOfDay();
            $inicioRangoVisible = $finRangoVisible->copy()->startOfMonth()->subMonthsNoOverflow(5)->startOfDay();
            $mesDesde = $inicioRangoVisible->month;
            $mesHasta = $finRangoVisible->month;
        } else {
            $mesHastaFinal = $mesHasta ?? $ahora->month;
            $mesDesdeFinal = $mesDesde ?? max(1, $mesHastaFinal - 5);

            if ($mesDesdeFinal <= $mesHastaFinal) {
                $inicioRangoVisible = Carbon::create($anio, $mesDesdeFinal, 1)->startOfMonth()->startOfDay();
                $finRangoVisible = Carbon::create($anio, $mesHastaFinal, 1)->endOfMonth()->endOfDay();
            } else {
                // Soporta ventana que cruza del año anterior al año seleccionado (ej. Ago 2025 -> Ene 2026)
                $inicioRangoVisible = Carbon::create($anio - 1, $mesDesdeFinal, 1)->startOfMonth()->startOfDay();
                $finRangoVisible = Carbon::create($anio, $mesHastaFinal, 1)->endOfMonth()->endOfDay();
            }

            $mesDesde = $mesDesdeFinal;
            $mesHasta = $mesHastaFinal;
        }

        $rol = $usuarioActual?->role?->slug;
        $vendedorId = in_array($rol, self::ROLES_SOLO_PROPIOS, true)
            ? $usuarioActual?->id
            : ($filtros['vendedor_id'] ?? null);

        // El mes de referencia para calcular "% vs mes anterior":
        // Dado que el mes corriente (en curso) aún no ha concluido, comparar sus ventas parciales
        // contra el mes anterior produce variaciones distorsionadas e incompletas. Por ello:
        // - Si el rango visible incluye o sobrepasa el mes corriente, se toma como mes de referencia
        //   el último mes cerrado (el mes anterior al corriente) y se compara contra el anterior a ese.
        // - Si el rango es un período histórico del pasado ya concluido, se toma el último mes de dicho
        //   rango cerrado y se compara contra su mes anterior.
        $mesActualReal = $ahora->copy()->startOfMonth();

        if ($finRangoVisible->gte($mesActualReal)) {
            $fechaMesReferencia = $mesActualReal->copy()->subMonthNoOverflow();
        } else {
            $fechaMesReferencia = $finRangoVisible->copy()->startOfMonth();
        }

        $fechaMesAnterior = $fechaMesReferencia->copy()->subMonthNoOverflow()->startOfMonth();

        // Extender la consulta al repositorio si los meses de comparación quedan fuera del rango visible
        $desdeConsulta = $inicioRangoVisible->copy();
        if ($fechaMesAnterior->lt($desdeConsulta)) {
            $desdeConsulta = $fechaMesAnterior->copy()->startOfDay();
        }

        $registros = $this->pedidoProductoRepository->obtenerUnidadesPorProductoYMes(
            $desdeConsulta,
            $finRangoVisible,
            $vendedorId
        );

        // 1. Armar metadatos de las columnas de meses visibles iterando mes a mes
        $columnasMeses = [];
        $totalesPorMes = [];
        $cursorMes = $inicioRangoVisible->copy()->startOfMonth();
        $finCursorMes = $finRangoVisible->copy()->startOfMonth();
        $cruzaAnio = $inicioRangoVisible->year !== $finRangoVisible->year;

        while ($cursorMes->lte($finCursorMes)) {
            $m = $cursorMes->month;
            $y = $cursorMes->year;
            $clave = sprintf('%04d-%02d', $y, $m);
            $etiquetaCorta = $cruzaAnio
                ? self::NOMBRES_MESES_CORTOS[$m] . ' ' . substr((string) $y, -2)
                : self::NOMBRES_MESES_CORTOS[$m];

            $columnasMeses[] = [
                'mes' => $m,
                'anio' => $y,
                'clave' => $clave,
                'etiqueta_corta' => $etiquetaCorta,
                'etiqueta_larga' => self::NOMBRES_MESES_LARGOS[$m] . ' ' . $y,
            ];
            $totalesPorMes[$clave] = 0;
            $cursorMes->addMonthNoOverflow();
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

        // 3. Filtrar productos con ventas en el período visible y calcular su variación %
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

    private function calcularVariacionPorcentual(int $actual, int $anterior): ?float
    {
        if ($anterior === 0) {
            return $actual === 0 ? 0.0 : null;
        }

        return round((($actual - $anterior) / $anterior) * 100, 1);
    }
}
