<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Pedido;
use App\Models\PedidoProducto;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;

class PedidoController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request): JsonResponse
    {
        $query = Pedido::with(['cliente', 'user', 'productos']);

        // Búsqueda opcional por nombre (razón social) o correo del cliente relacionado
        if ($request->has('search')) {
            $searchTerm = $request->input('search');
            $query->whereHas('cliente', function ($q) use ($searchTerm) {
                $q->where('razon_social', 'like', '%' . $searchTerm . '%')
                  ->orWhere('email', 'like', '%' . $searchTerm . '%');
            });
        }

        $pedidos = $query->latest()->get();

        return response()->json([
            'status' => 'success',
            'data' => $pedidos
        ]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'cliente_id' => 'required|exists:clientes,id',
            'codigo' => 'required|string|max:255|unique:pedidos,codigo',
            'prioridad' => 'required|string|in:baja,normal,alta,critica',
            'fecha_entrega' => 'nullable|date',
            'productos' => 'nullable|array',
            'productos.*' => 'exists:productos,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Error de validación',
                'errors' => $validator->errors()
            ], 422);
        }

        $data = $request->only(['cliente_id', 'codigo', 'prioridad', 'fecha_entrega']);
        $data['user_id'] = Auth::id() ?? 1; // Asocia el usuario autenticado
        $data['estado'] = 'pendiente';      // Por defecto al crear

        $pedido = Pedido::create($data);

        // Sincronizar productos si se especifican
        if ($request->has('productos')) {
            $pedido->productos()->sync($request->input('productos'));
        }

        // Cargar relaciones para la respuesta
        $pedido->load(['cliente', 'user', 'productos']);

        return response()->json([
            'status' => 'success',
            'message' => 'Pedido creado correctamente',
            'data' => $pedido
        ], 201);
    }

    /**
     * Display the specified resource.
     */
    public function show($id): JsonResponse
    {
        $pedido = Pedido::with(['cliente', 'user', 'productos'])->find($id);

        if (!$pedido) {
            return response()->json([
                'status' => 'error',
                'message' => 'Pedido no encontrado'
            ], 404);
        }

        return response()->json([
            'status' => 'success',
            'data' => $pedido
        ]);
    }

    /**
     * Update the specified resource in storage (PATCH).
     */
    public function update(Request $request, $id): JsonResponse
    {
        $pedido = Pedido::find($id);

        if (!$pedido) {
            return response()->json([
                'status' => 'error',
                'message' => 'Pedido no encontrado'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'cliente_id' => 'sometimes|required|exists:clientes,id',
            'codigo' => 'sometimes|required|string|max:255|unique:pedidos,codigo,' . $pedido->id,
            'estado' => 'sometimes|required|string',
            'prioridad' => 'sometimes|required|string|in:baja,normal,alta,critica',
            'fecha_entrega' => 'sometimes|nullable|date',
            'productos' => 'sometimes|array',
            'productos.*' => 'exists:productos,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Error de validación',
                'errors' => $validator->errors()
            ], 422);
        }

        $pedido->update($request->only(['cliente_id', 'codigo', 'estado', 'prioridad', 'fecha_entrega']));

        // Sincronizar productos si se enviaron
        if ($request->has('productos')) {
            $pedido->productos()->sync($request->input('productos'));
        }

        $pedido->load(['cliente', 'user', 'productos']);

        return response()->json([
            'status' => 'success',
            'message' => 'Pedido actualizado correctamente',
            'data' => $pedido
        ]);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy($id): JsonResponse
    {
        $pedido = Pedido::find($id);

        if (!$pedido) {
            return response()->json([
                'status' => 'error',
                'message' => 'Pedido no encontrado'
            ], 404);
        }

        // Borrado lógico de las filas en la tabla intermedia pedido_productos
        PedidoProducto::where('pedido_id', $pedido->id)->delete();

        // Borrado lógico del pedido
        $pedido->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Pedido eliminado correctamente'
        ]);
    }
}
