<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Producto;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Http\JsonResponse;

class ProductoController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request): JsonResponse
    {
        $query = Producto::query();

        // Búsqueda opcional por nombre
        if ($request->has('nombre')) {
            $query->where('nombre', 'like', '%' . $request->input('nombre') . '%');
        }

        $productos = $query->get();

        return response()->json([
            'status' => 'success',
            'data' => $productos
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

        $producto = Producto::create($request->all());

        return response()->json([
            'status' => 'success',
            'message' => 'Producto creado correctamente',
            'data' => $producto
        ], 201);
    }

    /**
     * Display the specified resource.
     */
    public function show($id): JsonResponse
    {
        $producto = Producto::find($id);

        if (!$producto) {
            return response()->json([
                'status' => 'error',
                'message' => 'Producto no encontrado'
            ], 404);
        }

        return response()->json([
            'status' => 'success',
            'data' => $producto
        ]);
    }

    /**
     * Update the specified resource in storage (PATCH).
     */
    public function update(Request $request, $id): JsonResponse
    {
        $producto = Producto::find($id);

        if (!$producto) {
            return response()->json([
                'status' => 'error',
                'message' => 'Producto no encontrado'
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

        $producto->update($request->all());

        return response()->json([
            'status' => 'success',
            'message' => 'Producto actualizado correctamente',
            'data' => $producto
        ]);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy($id): JsonResponse
    {
        $producto = Producto::find($id);

        if (!$producto) {
            return response()->json([
                'status' => 'error',
                'message' => 'Producto no encontrado'
            ], 404);
        }

        $producto->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Producto eliminado correctamente'
        ]);
    }
}
