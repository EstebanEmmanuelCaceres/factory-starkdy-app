<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ResponsableEtapa;
use App\Models\EtapaProducto;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;
use Illuminate\Http\JsonResponse;

class OperarioTaskController extends Controller
{
    /**
     * Listar tareas pendientes asignadas al operario autenticado.
     */
    public function index(Request $request): JsonResponse
    {
        /** @var User|null $user */
        $user = Auth::user();

        $query = ResponsableEtapa::with([
            'pedido.cliente',
            'etapaProducto.producto',
            'etapaProducto.etapa.categorias',
            'etapaProducto.dependencias.etapa',
            'user'
        ])
            ->whereIn('estado', ['pendiente', 'en_progreso', 'bloqueada'])
            ->whereHas('pedido.ultimoEstado', function ($q) {
                $q->where('estado', '!=', 'pendiente');
            });

        if ($user && !$user->isAdminOrEncargado()) {
            $userCategoryIds = $user->categorias()->pluck('categorias.id')->toArray();

            $query->where(function ($q) use ($user, $userCategoryIds) {
                $q->where('user_id', $user->id);

                if (!empty($userCategoryIds)) {
                    $q->orWhereHas('etapaProducto.etapa.categorias', function ($cq) use ($userCategoryIds) {
                        $cq->whereIn('categorias.id', $userCategoryIds);
                    });
                }
            });
        } elseif ($request->filled('user_id')) {
            $targetUser = User::find($request->input('user_id'));
            if ($targetUser && !$targetUser->isAdminOrEncargado()) {
                $targetCategoryIds = $targetUser->categorias()->pluck('categorias.id')->toArray();
                $query->where(function ($q) use ($targetUser, $targetCategoryIds) {
                    $q->where('user_id', $targetUser->id);

                    if (!empty($targetCategoryIds)) {
                        $q->orWhereHas('etapaProducto.etapa.categorias', function ($cq) use ($targetCategoryIds) {
                            $cq->whereIn('categorias.id', $targetCategoryIds);
                        });
                    }
                });
            }
        }

        $tasks = $query->orderBy('created_at', 'asc')->get();

        foreach ($tasks as $task) {
            $depsInfo = [];
            $ep = $task->etapaProducto;

            if ($ep) {
                $deps = $ep->dependencias;

                if ($deps && $deps->count() > 0) {
                    foreach ($deps as $dep) {
                        $tareaPrevia = ResponsableEtapa::where('pedido_id', $task->pedido_id)
                            ->where('etapa_producto_id', $dep->id)
                            ->first();

                        $depsInfo[] = [
                            'id' => $dep->id,
                            'nombre' => $dep->etapa->nombre ?? 'Etapa',
                            'estado' => $tareaPrevia ? $tareaPrevia->estado : 'pendiente'
                        ];
                    }
                } else {
                    $etapaAnterior = EtapaProducto::where('producto_id', $ep->producto_id)
                        ->where('orden', '<', $ep->orden)
                        ->orderBy('orden', 'desc')
                        ->first();

                    if ($etapaAnterior) {
                        $tareaPrevia = ResponsableEtapa::where('pedido_id', $task->pedido_id)
                            ->where('etapa_producto_id', $etapaAnterior->id)
                            ->first();

                        $depsInfo[] = [
                            'id' => $etapaAnterior->id,
                            'nombre' => $etapaAnterior->etapa->nombre ?? 'Etapa',
                            'estado' => $tareaPrevia ? $tareaPrevia->estado : 'pendiente'
                        ];
                    }
                }
            }

            $task->setAttribute('dependencias_info', $depsInfo);
            // Compatibilidad de estructura: mapear etapa para que contenga producto y nombre de etapa maestro
            if ($ep) {
                $task->setAttribute('etapa', [
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
            'data' => $tasks
        ]);
    }

    /**
     * Marcar una tarea asignada como "en_progreso".
     */
    public function start($id): JsonResponse
    {
        $user = Auth::user();
        if ($user && ($user->isAdmin() || $user->isEncargado() || $user->isSupervisor())) {
            $task = ResponsableEtapa::find($id);
        } else {
            $task = ResponsableEtapa::where('id', $id)
                ->where('user_id', $user?->id)
                ->first();
        }

        if (!$task) {
            return response()->json([
                'status' => 'error',
                'message' => 'Tarea no encontrada o no está asignada a tu usuario'
            ], 404);
        }

        if ($task->estado === 'bloqueada' || $task->isBlockedByDependencies()) {
            if ($task->estado !== 'bloqueada') {
                $task->update(['estado' => 'bloqueada']);
            }
            return response()->json([
                'status' => 'error',
                'message' => 'Esta tarea se encuentra bloqueada porque requiere que se completen las etapas previas'
            ], 422);
        }

        if ($task->estado !== 'pendiente') {
            return response()->json([
                'status' => 'error',
                'message' => 'La tarea ya se encuentra en progreso o completada'
            ], 422);
        }

        $updateData = [
            'estado' => 'en_progreso',
            'fecha_inicio' => now(),
        ];

        if (empty($task->user_id) && $user) {
            $updateData['user_id'] = $user->id;
        }

        $task->update($updateData);

        return response()->json([
            'status' => 'success',
            'message' => 'Tarea iniciada correctamente',
            'data' => $task
        ]);
    }

    /**
     * Marcar una tarea asignada como "completado" e insertar en el historial.
     */
    public function complete(Request $request, $id): JsonResponse
    {
        $user = Auth::user();
        $task = ResponsableEtapa::find($id);

        if (!$task) {
            return response()->json([
                'status' => 'error',
                'message' => 'Tarea no encontrada'
            ], 404);
        }

        if ($task->estado === 'bloqueada' || $task->isBlockedByDependencies()) {
            if ($task->estado !== 'bloqueada') {
                $task->update(['estado' => 'bloqueada']);
            }
            return response()->json([
                'status' => 'error',
                'message' => 'No puedes completar esta etapa porque requiere que se completen las etapas previas'
            ], 422);
        }

        if ($task->estado === 'completado') {
            return response()->json([
                'status' => 'error',
                'message' => 'La tarea ya ha sido completada anteriormente'
            ], 422);
        }

        $fechaInicio = $task->fecha_inicio ?? now();

        $updateData = [
            'estado' => 'completado',
            'fecha_inicio' => $fechaInicio,
            'fecha_fin' => now(),
        ];

        if (empty($task->user_id) && $user) {
            $updateData['user_id'] = $user->id;
        }

        $task->update($updateData);

        return response()->json([
            'status' => 'success',
            'message' => 'Tarea completada correctamente',
            'data' => [
                'task' => $task
            ]
        ]);
    }

    /**
     * Consultar el historial de producción del operario autenticado.
     */
    public function historial(): JsonResponse
    {
        $userId = Auth::id();

        $historial = ResponsableEtapa::with([
            'pedido.cliente',
            'etapaProducto.producto',
            'etapaProducto.etapa'
        ])
            ->where('user_id', $userId)
            ->where('estado', 'completado')
            ->orderBy('fecha_fin', 'desc')
            ->get();

        foreach ($historial as $task) {
            $ep = $task->etapaProducto;
            if ($ep) {
                $task->setAttribute('etapa', [
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
            'data' => $historial
        ]);
    }

    /**
     * Cancelar una tarea iniciada (restablecer a pendiente).
     */
    public function cancel($id): JsonResponse
    {
        $task = ResponsableEtapa::find($id);

        if (!$task) {
            return response()->json([
                'status' => 'error',
                'message' => 'Tarea no encontrada'
            ], 404);
        }

        if ($task->estado !== 'en_progreso') {
            return response()->json([
                'status' => 'error',
                'message' => 'Solo se pueden cancelar tareas que se encuentran en progreso'
            ], 422);
        }

        $task->update([
            'estado' => 'pendiente',
            'fecha_inicio' => null,
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Tarea cancelada y restablecida a pendiente',
            'data' => $task
        ]);
    }

    /**
     * Listar las últimas 10 tareas para una categoría seleccionada (disponible para todos los roles).
     */
    public function tasksPorCategoria(Request $request): JsonResponse
    {
        $categoriaId = $request->input('categoria_id');

        if (!$categoriaId) {
            return response()->json([
                'status' => 'success',
                'data' => []
            ]);
        }

        // 1. Obtener los nombres de los usuarios habilitados para esta categoría
        $usuariosHabilitados = User::whereHas('categorias', function ($q) use ($categoriaId) {
            $q->where('categorias.id', $categoriaId);
        })->pluck('name')->toArray();

        // 2. Obtener las últimas 10 tareas pertenecientes a la categoría seleccionada
        $query = ResponsableEtapa::with([
            'pedido.cliente',
            'etapaProducto.producto',
            'etapaProducto.etapa',
            'etapaProducto.dependencias.etapa',
            'user'
        ])
            ->whereIn('estado', ['pendiente'])
            ->whereHas('etapaProducto.etapa.categorias', function ($q) use ($categoriaId) {
                $q->where('categorias.id', $categoriaId);
            })
            ->whereHas('pedido.ultimoEstado', function ($q) {
                $q->where('estado', '!=', 'pendiente');
            });

        $tasks = $query->orderBy('created_at', 'desc')->take(10)->get();

        $formattedTasks = [];

        foreach ($tasks as $task) {
            $ep = $task->etapaProducto;
            $fechaFinEtapaAnterior = null;

            if ($ep) {
                $deps = $ep->dependencias;

                if ($deps && $deps->count() > 0) {
                    $tareaPrevia = ResponsableEtapa::where('pedido_id', $task->pedido_id)
                        ->whereIn('etapa_producto_id', $deps->pluck('id'))
                        ->where('estado', 'completado')
                        ->whereNotNull('fecha_fin')
                        ->orderBy('fecha_fin', 'desc')
                        ->first();

                    if ($tareaPrevia) {
                        $fechaFinEtapaAnterior = $tareaPrevia->fecha_fin;
                    }
                } else {
                    $etapaAnterior = EtapaProducto::where('producto_id', $ep->producto_id)
                        ->where('orden', '<', $ep->orden)
                        ->orderBy('orden', 'desc')
                        ->first();

                    if ($etapaAnterior) {
                        $tareaPrevia = ResponsableEtapa::where('pedido_id', $task->pedido_id)
                            ->where('etapa_producto_id', $etapaAnterior->id)
                            ->where('estado', 'completado')
                            ->first();

                        if ($tareaPrevia) {
                            $fechaFinEtapaAnterior = $tareaPrevia->fecha_fin;
                        }
                    }
                }
            }

            $cliente = $task->pedido?->cliente;
            $nombrePedido = $cliente?->nombre_empresa
                ?: ($cliente?->nombre_cliente
                    ?: ('Pedido #' . $task->pedido_id));

            $formattedTasks[] = [
                'id' => $task->id,
                'pedido_id' => $task->pedido_id,
                'nombre_pedido' => $nombrePedido,
                'nombre_etapa' => $ep?->etapa?->nombre ?? 'N/A',
                'user_asignado' => $task->user?->name ?? 'Sin Asignar',
                'usuarios_habilitados' => $usuariosHabilitados,
                'fecha_fin_etapa_anterior' => $fechaFinEtapaAnterior,
                'estado' => $task->estado,
            ];
        }

        return response()->json([
            'status' => 'success',
            'data' => $formattedTasks
        ]);
    }
}
