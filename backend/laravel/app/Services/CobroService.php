<?php

namespace App\Services;

use App\Exceptions\CobroException;
use App\Models\Pago;
use App\Models\Pedido;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

/**
 * Lógica de negocio de los cobros (tabla pagos).
 *
 * Reglas:
 * - Un cobro activo nunca puede superar el saldo pendiente del pedido.
 * - Los cobros no se borran: cancelar los pasa a estado 'anulado' (trazabilidad).
 * - Un cobro anulado no se puede editar ni volver a cancelar.
 */
class CobroService
{
    // Listado: solo las columnas y relaciones que usa la tabla (ver CobroListResource)
    private const COLUMNAS_LISTA = ['id', 'pedido_id', 'vendedor_id', 'monto', 'medio_pago', 'medio', 'tipo_cobro', 'estado', 'fecha_pago', 'pagado_at', 'created_at'];
    private const RELACIONES_LISTA = ['pedido:id,codigo,cliente_id', 'pedido.cliente:id,nombre_cliente,nombre_empresa', 'vendedor:id,name'];

    // Detalle: lo que muestra el modal y necesita el formulario de edición (ver CobroResource)
    private const RELACIONES_DETALLE = ['pedido:id,codigo,cliente_id,precio', 'pedido.cliente:id,nombre_cliente,nombre_empresa', 'vendedor:id,name', 'user:id,name'];

    /**
     * Lista paginada de cobros con filtros opcionales.
     *
     * @param array{pedido_id?:int, vendedor_id?:int, estado?:string, medio_pago?:string, tipo_cobro?:string, fecha_desde?:string, fecha_hasta?:string, orden?:string, per_page?:int} $filtros
     */
    public function listar(array $filtros): LengthAwarePaginator
    {
        return $this->consultaFiltrada($filtros)
            ->select(self::COLUMNAS_LISTA)
            ->with(self::RELACIONES_LISTA)
            ->ordenarPorFechaCobro($filtros['orden'] ?? 'desc')
            ->paginate($filtros['per_page'] ?? 20);
    }

    /**
     * Total efectivamente cobrado (solo estado 'pagado') con los mismos filtros del listado.
     */
    public function totalCobrado(array $filtros): float
    {
        return (float) $this->consultaFiltrada($filtros)
            ->where('estado', Pago::ESTADO_PAGADO)
            ->sum('monto');
    }

    /**
     * Búsqueda de cobros por pedido (código) o cliente (nombre / empresa).
     * Independiente de los filtros del listado: busca en todos los cobros, de cualquier fecha y estado.
     *
     * @return array{cobros: \Illuminate\Database\Eloquent\Collection, total: int, total_cobrado: float}
     */
    public function buscarPorPedido(string $termino, string $orden = 'desc', int $limite = 100): array
    {
        $like = '%' . mb_strtolower(trim($termino)) . '%';

        $consulta = Pago::query()->whereHas('pedido', function (Builder $q) use ($like) {
            $q->whereRaw('LOWER(codigo) LIKE ?', [$like])
                ->orWhereHas('cliente', function (Builder $c) use ($like) {
                    $c->whereRaw('LOWER(nombre_cliente) LIKE ?', [$like])
                        ->orWhereRaw('LOWER(nombre_empresa) LIKE ?', [$like]);
                });
        });

        return [
            'cobros' => (clone $consulta)
                ->select(self::COLUMNAS_LISTA)
                ->with(self::RELACIONES_LISTA)
                ->ordenarPorFechaCobro($orden)
                ->limit($limite)
                ->get(),
            'total' => (clone $consulta)->count(),
            'total_cobrado' => (float) (clone $consulta)->where('estado', Pago::ESTADO_PAGADO)->sum('monto'),
        ];
    }

    /**
     * Encabezados del CSV de exportación (mismo orden que las filas de filasExportacion()).
     */
    public const COLUMNAS_EXPORTACION = [
        'ID',
        'Fecha de cobro',
        'Pedido',
        'Cliente',
        'Empresa',
        'Vendedor',
        'Medio de pago',
        'Tipo',
        'Monto',
        'Estado',
        'Referencia',
        'Observaciones',
    ];

    private const ETIQUETAS_MEDIO = [
        'efectivo' => 'Efectivo',
        'transferencia' => 'Transferencia',
        'tarjeta' => 'Tarjeta',
        'mercado_pago' => 'Mercado Pago',
        'otro' => 'Otro',
    ];
    private const ETIQUETAS_TIPO = ['seña' => 'Seña', 'parcial' => 'Parcial', 'saldo' => 'Saldo', 'unico' => 'Pago único'];
    private const ETIQUETAS_ESTADO = ['pagado' => 'Pagado', 'pendiente' => 'Pendiente', 'anulado' => 'Anulado'];

    /**
     * Filas para exportar a CSV: mismos filtros y orden que listar(), pero sin paginar.
     * Se recorre con lazy() para no cargar todos los cobros en memoria de una vez.
     *
     * @return \Generator<int, array<int, string|int>>
     */
    public function filasExportacion(array $filtros): \Generator
    {
        $cobros = $this->consultaFiltrada($filtros)
            ->select(array_merge(self::COLUMNAS_LISTA, ['referencia_externa', 'observaciones']))
            ->with(self::RELACIONES_LISTA)
            ->ordenarPorFechaCobro($filtros['orden'] ?? 'desc')
            ->lazy(500);

        foreach ($cobros as $cobro) {
            $medio = $cobro->medio_pago ?? $cobro->medio;
            $fecha = $cobro->fecha_pago ?? $cobro->pagado_at ?? $cobro->created_at;

            yield [
                $cobro->id,
                $fecha?->format('d/m/Y') ?? '',
                $cobro->pedido?->codigo ?? '',
                $cobro->pedido?->cliente?->nombre_cliente ?? '',
                $cobro->pedido?->cliente?->nombre_empresa ?? '',
                $cobro->vendedor?->name ?? '',
                self::ETIQUETAS_MEDIO[$medio] ?? ($medio ?? ''),
                self::ETIQUETAS_TIPO[$cobro->tipo_cobro] ?? ($cobro->tipo_cobro ?? ''),
                number_format((float) $cobro->monto, 2, ',', ''),
                self::ETIQUETAS_ESTADO[$cobro->estado] ?? $cobro->estado,
                $cobro->referencia_externa ?? '',
                $cobro->observaciones ?? '',
            ];
        }
    }

    private function consultaFiltrada(array $filtros): Builder
    {
        return Pago::query()
            ->when($filtros['pedido_id'] ?? null, fn($q, $id) => $q->where('pedido_id', $id))
            ->when($filtros['vendedor_id'] ?? null, fn($q, $id) => $q->delVendedor($id))
            ->when($filtros['estado'] ?? null, fn($q, $estado) => $q->where('estado', $estado))
            ->when($filtros['medio_pago'] ?? null, fn($q, $medio) => $q->where('medio_pago', $medio))
            ->when($filtros['tipo_cobro'] ?? null, fn($q, $tipo) => $q->where('tipo_cobro', $tipo))
            ->fechaCobroEntre($filtros['fecha_desde'] ?? null, $filtros['fecha_hasta'] ?? null);
    }

    public function obtener(Pago $cobro): Pago
    {
        return $cobro->load(self::RELACIONES_DETALLE);
    }

    public function crear(array $datos): Pago
    {
        return DB::transaction(function () use ($datos) {
            // Lock del pedido para que dos cobros simultáneos no superen el saldo
            $pedido = Pedido::lockForUpdate()->findOrFail($datos['pedido_id']);

            $this->validarMonto($pedido, (float) $datos['monto']);

            $fechaPago = $datos['fecha_pago'] ?? now();
            $usuarioId = Auth::id();

            $cobro = $pedido->pagos()->create([
                'monto' => $datos['monto'],
                'medio_pago' => $datos['medio_pago'],
                'medio' => $datos['medio_pago'], // compatibilidad
                'tipo_cobro' => $datos['tipo_cobro'],
                'observaciones' => $datos['observaciones'] ?? null,
                'referencia_externa' => $datos['referencia_externa'] ?? null,
                'comprobante_url' => $datos['comprobante_url'] ?? null,
                'fecha_pago' => $fechaPago,
                'pagado_at' => $fechaPago, // compatibilidad
                'estado' => Pago::ESTADO_PAGADO,
                'moneda' => 'ARS',
                'registrado_por' => $usuarioId,
                // Si no se indica, el cobro se atribuye al vendedor del pedido
                'vendedor_id' => $datos['vendedor_id'] ?? $pedido->user_id ?? $usuarioId,
            ]);

            return $this->obtener($cobro);
        });
    }

    public function actualizar(Pago $cobro, array $datos): Pago
    {
        $this->asegurarNoAnulado($cobro, 'editar');

        return DB::transaction(function () use ($cobro, $datos) {
            if (array_key_exists('monto', $datos)) {
                $pedido = Pedido::lockForUpdate()->findOrFail($cobro->pedido_id);
                // El saldo disponible no cuenta el monto actual de este mismo cobro
                $this->validarMonto($pedido, (float) $datos['monto'], $cobro);
            }

            // Mantener sincronizados los campos de compatibilidad
            if (array_key_exists('medio_pago', $datos)) {
                $datos['medio'] = $datos['medio_pago'];
            }
            if (array_key_exists('fecha_pago', $datos)) {
                $datos['pagado_at'] = $datos['fecha_pago'];
            }

            $cobro->update($datos);

            return $this->obtener($cobro->refresh());
        });
    }

    public function cancelar(Pago $cobro, ?string $motivo = null): Pago
    {
        $this->asegurarNoAnulado($cobro, 'cancelar');

        $observaciones = $cobro->observaciones;
        if ($motivo) {
            $nota = 'Cancelado: ' . $motivo;
            $observaciones = $observaciones ? $observaciones . "\n" . $nota : $nota;
        }

        $cobro->update([
            'estado' => Pago::ESTADO_ANULADO,
            'observaciones' => $observaciones,
        ]);

        return $this->obtener($cobro->refresh());
    }

    /**
     * El monto no puede superar el saldo pendiente del pedido.
     * Al editar, se excluye del cálculo el monto actual del cobro que se modifica.
     */
    private function validarMonto(Pedido $pedido, float $monto, ?Pago $cobroEditado = null): void
    {
        $saldoDisponible = (float) $pedido->saldo_pendiente;
        if ($cobroEditado && $cobroEditado->estado === Pago::ESTADO_PAGADO) {
            $saldoDisponible += (float) $cobroEditado->monto;
        }

        if (round($monto, 2) > round($saldoDisponible, 2)) {
            throw new CobroException(
                'El monto ($' . number_format($monto, 2, ',', '.') . ') supera el saldo pendiente del pedido ($' . number_format($saldoDisponible, 2, ',', '.') . ').',
                ['monto' => ['El monto supera el saldo pendiente del pedido.']]
            );
        }
    }

    private function asegurarNoAnulado(Pago $cobro, string $accion): void
    {
        if ($cobro->estaAnulado()) {
            throw new CobroException(
                "No se puede {$accion} un cobro anulado.",
                ['estado' => ['El cobro ya está anulado.']]
            );
        }
    }
}
