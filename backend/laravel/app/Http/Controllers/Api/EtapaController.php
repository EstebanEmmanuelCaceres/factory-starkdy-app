<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Etapa;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\JsonResponse;

class EtapaController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request): JsonResponse
    {
        $query = Etapa::query();

        // Filtrado opcional por producto
        if ($request->has('producto_id')) {
            $query->where('producto_id', $request->input('producto_id'));
        }

        // Filtrado opcional por estado
        if ($request->has('estado')) {
            $query->where('estado', $request->input('estado'));
        }

        $etapas = $query->orderBy('posicion', 'asc')->get();

        return response()->json([
            'status' => 'success',
            'data' => $etapas
        ]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'producto_id' => 'required|exists:productos,id',
            'nombre' => 'required|string|max:255',
            'posicion' => 'nullable|integer|min:0',
            'estado' => 'nullable|string|max:50',
            'fecha_inicio' => 'nullable|date',
            'fecha_fin' => 'nullable|date',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Error de validación',
                'errors' => $validator->errors()
            ], 422);
        }

        $etapa = Etapa::create($request->all());

        return response()->json([
            'status' => 'success',
            'message' => 'Etapa creada correctamente',
            'data' => $etapa
        ], 201);
    }

    /**
     * Display the specified resource.
     */
    public function show($id): JsonResponse
    {
        $etapa = Etapa::with(['operarios', 'responsabilidades'])->find($id);

        if (!$etapa) {
            return response()->json([
                'status' => 'error',
                'message' => 'Etapa no encontrada'
            ], 404);
        }

        return response()->json([
            'status' => 'success',
            'data' => $etapa
        ]);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, $id): JsonResponse
    {
        $etapa = Etapa::find($id);

        if (!$etapa) {
            return response()->json([
                'status' => 'error',
                'message' => 'Etapa no encontrada'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'producto_id' => 'sometimes|required|exists:productos,id',
            'nombre' => 'sometimes|required|string|max:255',
            'posicion' => 'sometimes|required|integer|min:0',
            'estado' => 'sometimes|required|string|max:50',
            'fecha_inicio' => 'sometimes|nullable|date',
            'fecha_fin' => 'sometimes|nullable|date',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Error de validación',
                'errors' => $validator->errors()
            ], 422);
        }

        $etapa->update($request->all());

        return response()->json([
            'status' => 'success',
            'message' => 'Etapa actualizada correctamente',
            'data' => $etapa
        ]);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy($id): JsonResponse
    {
        $etapa = Etapa::find($id);

        if (!$etapa) {
            return response()->json([
                'status' => 'error',
                'message' => 'Etapa no encontrada'
            ], 404);
        }

        $etapa->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Etapa eliminada correctamente'
        ]);
    }

    /**
     * Asignar un operario a la etapa con validación de responsabilidades.
     */
    public function asignarOperario(Request $request, $id): JsonResponse
    {
        $etapa = Etapa::find($id);

        if (!$etapa) {
            return response()->json([
                'status' => 'error',
                'message' => 'Etapa no encontrada'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'user_id' => 'required|exists:users,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Error de validación',
                'errors' => $validator->errors()
            ], 422);
        }

        $userId = $request->input('user_id');

        // 1. Verificar si ya está asignado
        if ($etapa->operarios()->where('user_id', $userId)->exists()) {
            return response()->json([
                'status' => 'error',
                'message' => 'El operario ya está asignado a esta etapa'
            ], 422);
        }

        // 2. Validación de responsabilidades (skills) requeridas por la etapa
        $requiredCount = DB::table('etapa_responsabilidades')
            ->where('etapa_id', $etapa->id)
            ->count();

        if ($requiredCount > 0) {
            $matchCount = DB::table('user_responsabilidades as ur')
                ->join('etapa_responsabilidades as er', 'er.responsabilidad_id', '=', 'ur.responsabilidad_id')
                ->where('ur.user_id', $userId)
                ->where('er.etapa_id', $etapa->id)
                ->count();

            if ($matchCount === 0) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'El operario no cuenta con las responsabilidades necesarias para esta etapa'
                ], 422);
            }
        }

        // 3. Asignar operario
        $etapa->operarios()->attach($userId, ['asignado_at' => now()]);

        return response()->json([
            'status' => 'success',
            'message' => 'Operario asignado correctamente a la etapa'
        ]);
    }

    /**
     * Desasignar un operario de la etapa.
     */
    public function desasignarOperario($id, $userId): JsonResponse
    {
        $etapa = Etapa::find($id);

        if (!$etapa) {
            return response()->json([
                'status' => 'error',
                'message' => 'Etapa no encontrada'
            ], 404);
        }

        if (!$etapa->operarios()->where('user_id', $userId)->exists()) {
            return response()->json([
                'status' => 'error',
                'message' => 'El operario no está asignado a esta etapa'
            ], 422);
        }

        $etapa->operarios()->detach($userId);

        return response()->json([
            'status' => 'success',
            'message' => 'Operario desasignado correctamente de la etapa'
        ]);
    }
}
