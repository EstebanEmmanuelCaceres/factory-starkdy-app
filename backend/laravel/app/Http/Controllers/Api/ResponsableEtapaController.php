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
            $pedidoId = $request->input('pedido_id');
            ResponsableEtapa::unblockAllSatisfiedTasksForPedido($pedidoId);
            $query->where('pedido_id', $pedidoId);
        } else {
            $query->whereHas('pedido.ultimoEstado', function ($q) {
                $q->where('estado', '!=', 'pendiente');
            });
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
            'user_id' => 'nullable|exists:users,id',
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
        $user = $request->filled('user_id') ? User::find($request->input('user_id')) : null;

        // 2. Verificar que la etapa pertenece a un producto asociado al pedido
        $pedidoProductIds = $pedido->productos()->pluck('productos.id')->toArray();
        if (!in_array($etapaProducto->producto_id, $pedidoProductIds)) {
            return response()->json([
                'status' => 'error',
                'message' => 'La etapa seleccionada no pertenece a ningún producto de este pedido'
            ], 422);
        }

        $requestedEstado = $request->input('estado');

        $existingTask = ResponsableEtapa::where('pedido_id', $pedido->id)
            ->where('etapa_producto_id', $etapaProducto->id)
            ->first();

        if ($requestedEstado === 'completado') {
            $tempTask = $existingTask ?? new ResponsableEtapa([
                'pedido_id' => $pedido->id,
                'etapa_producto_id' => $etapaProducto->id,
            ]);

            if ($tempTask->isBlockedByDependencies()) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'No puedes completar esta etapa porque requiere que se completen las etapas previas'
                ], 422);
            }
        }

        // 3. Crear o actualizar la asignación de la tarea
        $asignacion = ResponsableEtapa::updateOrCreate(
            [
                'pedido_id' => $pedido->id,
                'etapa_producto_id' => $etapaProducto->id,
            ],
            [
                'user_id' => $user?->id,
                'estado' => $requestedEstado ?? ($existingTask ? $existingTask->estado : 'pendiente'),
            ]
        );

        $asignacion->load(['pedido.cliente', 'etapaProducto.producto', 'etapaProducto.etapa', 'user']);

        return response()->json([
            'status' => 'success',
            'message' => $user ? 'Tarea asignada correctamente al usuario' : 'Tarea desasignada correctamente',
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

    /**
     * Listar tareas de diseño pendientes/en_progreso para vendedores/diseñadores (o supervisor/admin).
     * Muestra tareas de diseño pendientes de pedidos habilitados para producción.
     */
    public function disenosPendientes(Request $request): JsonResponse
    {
        $currentUser = auth()->user();

        $query = ResponsableEtapa::with([
            'pedido.cliente',
            'pedido.user:id,name',
            'etapaProducto.producto',
            'etapaProducto.etapa',
            'user'
        ])
            ->whereIn('estado', ['pendiente', 'en_progreso'])
            ->whereHas('etapaProducto.etapa', function ($q) {
                $q->where('id', 5)
                  ->orWhereRaw('LOWER(nombre) LIKE ? OR LOWER(nombre) LIKE ?', ['%diseño%', '%diseno%']);
            })
            ->whereHas('pedido.ultimoEstado', function ($q) {
                $q->whereNotIn('estado', ['pendiente', 'cancelado']);
            });

        // Filtrado por usuario si es vendedor únicamente (diseñadores/as ven todas las tareas de diseño)
        if ($currentUser) {
            $userRole = $currentUser->role?->slug;
            if ($userRole === 'vendedor') {
                $query->where(function ($q) use ($currentUser) {
                    $q->where('user_id', $currentUser->id)
                      ->orWhereHas('pedido', function ($pq) use ($currentUser) {
                          $pq->where('user_id', $currentUser->id);
                      });
                });
            }
        }

        // Filtro opcional por vendedor especifico (para admins/supervisores)
        if ($request->has('vendedor_id') && !empty($request->input('vendedor_id'))) {
            $vendedorId = $request->input('vendedor_id');
            $query->where(function ($q) use ($vendedorId) {
                $q->where('user_id', $vendedorId)
                  ->orWhereHas('pedido', function ($pq) use ($vendedorId) {
                      $pq->where('user_id', $vendedorId);
                  });
            });
        }

        $disenos = $query->latest()->get();

        foreach ($disenos as $item) {
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
            'data' => $disenos
        ]);
    }

    /**
     * Completar en lote los diseños seleccionados de un pedido.
     */
    public function completarDisenosPedido(Request $request, $pedidoId): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'task_ids_completadas' => 'nullable|array',
            'task_ids_completadas.*' => 'integer|exists:responsables_etapas,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Error de validación',
                'errors' => $validator->errors()
            ], 422);
        }

        $pedido = Pedido::find($pedidoId);
        if (!$pedido) {
            return response()->json(['status' => 'error', 'message' => 'Pedido no encontrado'], 404);
        }

        $completedTaskIds = $request->input('task_ids_completadas', []);

        // Tareas de diseño pertenecientes a este pedido
        $disenoTasks = ResponsableEtapa::where('pedido_id', $pedidoId)
            ->whereHas('etapaProducto.etapa', function ($q) {
                $q->whereRaw('LOWER(nombre) LIKE ? OR LOWER(nombre) LIKE ?', ['%diseño%', '%diseno%']);
            })
            ->get();

        foreach ($disenoTasks as $task) {
            if (in_array($task->id, $completedTaskIds)) {
                if ($task->estado !== 'completado') {
                    $task->update([
                        'estado' => 'completado',
                        'fecha_inicio' => $task->fecha_inicio ?? now(),
                        'fecha_fin' => now(),
                    ]);
                }
            }
        }

        // Desbloquear etapas dependientes del pedido
        ResponsableEtapa::unblockAllSatisfiedTasksForPedido($pedidoId);

        return response()->json([
            'status' => 'success',
            'message' => 'Diseños del pedido actualizados correctamente'
        ]);
    }
}
