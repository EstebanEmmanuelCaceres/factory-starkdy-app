<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Responsabilidad;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Http\JsonResponse;

class ResponsabilidadController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request): JsonResponse
    {
        $query = Responsabilidad::query();

        // Búsqueda opcional por nombre
        if ($request->has('nombre')) {
            $query->where('nombre', 'like', '%' . $request->input('nombre') . '%');
        }

        $responsabilidades = $query->get();

        return response()->json([
            'status' => 'success',
            'data' => $responsabilidades
        ]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'nombre' => 'required|string|max:255',
            'descripcion' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Error de validación',
                'errors' => $validator->errors()
            ], 422);
        }

        $responsabilidad = Responsabilidad::create($request->all());

        return response()->json([
            'status' => 'success',
            'message' => 'Responsabilidad creada correctamente',
            'data' => $responsabilidad
        ], 201);
    }

    /**
     * Display the specified resource.
     */
    public function show($id): JsonResponse
    {
        $responsabilidad = Responsabilidad::find($id);

        if (!$responsabilidad) {
            return response()->json([
                'status' => 'error',
                'message' => 'Responsabilidad no encontrada'
            ], 404);
        }

        return response()->json([
            'status' => 'success',
            'data' => $responsabilidad
        ]);
    }

    /**
     * Update the specified resource in storage (PATCH).
     */
    public function update(Request $request, $id): JsonResponse
    {
        $responsabilidad = Responsabilidad::find($id);

        if (!$responsabilidad) {
            return response()->json([
                'status' => 'error',
                'message' => 'Responsabilidad no encontrada'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'nombre' => 'sometimes|required|string|max:255',
            'descripcion' => 'sometimes|nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Error de validación',
                'errors' => $validator->errors()
            ], 422);
        }

        $responsabilidad->update($request->all());

        return response()->json([
            'status' => 'success',
            'message' => 'Responsabilidad actualizada correctamente',
            'data' => $responsabilidad
        ]);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy($id): JsonResponse
    {
        $responsabilidad = Responsabilidad::find($id);

        if (!$responsabilidad) {
            return response()->json([
                'status' => 'error',
                'message' => 'Responsabilidad no encontrada'
            ], 404);
        }

        $responsabilidad->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Responsabilidad eliminada correctamente'
        ]);
    }
}
