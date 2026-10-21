<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\CobroListResource;
use App\Http\Resources\CobroResource;
use App\Models\Pago;
use App\Services\CobroService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * CRUD de cobros (solo admin; lo asegura el middleware 'admin' en routes/api.php).
 * El controlador valida la entrada y delega: reglas de negocio en CobroService
 * y formato de salida en CobroListResource (listado) y CobroResource (detalle).
 */
class CobroController extends Controller
{
    public function __construct(private readonly CobroService $cobroService) {}

    /**
     * Reglas de los filtros del listado; las comparten index() y export().
     */
    private function reglasFiltros(): array
    {
        return [
            'pedido_id' => 'nullable|integer|exists:pedidos,id',
            'vendedor_id' => 'nullable|integer|exists:users,id',
            'estado' => ['nullable', Rule::in(Pago::ESTADOS)],
            'medio_pago' => 'nullable|string|max:255',
            'tipo_cobro' => ['nullable', Rule::in(Pago::TIPOS_COBRO)],
            'fecha_desde' => 'nullable|date',
            'fecha_hasta' => 'nullable|date|after_or_equal:fecha_desde',
            'orden' => 'nullable|in:asc,desc',
        ];
    }

    public function index(Request $request): JsonResponse
    {
        $filtros = $request->validate($this->reglasFiltros() + [
            'per_page' => 'nullable|integer|between:1,100',
        ]);

        $cobros = $this->cobroService->listar($filtros);

        return response()->json([
            'status' => 'success',
            'data' => CobroListResource::collection($cobros->items()),
            'meta' => [
                'current_page' => $cobros->currentPage(),
                'last_page' => $cobros->lastPage(),
                'per_page' => $cobros->perPage(),
                'total' => $cobros->total(),
                'total_cobrado' => round($this->cobroService->totalCobrado($filtros), 2),
            ],
        ]);
    }

    /**
     * Exporta a CSV todos los cobros que cumplen los filtros (sin paginar), en el mismo orden que el listado.
     * Separador ';' y BOM UTF-8 para que Excel en español lo abra con columnas y acentos correctos.
     */
    public function export(Request $request): StreamedResponse
    {
        $filtros = $request->validate($this->reglasFiltros());
        $nombre = 'cobros_' . ($filtros['fecha_desde'] ?? 'inicio') . '_' . ($filtros['fecha_hasta'] ?? 'hoy') . '.csv';

        return response()->streamDownload(function () use ($filtros) {
            $salida = fopen('php://output', 'w');
            fwrite($salida, "\xEF\xBB\xBF");
            fputcsv($salida, CobroService::COLUMNAS_EXPORTACION, ';');
            foreach ($this->cobroService->filasExportacion($filtros) as $fila) {
                fputcsv($salida, $fila, ';');
            }
            fclose($salida);
        }, $nombre, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    /**
     * Buscador por pedido o cliente. No usa los filtros del listado (fechas, vendedor, estado, etc.).
     */
    public function search(Request $request): JsonResponse
    {
        $datos = $request->validate([
            'q' => 'required|string|min:2|max:100',
            'orden' => 'nullable|in:asc,desc',
        ], [
            'q.required' => 'Ingresá un pedido o cliente para buscar.',
            'q.min' => 'Ingresá al menos 2 caracteres.',
        ]);

        $resultado = $this->cobroService->buscarPorPedido($datos['q'], $datos['orden'] ?? 'desc');

        return response()->json([
            'status' => 'success',
            'data' => CobroListResource::collection($resultado['cobros']),
            'meta' => [
                // total puede ser mayor que la cantidad devuelta (se devuelven como máximo 100)
                'total' => $resultado['total'],
                'total_cobrado' => round($resultado['total_cobrado'], 2),
            ],
        ]);
    }

    public function show(Pago $cobro): JsonResponse
    {
        return response()->json([
            'status' => 'success',
            'data' => new CobroResource($this->cobroService->obtener($cobro)),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $datos = $request->validate([
            'pedido_id' => 'required|integer|exists:pedidos,id',
            'monto' => 'required|numeric|min:0.01',
            'medio_pago' => 'required|string|max:255',
            'tipo_cobro' => ['required', Rule::in(Pago::TIPOS_COBRO)],
            'fecha_pago' => 'nullable|date',
            'vendedor_id' => 'nullable|integer|exists:users,id',
            'observaciones' => 'nullable|string|max:1000',
            'referencia_externa' => 'nullable|string|max:255',
            'comprobante_url' => 'nullable|url|max:255',
        ], [
            'pedido_id.required' => 'Falta indicar el pedido.',
            'pedido_id.exists' => 'El pedido indicado no existe.',
            'monto.required' => 'Falta ingresar el monto.',
            'monto.min' => 'El monto debe ser mayor a 0.',
            'medio_pago.required' => 'Falta indicar el medio de pago.',
            'tipo_cobro.required' => 'Falta indicar el tipo de cobro.',
            'tipo_cobro.in' => 'El tipo de cobro no es válido.',
        ]);

        $cobro = $this->cobroService->crear($datos);

        return response()->json([
            'status' => 'success',
            'message' => 'Cobro registrado correctamente.',
            'data' => new CobroResource($cobro),
        ], 201);
    }

    public function update(Request $request, Pago $cobro): JsonResponse
    {
        // Todos opcionales (PATCH). No se permite cambiar el pedido ni el estado:
        // para anular un cobro se usa cancel(). Solo los campos validados llegan al servicio.
        $datos = $request->validate([
            'monto' => 'sometimes|required|numeric|min:0.01',
            'medio_pago' => 'sometimes|required|string|max:255',
            'tipo_cobro' => ['sometimes', 'required', Rule::in(Pago::TIPOS_COBRO)],
            'fecha_pago' => 'sometimes|required|date',
            'vendedor_id' => 'sometimes|nullable|integer|exists:users,id',
            'observaciones' => 'sometimes|nullable|string|max:1000',
            'referencia_externa' => 'sometimes|nullable|string|max:255',
            'comprobante_url' => 'sometimes|nullable|url|max:255',
        ], [
            'monto.min' => 'El monto debe ser mayor a 0.',
            'tipo_cobro.in' => 'El tipo de cobro no es válido.',
        ]);

        $cobro = $this->cobroService->actualizar($cobro, $datos);

        return response()->json([
            'status' => 'success',
            'message' => 'Cobro actualizado correctamente.',
            'data' => new CobroResource($cobro),
        ]);
    }

    public function cancel(Request $request, Pago $cobro): JsonResponse
    {
        $datos = $request->validate([
            'motivo' => 'nullable|string|max:500',
        ]);

        $cobro = $this->cobroService->cancelar($cobro, $datos['motivo'] ?? null);

        return response()->json([
            'status' => 'success',
            'message' => 'Cobro cancelado correctamente.',
            'data' => new CobroResource($cobro),
        ]);
    }
}
