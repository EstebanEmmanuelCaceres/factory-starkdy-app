<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ResponsableEtapa;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;
use Illuminate\Http\JsonResponse;

class OperarioTaskController extends Controller
{
    /**
     * Listar tareas pendientes asignadas al operario autenticado.
     */
    public function index(): JsonResponse
    {
        $userId = Auth::id();

        $tasks = ResponsableEtapa::with([
            'pedido.cliente',
            'etapa.producto',
            'etapa.dependencias'
        ])
            ->where('user_id', $userId)
            ->whereIn('estado', ['pendiente', 'en_progreso', 'bloqueada'])
            ->orderBy('estado', 'desc') // Muestra primero 'en_progreso' que 'pendiente'
            ->get();

        foreach ($tasks as $task) {
            $depsInfo = [];
            if ($task->etapa) {
                $deps = $task->etapa->dependencias;

                if ($deps && $deps->count() > 0) {
                    foreach ($deps as $dep) {
                        $tareaPrevia = ResponsableEtapa::where('pedido_id', $task->pedido_id)
                            ->where('etapa_id', $dep->id)
                            ->first();

                        $depsInfo[] = [
                            'id' => $dep->id,
                            'nombre' => $dep->nombre,
                            'estado' => $tareaPrevia ? $tareaPrevia->estado : 'pendiente'
                        ];
                    }
                } else {
                    // Fallback si no hay dependencias explícitas en etapa_dependencias: buscar etapa anterior por 'orden'
                    $etapaAnterior = \App\Models\Etapa::where('producto_id', $task->etapa->producto_id)
                        ->where('orden', '<', $task->etapa->orden)
                        ->orderBy('orden', 'desc')
                        ->first();

                    if ($etapaAnterior) {
                        $tareaPrevia = ResponsableEtapa::where('pedido_id', $task->pedido_id)
                            ->where('etapa_id', $etapaAnterior->id)
                            ->first();

                        $depsInfo[] = [
                            'id' => $etapaAnterior->id,
                            'nombre' => $etapaAnterior->nombre,
                            'estado' => $tareaPrevia ? $tareaPrevia->estado : 'pendiente'
                        ];
                    }
                }
            }

            $task->setAttribute('dependencias_info', $depsInfo);
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
        $userId = Auth::id();
        $task = ResponsableEtapa::where('id', $id)
            ->where('user_id', $userId)
            ->first();

        if (!$task) {
            return response()->json([
                'status' => 'error',
                'message' => 'Tarea no encontrada o no está asignada a tu usuario'
            ], 404);
        }

        if ($task->estado === 'bloqueada') {
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

        $task->update([
            'estado' => 'en_progreso',
            'fecha_inicio' => now(),
        ]);

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
        $userId = Auth::id();
        $task = ResponsableEtapa::where('id', $id)
            ->where('user_id', $userId)
            ->first();

        if (!$task) {
            return response()->json([
                'status' => 'error',
                'message' => 'Tarea no encontrada o no está asignada a tu usuario'
            ], 404);
        }

        if ($task->estado === 'completado') {
            return response()->json([
                'status' => 'error',
                'message' => 'La tarea ya ha sido completada anteriormente'
            ], 422);
        }

        // Si la tarea no se había marcado en progreso, establecemos fecha_inicio a now
        $fechaInicio = $task->fecha_inicio ?? now();

        // 1. Actualizar el estado de la tarea a completado
        $task->update([
            'estado' => 'completado',
            'fecha_inicio' => $fechaInicio,
            'fecha_fin' => now(),
        ]);

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
            'etapa.producto'
        ])
        ->where('user_id', $userId)
        ->where('estado', 'completado')
        ->orderBy('fecha_fin', 'desc')
        ->get();

        return response()->json([
            'status' => 'success',
            'data' => $historial
        ]);
    }
}
