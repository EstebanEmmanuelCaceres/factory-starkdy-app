<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Pedido;
use App\Models\PedidoProducto;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;

class PedidoController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request): JsonResponse
    {
        $query = Pedido::with(['cliente', 'user', 'productos', 'pago']);

        // Búsqueda opcional por nombre de cliente, empresa o correo del cliente relacionado
        if ($request->filled('search')) {
            $searchTerm = $request->input('search');
            $query->whereHas('cliente', function ($q) use ($searchTerm) {
                $q->where('nombre_cliente', 'like', '%' . $searchTerm . '%')
                  ->orWhere('nombre_empresa', 'like', '%' . $searchTerm . '%')
                  ->orWhere('email', 'like', '%' . $searchTerm . '%');
            });
        }

        // Filtro por estado del pedido
        if ($request->filled('estado')) {
            $query->where('estado', $request->input('estado'));
        }

        // Filtro por prioridad
        if ($request->filled('prioridad')) {
            $query->where('prioridad', $request->input('prioridad'));
        }

        // Filtros por fechas de entrega
        if ($request->filled('fecha_desde')) {
            $query->whereDate('fecha_entrega', '>=', $request->input('fecha_desde'));
        }
        if ($request->filled('fecha_hasta')) {
            $query->whereDate('fecha_entrega', '<=', $request->input('fecha_hasta'));
        }

        // Filtro por estado del pago
        if ($request->filled('pago_estado')) {
            $pagoEstado = $request->input('pago_estado');
            if ($pagoEstado === 'sin_pago') {
                $query->whereDoesntHave('pago');
            } else {
                $query->whereHas('pago', function ($q) use ($pagoEstado) {
                    $q->where('estado', $pagoEstado);
                });
            }
        }

        $pedidos = $query->latest()->get();

        return response()->json([
            'status' => 'success',
            'data' => $pedidos
        ]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'cliente_id' => 'required|exists:clientes,id',
            'codigo' => 'required|string|max:255|unique:pedidos,codigo',
            'prioridad' => 'required|string|in:baja,normal,alta,critica',
            'fecha_entrega' => 'nullable|date',
            'dias_vencimiento' => 'nullable|integer|min:0',
            'observaciones' => 'nullable|string',
            'pago_monto' => 'nullable|numeric|min:0',
            'pago_estado' => 'nullable|string|in:pagado,pendiente',
            'productos' => 'nullable|array',
            'productos.*.id' => 'required|exists:productos,id',
            'productos.*.cantidad' => 'required|integer|min:1',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Error de validación',
                'errors' => $validator->errors()
            ], 422);
        }

        $data = $request->only(['cliente_id', 'codigo', 'prioridad', 'fecha_entrega', 'dias_vencimiento', 'observaciones']);
        $data['user_id'] = Auth::id() ?? 1; // Asocia el usuario autenticado
        $data['estado'] = 'pendiente';      // Por defecto al crear

        $pedido = Pedido::create($data);

        // Sincronizar productos si se especifican
        if ($request->has('productos')) {
            $syncData = [];
            foreach ($request->input('productos') as $prod) {
                $syncData[$prod['id']] = ['cantidad' => $prod['cantidad']];
            }
            $pedido->productos()->sync($syncData);
        }

        // Crear pago si se especificó un monto
        if ($request->has('pago_monto') && $request->input('pago_monto') !== null && $request->input('pago_monto') > 0) {
            $pagoEstado = $request->input('pago_estado', 'pendiente');
            $pago = $pedido->pago()->create([
                'registrado_por' => Auth::id() ?? 1,
                'medio' => 'transferencia',
                'estado' => $pagoEstado,
                'monto' => $request->input('pago_monto'),
                'moneda' => 'ARS',
                'pagado_at' => $pagoEstado === 'pagado' ? now() : null,
            ]);
            $pago->intentos()->create([
                'medio' => 'transferencia',
                'estado' => $pagoEstado === 'pagado' ? 'exitoso' : 'pendiente',
            ]);
        }

        // Cargar relaciones para la respuesta
        $pedido->load(['cliente', 'user', 'productos', 'pago']);

        return response()->json([
            'status' => 'success',
            'message' => 'Pedido creado correctamente',
            'data' => $pedido
        ], 201);
    }

    /**
     * Display the specified resource.
     */
    public function show($id): JsonResponse
    {
        $pedido = Pedido::with(['cliente', 'user', 'productos', 'pago'])->find($id);

        if (!$pedido) {
            return response()->json([
                'status' => 'error',
                'message' => 'Pedido no encontrado'
            ], 404);
        }

        return response()->json([
            'status' => 'success',
            'data' => $pedido
        ]);
    }

    /**
     * Update the specified resource in storage (PATCH).
     */
    public function update(Request $request, $id): JsonResponse
    {
        $pedido = Pedido::find($id);

        if (!$pedido) {
            return response()->json([
                'status' => 'error',
                'message' => 'Pedido no encontrado'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'cliente_id' => 'sometimes|required|exists:clientes,id',
            'codigo' => 'sometimes|required|string|max:255|unique:pedidos,codigo,' . $pedido->id,
            'estado' => 'sometimes|required|string',
            'prioridad' => 'sometimes|required|string|in:baja,normal,alta,critica',
            'fecha_entrega' => 'sometimes|nullable|date',
            'dias_vencimiento' => 'sometimes|nullable|integer|min:0',
            'observaciones' => 'sometimes|nullable|string',
            'pago_monto' => 'sometimes|nullable|numeric|min:0',
            'pago_estado' => 'sometimes|nullable|string|in:pagado,pendiente',
            'productos' => 'sometimes|array',
            'productos.*.id' => 'required_with:productos|exists:productos,id',
            'productos.*.cantidad' => 'required_with:productos|integer|min:1',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Error de validación',
                'errors' => $validator->errors()
            ], 422);
        }

        $pedido->update($request->only(['cliente_id', 'codigo', 'estado', 'prioridad', 'fecha_entrega', 'dias_vencimiento', 'observaciones']));

        // Sincronizar productos si se enviaron
        if ($request->has('productos')) {
            $syncData = [];
            foreach ($request->input('productos') as $prod) {
                $syncData[$prod['id']] = ['cantidad' => $prod['cantidad']];
            }
            $pedido->productos()->sync($syncData);
        }

        // Crear o actualizar pago
        if ($request->has('pago_monto')) {
            $monto = $request->input('pago_monto');
            $pagoEstado = $request->input('pago_estado', 'pendiente');
            if ($monto !== null && $monto > 0) {
                $pago = $pedido->pago;
                if ($pago) {
                    $pago->update([
                        'monto' => $monto,
                        'estado' => $pagoEstado,
                        'registrado_por' => Auth::id() ?? 1,
                        'pagado_at' => $pagoEstado === 'pagado' ? ($pago->pagado_at ?? now()) : null,
                    ]);
                    $pago->intentos()->create([
                        'medio' => 'transferencia',
                        'estado' => $pagoEstado === 'pagado' ? 'exitoso' : 'pendiente',
                    ]);
                } else {
                    $pago = $pedido->pago()->create([
                        'registrado_por' => Auth::id() ?? 1,
                        'medio' => 'transferencia',
                        'estado' => $pagoEstado,
                        'monto' => $monto,
                        'moneda' => 'ARS',
                        'pagado_at' => $pagoEstado === 'pagado' ? now() : null,
                    ]);
                    $pago->intentos()->create([
                        'medio' => 'transferencia',
                        'estado' => $pagoEstado === 'pagado' ? 'exitoso' : 'pendiente',
                    ]);
                }
            } else {
                if ($pedido->pago) {
                    $pedido->pago->intentos()->delete();
                    $pedido->pago->delete();
                }
            }
        } elseif ($request->has('pago_estado') && $pedido->pago) {
            // Si solo se cambia el estado del pago
            $pagoEstado = $request->input('pago_estado');
            $pedido->pago->update([
                'estado' => $pagoEstado,
                'pagado_at' => $pagoEstado === 'pagado' ? ($pedido->pago->pagado_at ?? now()) : null,
            ]);
            $pedido->pago->intentos()->create([
                'medio' => 'transferencia',
                'estado' => $pagoEstado === 'pagado' ? 'exitoso' : 'pendiente',
            ]);
        }

        $pedido->load(['cliente', 'user', 'productos', 'pago']);

        return response()->json([
            'status' => 'success',
            'message' => 'Pedido actualizado correctamente',
            'data' => $pedido
        ]);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy($id): JsonResponse
    {
        $pedido = Pedido::find($id);

        if (!$pedido) {
            return response()->json([
                'status' => 'error',
                'message' => 'Pedido no encontrado'
            ], 404);
        }

        // Borrado lógico de las filas en la tabla intermedia pedido_productos
        PedidoProducto::where('pedido_id', $pedido->id)->delete();

        // Borrado lógico del pedido
        $pedido->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Pedido eliminado correctamente'
        ]);
    }
}
