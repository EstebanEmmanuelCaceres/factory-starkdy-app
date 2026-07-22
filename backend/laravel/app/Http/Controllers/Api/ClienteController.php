<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Cliente;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Http\JsonResponse;

class ClienteController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request): JsonResponse
    {
        $query = Cliente::query();

        // Búsqueda opcional por nombre de empresa, nombre de cliente, email o término general (search)
        if ($request->has('search')) {
            $searchTerm = $request->input('search');
            $query->where(function ($q) use ($searchTerm) {
                $q->where('nombre_empresa', 'like', '%' . $searchTerm . '%')
                    ->orWhere('nombre_cliente', 'like', '%' . $searchTerm . '%')
                    ->orWhere('email', 'like', '%' . $searchTerm . '%');
            });
        } elseif ($request->has('nombre_empresa')) {
            $query->where('nombre_empresa', 'like', '%' . $request->input('nombre_empresa') . '%');
        } elseif ($request->has('nombre_cliente')) {
            $query->where('nombre_cliente', 'like', '%' . $request->input('nombre_cliente') . '%');
        }

        if ($request->has('with_pedidos') && ($request->input('with_pedidos') === 'true' || $request->input('with_pedidos') == 1 || $request->input('with_pedidos') === true)) {
            $query->with(['pedidos', 'pedidos.pagos', 'pedidos.pagos.vendedor']);
        }

        $clientes = $query->get();

        return response()->json([
            'status' => 'success',
            'data' => $clientes
        ]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'nombre_cliente' => 'required|string|max:255',
            'nombre_empresa' => 'required|string|max:255',
            'email' => 'nullable|email|max:255|unique:clientes,email',
            'telefono' => 'required|string|max:50',
            'dni' => 'nullable|string|max:50',
            'direccion' => 'nullable|string|max:255',
            'provincia' => 'nullable|string|max:100',
            'cp' => 'nullable|string|max:20',
            'localidad' => 'nullable|string|max:100',
            'ingreso' => 'nullable|numeric|min:0',
            'valor_total' => 'nullable|numeric|min:0',
            'saldo' => 'nullable|numeric',
            'observaciones' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Error de validación',
                'errors' => $validator->errors()
            ], 422);
        }

        $cliente = Cliente::create($request->all());

        return response()->json([
            'status' => 'success',
            'message' => 'Cliente creado correctamente',
            'data' => $cliente
        ], 201);
    }

    /**
     * Display the specified resource.
     */
    public function show($id): JsonResponse
    {
        $cliente = Cliente::find($id);

        if (!$cliente) {
            return response()->json([
                'status' => 'error',
                'message' => 'Cliente no encontrado'
            ], 404);
        }

        return response()->json([
            'status' => 'success',
            'data' => $cliente
        ]);
    }

    /**
     * Update the specified resource in storage (PATCH).
     */
    public function update(Request $request, $id): JsonResponse
    {
        $cliente = Cliente::find($id);

        if (!$cliente) {
            return response()->json([
                'status' => 'error',
                'message' => 'Cliente no encontrado'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'nombre_cliente' => 'sometimes|required|string|max:255',
            'nombre_empresa' => 'sometimes|required|string|max:255',
            'email' => 'sometimes|nullable|email|max:255|unique:clientes,email,' . $cliente->id,
            'telefono' => 'sometimes|required|string|max:50',
            'dni' => 'sometimes|nullable|string|max:50',
            'direccion' => 'sometimes|nullable|string|max:255',
            'provincia' => 'sometimes|nullable|string|max:100',
            'cp' => 'sometimes|nullable|string|max:20',
            'localidad' => 'sometimes|nullable|string|max:100',
            'ingreso' => 'sometimes|nullable|numeric|min:0',
            'valor_total' => 'sometimes|nullable|numeric|min:0',
            'saldo' => 'sometimes|nullable|numeric',
            'observaciones' => 'sometimes|nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Error de validación',
                'errors' => $validator->errors()
            ], 422);
        }

        $cliente->update($request->all());

        return response()->json([
            'status' => 'success',
            'message' => 'Cliente actualizado correctamente',
            'data' => $cliente
        ]);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy($id): JsonResponse
    {
        $cliente = Cliente::find($id);

        if (!$cliente) {
            return response()->json([
                'status' => 'error',
                'message' => 'Cliente no encontrado'
            ], 404);
        }

        $cliente->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Cliente eliminado correctamente'
        ]);
    }
}
