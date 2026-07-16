<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ResponsableEtapa;
use App\Models\Pedido;
use App\Models\Etapa;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\JsonResponse;

class ResponsableEtapaController extends Controller
{
    /**
     * Listar asignaciones de tareas (Supervisor).
     */
    public function index(Request $request): JsonResponse
    {
        $query = ResponsableEtapa::with(['pedido.cliente', 'etapa.producto', 'user']);

        if ($request->has('pedido_id')) {
            $query->where('pedido_id', $request->input('pedido_id'));
        }

        if ($request->has('user_id')) {
            $query->where('user_id', $request->input('user_id'));
        }

        if ($request->has('estado')) {
            $query->where('estado', $request->input('estado'));
        }

        $asignaciones = $query->latest()->get();

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
            'etapa_id' => 'required|exists:etapas,id',
            'user_id' => 'required|exists:users,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Error de validación',
                'errors' => $validator->errors()
            ], 422);
        }

        $pedido = Pedido::find($request->input('pedido_id'));
        $etapa = Etapa::find($request->input('etapa_id'));
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
        if (!in_array($etapa->producto_id, $pedidoProductIds)) {
            return response()->json([
                'status' => 'error',
                'message' => 'La etapa seleccionada no pertenece a ningún producto de este pedido'
            ], 422);
        }

        // 3. Validar si el operario tiene las responsabilidades (skills) requeridas para la etapa
        $requiredCount = DB::table('etapa_responsabilidades')
            ->where('etapa_id', $etapa->id)
            ->count();

        if ($requiredCount > 0) {
            $matchCount = DB::table('user_responsabilidades as ur')
                ->join('etapa_responsabilidades as er', 'er.responsabilidad_id', '=', 'ur.responsabilidad_id')
                ->where('ur.user_id', $user->id)
                ->where('er.etapa_id', $etapa->id)
                ->count();

            if ($matchCount === 0) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'El operario no cuenta con las responsabilidades necesarias para esta etapa'
                ], 422);
            }
        }

        // 4. Crear o actualizar la asignación de la tarea
        $asignacion = ResponsableEtapa::updateOrCreate(
            [
                'pedido_id' => $pedido->id,
                'etapa_id' => $etapa->id,
            ],
            [
                'user_id' => $user->id,
                // Si ya estaba completada o en progreso, conservamos su estado. Si es nueva, es pendiente.
                'estado' => $request->input('estado', 'pendiente'),
            ]
        );

        $asignacion->load(['pedido.cliente', 'etapa.producto', 'user']);

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
