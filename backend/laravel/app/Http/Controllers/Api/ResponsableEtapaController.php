<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ResponsableEtapa;
use App\Models\Pedido;
use App\Models\EtapaProducto;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Http\JsonResponse;

class ResponsableEtapaController extends Controller
{
    /**
     * Listar asignaciones de tareas (Supervisor).
     */
    public function index(Request $request): JsonResponse
    {
        $query = ResponsableEtapa::with([
            'pedido.cliente',
            'etapaProducto.producto',
            'etapaProducto.etapa',
            'user'
        ]);

        if ($request->has('pedido_id')) {
            $query->where('pedido_id', $request->input('pedido_id'));
        }

        if ($request->has('user_id')) {
            $query->where('user_id', $request->input('user_id'));
        }

        if ($request->has('estado')) {
            $query->where('estado', $request->input('estado'));
        }

        if ($request->has('fecha_desde') && !empty($request->input('fecha_desde'))) {
            $desde = $request->input('fecha_desde');
            $query->where(function ($q) use ($desde) {
                $q->whereDate('fecha_fin', '>=', $desde)
                  ->orWhere(function ($q2) use ($desde) {
                      $q2->whereNull('fecha_fin')->whereDate('updated_at', '>=', $desde);
                  });
            });
        }

        if ($request->has('fecha_hasta') && !empty($request->input('fecha_hasta'))) {
            $hasta = $request->input('fecha_hasta');
            $query->where(function ($q) use ($hasta) {
                $q->whereDate('fecha_fin', '<=', $hasta)
                  ->orWhere(function ($q2) use ($hasta) {
                      $q2->whereNull('fecha_fin')->whereDate('updated_at', '<=', $hasta);
                  });
            });
        }

        $currentUser = auth()->user();
        if ($currentUser && in_array($currentUser->role?->slug, ['operario', 'operator', 'encargado', 'supervisor'])) {
            $query->whereHas('pedido.ultimoEstado', function ($q) {
                $q->where('estado', '!=', 'pendiente');
            });
        }

        $asignaciones = $query->latest()->get();

        foreach ($asignaciones as $item) {
            $ep = $item->etapaProducto;
            if ($ep) {
                $item->setAttribute('etapa', [
                    'id' => $ep->id,
                    'nombre' => $ep->etapa->nombre ?? '',
                    'orden' => $ep->orden,
                    'producto_id' => $ep->producto_id,
                    'producto' => $ep->producto,
                ]);
            }
        }

        return response()->json([
            'status' => 'success',
            'data' => $asignaciones
        ]);
    }

    /**
     * Crear o reasignar una tarea de etapa a un operario (Supervisor).
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'pedido_id' => 'required|exists:pedidos,id',
            'etapa_producto_id' => 'nullable|exists:etapas_productos,id',
            'etapa_id' => 'nullable|exists:etapas_productos,id',
            'user_id' => 'required|exists:users,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Error de validación',
                'errors' => $validator->errors()
            ], 422);
        }

        $etapaProductoId = $request->input('etapa_producto_id') ?? $request->input('etapa_id');
        if (!$etapaProductoId) {
            return response()->json([
                'status' => 'error',
                'message' => 'Debe proporcionar etapa_producto_id'
            ], 422);
        }

        $pedido = Pedido::find($request->input('pedido_id'));
        $etapaProducto = EtapaProducto::find($etapaProductoId);
        $user = User::find($request->input('user_id'));

        // 1. Verificar si el usuario es un operario
        if (!$user->isOperator()) {
            return response()->json([
                'status' => 'error',
                'message' => 'El usuario asignado debe tener el rol de operario'
            ], 422);
        }

        // 2. Verificar que la etapa pertenece a un producto asociado al pedido
        $pedidoProductIds = $pedido->productos()->pluck('productos.id')->toArray();
        if (!in_array($etapaProducto->producto_id, $pedidoProductIds)) {
            return response()->json([
                'status' => 'error',
                'message' => 'La etapa seleccionada no pertenece a ningún producto de este pedido'
            ], 422);
        }

        // 3. Crear o actualizar la asignación de la tarea
        $asignacion = ResponsableEtapa::updateOrCreate(
            [
                'pedido_id' => $pedido->id,
                'etapa_producto_id' => $etapaProducto->id,
            ],
            [
                'user_id' => $user->id,
                'estado' => $request->input('estado', 'pendiente'),
            ]
        );

        $asignacion->load(['pedido.cliente', 'etapaProducto.producto', 'etapaProducto.etapa', 'user']);

        return response()->json([
            'status' => 'success',
            'message' => 'Tarea asignada correctamente al operario',
            'data' => $asignacion
        ], 200);
    }

    /**
     * Desasignar o eliminar una tarea (Supervisor).
     */
    public function destroy($id): JsonResponse
    {
        $asignacion = ResponsableEtapa::find($id);

        if (!$asignacion) {
            return response()->json([
                'status' => 'error',
                'message' => 'Asignación no encontrada'
            ], 404);
        }

        $asignacion->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Tarea desasignada/eliminada correctamente'
        ]);
    }
}
