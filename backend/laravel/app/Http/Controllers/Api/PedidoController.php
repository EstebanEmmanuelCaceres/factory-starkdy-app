<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Pedido;
use App\Models\PedidoProducto;
use App\Models\Etapa;
use App\Models\EtapaProducto;

use App\Models\ResponsableEtapa;
use App\Models\Cliente;
use App\Models\ComentarioPedido;
use Illuminate\Support\Facades\DB;
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
        $query = Pedido::select('id', 'cliente_id', 'user_id', 'codigo', 'prioridad', 'precio', 'created_at', 'updated_at')
            ->with([
                'cliente:id,nombre_empresa,nombre_cliente,telefono',
                'user:id,name',
                'pago',
                'pagos',
                'comentarios:id,pedido_id,user_id,cuerpo,created_at,updated_at',
                'comentarios.user:id,name'
            ]);

        // Búsqueda opcional por nombre de empresa, nombre de cliente o correo del cliente relacionado
        if ($request->has('search') && !empty($request->input('search'))) {
            $searchTerm = $request->input('search');
            $query->whereHas('cliente', function ($q) use ($searchTerm) {
                $q->where('nombre_empresa', 'like', '%' . $searchTerm . '%')
                    ->orWhere('nombre_cliente', 'like', '%' . $searchTerm . '%')
                    ->orWhere('email', 'like', '%' . $searchTerm . '%');
            });
        }

        // Filtro por prioridad
        if ($request->has('prioridad') && !empty($request->input('prioridad'))) {
            $query->where('prioridad', $request->input('prioridad'));
        }

        // Filtro por estado
        if ($request->has('estado') && !empty($request->input('estado'))) {
            $query->whereHas('ultimoEstado', function ($q) use ($request) {
                $q->where('estado', $request->input('estado'));
            });
        }

        // Filtro por fecha de creación (desde / hasta)
        if ($request->has('fecha_desde') && !empty($request->input('fecha_desde'))) {
            $query->whereDate('created_at', '>=', $request->input('fecha_desde'));
        } elseif ($request->has('creacion_desde') && !empty($request->input('creacion_desde'))) {
            $query->whereDate('created_at', '>=', $request->input('creacion_desde'));
        }

        if ($request->has('fecha_hasta') && !empty($request->input('fecha_hasta'))) {
            $query->whereDate('created_at', '<=', $request->input('fecha_hasta'));
        } elseif ($request->has('creacion_hasta') && !empty($request->input('creacion_hasta'))) {
            $query->whereDate('created_at', '<=', $request->input('creacion_hasta'));
        }

        // Filtro por usuario asignado / creador
        if ($request->has('user_id') && !empty($request->input('user_id'))) {
            $query->where('user_id', $request->input('user_id'));
        }

        // Restricción estricta por rol: Si el usuario autenticado es Vendedor, solo ve sus pedidos
        $currentUser = auth()->user();
        if ($currentUser && $currentUser->role?->slug === 'vendedor') {
            $query->where('user_id', $currentUser->id);
        }

        $pedidos = $query->latest()->get();

        $pedidos->makeHidden(['porcentaje_pagado', 'comentario', 'fecha_entrega']);
        $pedidos->each(function ($pedido) {
            if ($pedido->relationLoaded('comentarios')) {
                $pedido->comentarios->makeHidden(['pedido_id', 'user_id']);
            }
        });

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
            'cliente_id' => 'required_without:cliente|nullable|exists:clientes,id',
            'cliente' => 'nullable|array',
            'cliente.nombre_cliente' => 'required_with:cliente|string|max:255',
            'cliente.nombre_empresa' => 'required_with:cliente|string|max:255',
            'cliente.email' => 'nullable|email|max:255',
            'cliente.telefono' => 'required_with:cliente|string|max:255',
            'cliente.dni' => 'nullable|string|max:255',
            'cliente.direccion' => 'nullable|string|max:255',
            'cliente.provincia' => 'nullable|string|max:255',
            'cliente.cp' => 'nullable|string|max:255',
            'cliente.localidad' => 'nullable|string|max:255',
            'cliente.ingreso' => 'nullable|numeric',
            'cliente.valor_total' => 'nullable|numeric',
            'cliente.saldo' => 'nullable|numeric',
            'cliente.observaciones' => 'nullable|string',
            'codigo' => 'required|string|max:255|unique:pedidos,codigo',
            'prioridad' => 'required|string|in:baja,normal,alta,critica',
            'fecha_entrega' => 'nullable|date',
            'precio' => 'nullable|numeric|min:0',
            'comentario' => 'nullable|string',
            'tipo_pago' => 'nullable|string|in:unico,parcial',
            'productos' => 'nullable|array',
            'productos.*.id' => 'required|exists:productos,id',
            'productos.*.cantidad' => 'required|integer|min:1',
            'etapas' => 'nullable|array',
            'etapas.*.id' => 'nullable',
            'etapas.*.producto_id' => 'required|exists:productos,id',
            'etapas.*.nombre' => 'required|string|max:255',
            'etapas.*.orden' => 'required|integer',
            'etapas.*.temp_id' => 'nullable|string',
            'asignaciones' => 'nullable|array',
            'asignaciones.*.etapa_id' => 'nullable|integer',
            'asignaciones.*.etapa_temp_id' => 'nullable|string',
            'asignaciones.*.user_id' => 'nullable|integer|exists:users,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Error de validación',
                'errors' => $validator->errors()
            ], 422);
        }

        $clienteId = $request->input('cliente_id');
        if ($request->has('cliente') && is_array($request->input('cliente'))) {
            $clienteData = $request->input('cliente');
            $existingCliente = null;

            if (!empty($clienteData['email'])) {
                $existingCliente = Cliente::where('email', $clienteData['email'])->first();
            }

            if (!$existingCliente && !empty($clienteData['nombre_cliente']) && !empty($clienteData['nombre_empresa'])) {
                $existingCliente = Cliente::where('nombre_cliente', $clienteData['nombre_cliente'])
                    ->where('nombre_empresa', $clienteData['nombre_empresa'])
                    ->first();
            }

            if ($existingCliente) {
                $clienteId = $existingCliente->id;
            } else {
                $newCliente = Cliente::create($clienteData);
                $clienteId = $newCliente->id;
            }
        }

        $data = $request->only(['codigo', 'prioridad', 'fecha_entrega', 'precio', 'comentario', 'tipo_pago']);
        $data['tipo_pago'] = $data['tipo_pago'] ?? 'parcial';
        $data['cliente_id'] = $clienteId;
        $data['user_id'] = Auth::id() ?? 1; // Asocia el usuario autenticado
        $data['estado'] = 'pendiente';      // Por defecto al crear

        if (empty($data['fecha_entrega'])) {
            $data['fecha_entrega'] = now()->addDays(15)->toDateString();
        }

        $pedido = Pedido::create($data);

        // Sincronizar productos si se especifican
        if ($request->has('productos')) {
            $syncData = [];
            foreach ($request->input('productos') as $item) {
                if (is_array($item)) {
                    $syncData[$item['id']] = ['cantidad' => $item['cantidad'] ?? 1];
                } else {
                    $syncData[$item] = ['cantidad' => 1];
                }
            }
            $pedido->productos()->sync($syncData);
        }
        $this->syncEtapasYAsignaciones($pedido, $request);

        // Cargar relaciones para la respuesta
        $pedido->load(['cliente', 'user', 'productos', 'pago', 'pagos']);

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
        $pedido = Pedido::with(['cliente', 'user', 'productos', 'pago', 'pagos', 'comentarios', 'comentarios.user'])->find($id);

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
            'precio' => 'sometimes|nullable|numeric|min:0',
            'comentario' => 'sometimes|nullable|string',
            'tipo_pago' => 'sometimes|nullable|string|in:unico,parcial',
            'productos' => 'sometimes|array',
            'productos.*.id' => 'required|exists:productos,id',
            'productos.*.cantidad' => 'required|integer|min:1',
            'etapas' => 'nullable|array',
            'etapas.*.id' => 'nullable',
            'etapas.*.producto_id' => 'required|exists:productos,id',
            'etapas.*.nombre' => 'required|string|max:255',
            'etapas.*.orden' => 'required|integer',
            'etapas.*.temp_id' => 'nullable|string',
            'asignaciones' => 'nullable|array',
            'asignaciones.*.etapa_id' => 'nullable|integer',
            'asignaciones.*.etapa_temp_id' => 'nullable|string',
            'asignaciones.*.user_id' => 'nullable|integer|exists:users,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Error de validación',
                'errors' => $validator->errors()
            ], 422);
        }

        $pedido->update($request->only(['cliente_id', 'codigo', 'estado', 'prioridad', 'fecha_entrega', 'precio', 'comentario', 'tipo_pago']));

        // Sincronizar productos si se enviaron
        if ($request->has('productos')) {
            $syncData = [];
            foreach ($request->input('productos') as $item) {
                if (is_array($item)) {
                    $syncData[$item['id']] = ['cantidad' => $item['cantidad'] ?? 1];
                } else {
                    $syncData[$item] = ['cantidad' => 1];
                }
            }
            $pedido->productos()->sync($syncData);
        }
        $this->syncEtapasYAsignaciones($pedido, $request);

        $pedido->load(['cliente', 'user', 'productos', 'pago', 'pagos']);

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

    /**
     * Generar manualmente las tareas/etapas para el pedido.
     */
    public function generarTareasManual($id): JsonResponse
    {
        $pedido = Pedido::find($id);

        if (!$pedido) {
            return response()->json([
                'status' => 'error',
                'message' => 'Pedido no encontrado'
            ], 404);
        }

        $pedido->generarTareas();

        return response()->json([
            'status' => 'success',
            'message' => 'Etapas de fabricación generadas correctamente para el pedido'
        ]);
    }

    /**
     * Sincronizar etapas y asignaciones por pedido en un solo lote.
     */
    private function syncEtapasYAsignaciones(Pedido $pedido, Request $request): void
    {
        DB::transaction(function () use ($pedido, $request) {
            $productIds = $pedido->productos()->pluck('productos.id')->toArray();
            $tempIdToDbId = [];

            if ($request->has('etapas')) {
                $incomingEtapas = $request->input('etapas') ?? [];
                $keptEtapaProductoIds = [];

                foreach ($incomingEtapas as $incomingEtapa) {
                    $productoId = $incomingEtapa['producto_id'];
                    if (!in_array($productoId, $productIds)) {
                        continue;
                    }

                    $nombre = trim($incomingEtapa['nombre']);
                    $catalogItem = Etapa::whereRaw('LOWER(nombre) = ?', [mb_strtolower($nombre)])->first();
                    if (!$catalogItem) {
                        $catalogItem = Etapa::create(['nombre' => $nombre]);
                    }

                    if (!empty($incomingEtapa['id'])) {
                        $etapaProducto = EtapaProducto::withTrashed()->find($incomingEtapa['id']);
                        if ($etapaProducto) {
                            $etapaProducto->restore();
                            $etapaProducto->update([
                                'etapa_id' => $catalogItem->id,
                                'orden' => $incomingEtapa['orden']
                            ]);
                            $keptEtapaProductoIds[] = $etapaProducto->id;
                        }
                    } else {
                        $etapaProducto = EtapaProducto::create([
                            'producto_id' => $productoId,
                            'etapa_id' => $catalogItem->id,
                            'orden' => $incomingEtapa['orden']
                        ]);
                        $keptEtapaProductoIds[] = $etapaProducto->id;
                        if (!empty($incomingEtapa['temp_id'])) {
                            $tempIdToDbId[$incomingEtapa['temp_id']] = $etapaProducto->id;
                        }
                    }
                }

                // Borrado lógico de las etapas de producto que no se enviaron
                EtapaProducto::whereIn('producto_id', $productIds)
                    ->whereNotIn('id', $keptEtapaProductoIds)
                    ->delete();
            }

            // Sincronizar tareas
            $pedido->generarTareas();

            // Sincronizar asignaciones
            if ($request->has('asignaciones')) {
                $incomingAsignaciones = $request->input('asignaciones') ?? [];
                foreach ($incomingAsignaciones as $incomingAsignacion) {
                    $etapaProductoId = null;
                    if (!empty($incomingAsignacion['etapa_producto_id'])) {
                        $etapaProductoId = $incomingAsignacion['etapa_producto_id'];
                    } elseif (!empty($incomingAsignacion['etapa_id'])) {
                        $etapaProductoId = $incomingAsignacion['etapa_id'];
                    } elseif (!empty($incomingAsignacion['etapa_temp_id']) && isset($tempIdToDbId[$incomingAsignacion['etapa_temp_id']])) {
                        $etapaProductoId = $tempIdToDbId[$incomingAsignacion['etapa_temp_id']];
                    }

                    if ($etapaProductoId) {
                        $userId = !empty($incomingAsignacion['user_id']) ? $incomingAsignacion['user_id'] : null;

                        $task = ResponsableEtapa::where('pedido_id', $pedido->id)
                            ->where('etapa_producto_id', $etapaProductoId)
                            ->first();

                        if ($task) {
                            $task->update(['user_id' => $userId]);
                        }
                    }
                }
            }
        });
    }


    /**
     * Obtener comentarios de un pedido.
     */
    public function getComentarios($id): JsonResponse
    {
        $pedido = Pedido::find($id);
        if (!$pedido) {
            return response()->json(['status' => 'error', 'message' => 'Pedido no encontrado'], 404);
        }
        $comentarios = $pedido->comentarios()->with('user')->get();
        return response()->json(['status' => 'success', 'data' => $comentarios]);
    }

    /**
     * Agregar un comentario a un pedido.
     */
    public function addComentario(Request $request, $id): JsonResponse
    {
        $pedido = Pedido::find($id);
        if (!$pedido) {
            return response()->json(['status' => 'error', 'message' => 'Pedido no encontrado'], 404);
        }

        $validator = Validator::make($request->all(), [
            'cuerpo' => 'required|string|max:1000',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Error de validación',
                'errors' => $validator->errors()
            ], 422);
        }

        $comentario = $pedido->comentarios()->create([
            'user_id' => auth()->id() ?? 1,
            'cuerpo' => $request->input('cuerpo')
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Comentario agregado correctamente',
            'data' => $comentario->load('user')
        ], 201);
    }
}
