<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Categoria;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Http\JsonResponse;

class CategoriaController extends Controller
{
    /**
     * Listar todas las categorías.
     */
    public function index(): JsonResponse
    {
        $categorias = Categoria::query()->select("id", "nombre")->orderBy('nombre', 'asc')->get();

        return response()->json([
            'status' => 'success',
            'data' => $categorias
        ]);
    }

    /**
     * Crear una categoría.
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'nombre' => 'required|string|max:255|unique:categorias,nombre',
            'descripcion' => 'nullable|string',
            'etapa_ids' => 'nullable|array',
            'etapa_ids.*' => 'integer|exists:etapas,id',
            'user_ids' => 'nullable|array',
            'user_ids.*' => 'integer|exists:users,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Error de validación',
                'errors' => $validator->errors()
            ], 422);
        }

        $categoria = Categoria::create([
            'nombre' => trim($request->input('nombre')),
            'descripcion' => $request->input('descripcion'),
        ]);

        if ($request->has('etapa_ids')) {
            $categoria->etapas()->sync($request->input('etapa_ids', []));
        }

        if ($request->has('user_ids')) {
            $categoria->users()->sync($request->input('user_ids', []));
        }

        $categoria->load(['etapas', 'users']);

        return response()->json([
            'status' => 'success',
            'message' => 'Categoría creada correctamente',
            'data' => $categoria
        ], 201);
    }

    /**
     * Mostrar una categoría.
     */
    public function show($id): JsonResponse
    {
        $categoria = Categoria::with(['etapas', 'users'])->find($id);

        if (!$categoria) {
            return response()->json([
                'status' => 'error',
                'message' => 'Categoría no encontrada'
            ], 404);
        }

        return response()->json([
            'status' => 'success',
            'data' => $categoria
        ]);
    }

    /**
     * Actualizar una categoría.
     */
    public function update(Request $request, $id): JsonResponse
    {
        $categoria = Categoria::find($id);

        if (!$categoria) {
            return response()->json([
                'status' => 'error',
                'message' => 'Categoría no encontrada'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'nombre' => 'sometimes|required|string|max:255|unique:categorias,nombre,' . $id,
            'descripcion' => 'sometimes|nullable|string',
            'etapa_ids' => 'sometimes|array',
            'etapa_ids.*' => 'integer|exists:etapas,id',
            'user_ids' => 'sometimes|array',
            'user_ids.*' => 'integer|exists:users,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Error de validación',
                'errors' => $validator->errors()
            ], 422);
        }

        if ($request->has('nombre')) {
            $categoria->nombre = trim($request->input('nombre'));
        }
        if ($request->has('descripcion')) {
            $categoria->descripcion = $request->input('descripcion');
        }
        $categoria->save();

        if ($request->has('etapa_ids')) {
            $categoria->etapas()->sync($request->input('etapa_ids', []));
        }

        if ($request->has('user_ids')) {
            $categoria->users()->sync($request->input('user_ids', []));
        }

        $categoria->load(['etapas', 'users']);

        return response()->json([
            'status' => 'success',
            'message' => 'Categoría actualizada correctamente',
            'data' => $categoria
        ]);
    }

    /**
     * Eliminar una categoría.
     */
    public function destroy($id): JsonResponse
    {
        $categoria = Categoria::find($id);

        if (!$categoria) {
            return response()->json([
                'status' => 'error',
                'message' => 'Categoría no encontrada'
            ], 404);
        }

        $categoria->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Categoría eliminada correctamente'
        ]);
    }
}
