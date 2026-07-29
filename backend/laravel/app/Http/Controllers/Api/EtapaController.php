<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Etapa;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Http\JsonResponse;

class EtapaController extends Controller
{
    /**
     * Listar las etapas del catálogo maestro.
     */
    public function index(Request $request): JsonResponse
    {
        $query = Etapa::query();

        // Búsqueda opcional por nombre
        if ($request->has('search') && !empty($request->input('search'))) {
            $query->where('nombre', 'like', '%' . $request->input('search') . '%');
        } elseif ($request->has('nombre') && !empty($request->input('nombre'))) {
            $query->where('nombre', 'like', '%' . $request->input('nombre') . '%');
        }

        $etapas = $query->orderBy('nombre', 'asc')->get();

        return response()->json([
            'status' => 'success',
            'data' => $etapas
        ]);
    }

    /**
     * Crear una nueva etapa en el catálogo maestro.
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

        $nombre = trim($request->input('nombre'));

        // Buscar si ya existe una etapa con el mismo nombre (insensible a mayúsculas/minúsculas)
        $etapa = Etapa::whereRaw('LOWER(nombre) = ?', [mb_strtolower($nombre)])->first();

        if (!$etapa) {
            $etapa = Etapa::create([
                'nombre' => $nombre,
                'descripcion' => $request->input('descripcion'),
            ]);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Etapa obtenida/creada correctamente en el catálogo',
            'data' => $etapa
        ], 201);
    }

    /**
     * Obtener una etapa del catálogo.
     */
    public function show($id): JsonResponse
    {
        $etapa = Etapa::find($id);

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
     * Actualizar una etapa en el catálogo maestro.
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

        $etapa->update($request->all());

        return response()->json([
            'status' => 'success',
            'message' => 'Etapa actualizada correctamente',
            'data' => $etapa
        ]);
    }

    /**
     * Eliminar una etapa del catálogo maestro.
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
}
