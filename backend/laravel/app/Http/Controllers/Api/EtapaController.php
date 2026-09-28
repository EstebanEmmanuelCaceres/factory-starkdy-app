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
        $query = Etapa::with('categorias');

        // Búsqueda opcional por nombre
        if ($request->has('search') && !empty($request->input('search'))) {
            $term = mb_strtolower(trim($request->input('search')));
            $query->whereRaw('LOWER(nombre) LIKE ?', ['%' . $term . '%']);
        } elseif ($request->has('nombre') && !empty($request->input('nombre'))) {
            $term = mb_strtolower(trim($request->input('nombre')));
            $query->whereRaw('LOWER(nombre) LIKE ?', ['%' . $term . '%']);
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
            'categoria_ids' => 'nullable|array',
            'categoria_ids.*' => 'integer|exists:categorias,id',
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

        if ($request->has('categoria_ids')) {
            $etapa->categorias()->sync($request->input('categoria_ids', []));
        }

        $etapa->load('categorias');

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
        $etapa = Etapa::with('categorias')->find($id);

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
            'categoria_ids' => 'sometimes|array',
            'categoria_ids.*' => 'integer|exists:categorias,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Error de validación',
                'errors' => $validator->errors()
            ], 422);
        }

        $etapa->update($request->only(['nombre', 'descripcion']));

        if ($request->has('categoria_ids')) {
            $etapa->categorias()->sync($request->input('categoria_ids', []));
        }

        $etapa->load('categorias');

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
