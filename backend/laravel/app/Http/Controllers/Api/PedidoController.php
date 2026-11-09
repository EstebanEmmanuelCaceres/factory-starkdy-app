<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Pedido;
use App\Models\PedidoProducto;
use App\Models\ResponsableEtapa;
use App\Models\Cliente;
use App\Models\ComentarioPedido;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use App\Services\PedidoWorkflowService;
use App\Services\PedidoLineasService;
use App\Services\PedidoProgresoService;
use App\Services\LocalStorageService;
use App\Models\User;
use App\Http\Resources\ProgresoPedidoResource;
use Illuminate\Support\Collection;

class PedidoController extends Controller
{
    public const ESTADOS = [
        'pendiente', 'listo_para_produccion', 'en_progreso', 'completado', 'completado_pd',
        'enviado', 'enviado_faltante', 'cancelado',
    ];

    // Lo que se manda de cada comentario: autor e imágenes, sin el resto de los modelos
    private const RELACIONES_COMENTARIO = ['user:id,name', 'imagenes:id,comentario_id,url'];

    protected PedidoWorkflowService $workflowService;
    protected PedidoProgresoService $progresoService;

    public function __construct(
        PedidoWorkflowService $workflowService,
        PedidoProgresoService $progresoService,
        private PedidoLineasService $lineasService,
        private LocalStorageService $storageService,
    ) {
        $this->workflowService = $workflowService;
        $this->progresoService = $progresoService;
    }

    /**
     * Agrega a cada pedido el atributo 'progreso' (porcentaje del pedido y de cada producto).
     */
    private function adjuntarProgreso(Collection $pedidos): void
    {
        $progresos = $this->progresoService->progresosDe($pedidos);

        $pedidos->each(fn(Pedido $pedido) => $pedido->setAttribute(
            'progreso',
            (new ProgresoPedidoResource($progresos->get($pedido->id)))->resolve()
        ));
    }

    /**
     * Normaliza las líneas del request (producto + cantidad + atributos).
     * Devuelve [líneas o null si no vinieron productos, respuesta 422 si hay errores].
     */
    private function lineasDelRequest(Request $request): array
    {
        if (!$request->has('productos')) {
            return [null, null];
        }

        [$lineas, $errores] = $this->lineasService->normalizar($request->input('productos', []));
        if (!empty($errores)) {
            return [null, response()->json([
                'status' => 'error',
                'message' => implode(' ', $errores),
                'errors' => ['productos' => $errores],
            ], 422)];
        }

        return [$lineas, null];
    }

    /**
     * Display a listing of the resource.
     */
    public function index(Request $request): JsonResponse
    {
        $query = Pedido::select('id', 'cliente_id', 'user_id', 'codigo', 'prioridad', 'fecha_entrega', 'precio', 'comentario', 'tipo_pago', 'created_at', 'updated_at')
            ->with([
                'cliente:id,nombre_empresa,nombre_cliente,telefono',
                'user:id,name',
                'productos',
                'productos.imagenPrincipal',
                'imagenPrincipal',
                'imagenes',
                'pago',
                'pagos',
                'comentarios:id,pedido_id,user_id,cuerpo,created_at,updated_at',
                'comentarios.user:id,name',
                'comentarios.imagenes:id,comentario_id,url',
            ]);

        $hasSearch = $request->has('search') && !empty(trim($request->input('search')));

        // Búsqueda opcional por código de pedido, nombre de empresa, nombre de cliente, correo del cliente o productos del pedido
        if ($hasSearch) {
            $searchTerm = mb_strtolower(trim($request->input('search')));
            $query->where(function ($q) use ($searchTerm) {
                $q->whereRaw('LOWER(codigo) LIKE ?', ['%' . $searchTerm . '%'])
                    ->orWhereHas('cliente', function ($cq) use ($searchTerm) {
                        $cq->whereRaw('LOWER(nombre_empresa) LIKE ?', ['%' . $searchTerm . '%'])
                            ->orWhereRaw('LOWER(nombre_cliente) LIKE ?', ['%' . $searchTerm . '%'])
                            ->orWhereRaw('LOWER(email) LIKE ?', ['%' . $searchTerm . '%']);
                    })
                    ->orWhereHas('productos', function ($pq) use ($searchTerm) {
                        $pq->whereRaw('LOWER(productos.nombre) LIKE ?', ['%' . $searchTerm . '%']);
                    });
            });
        }

        // Filtro por prioridad
        if ($request->has('prioridad') && !empty($request->input('prioridad'))) {
            $query->where('prioridad', $request->input('prioridad'));
        }

        // Filtro por estado
        if ($request->has('estado') && !empty($request->input('estado'))) {
            $estadoInput = $request->input('estado');
            if ($estadoInput !== 'todos' && $estadoInput !== 'all') {
                $query->whereHas('ultimoEstado', function ($q) use ($estadoInput) {
                    $q->where('estado', $estadoInput);
                });
            }
        } elseif (!$hasSearch) {
            // Por defecto (sin filtro explícito y sin búsqueda activa): Excluir pedidos completados, cancelados o enviados
            $query->whereHas('ultimoEstado', function ($q) {
                $q->whereNotIn('estado', [
                    'completado',
                    'completado_pd',
                    'finalizado',
                    'cancelado',
                    'enviado',
                    'enviado_faltante'
                ]);
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

        // Restricción por rol:
        // - Vendedor: solo ve sus pedidos creados.
        // - Diseñador/a: ve todos los pedidos y tiene permisos de edición.
        // - Operarios: ven únicamente los pedidos fuera del estado 'pendiente'.
        // - Encargado / Supervisor / Admin: ven todos los pedidos.
        $currentUser = auth()->user();
        if ($currentUser) {
            $userRole = $currentUser->role?->slug;
            if ($userRole === 'vendedor') {
                $query->where('user_id', $currentUser->id);
            } elseif (in_array($userRole, ['operario', 'operator'])) {
                $query->whereHas('ultimoEstado', function ($q) {
                    $q->where('estado', '!=', 'pendiente');
                });
            }
        }

        $pedidos = $query->latest()->get();
        $this->adjuntarProgreso($pedidos);

        $pedidos->makeHidden(['porcentaje_pagado']);
        if ($currentUser && in_array($currentUser->role?->slug, ['operario', 'operator'])) {
            $pedidos->makeHidden(['precio', 'monto_pagado', 'saldo_pendiente', 'pagos']);
        }
        $pedidos->each(function ($pedido) use ($currentUser) {
            if ($currentUser && in_array($currentUser->role?->slug, ['operario', 'operator'])) {
                $pedido->makeHidden(['precio', 'monto_pagado', 'saldo_pendiente', 'pagos']);
            }
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
        $messages = [
            'cliente_id.required_without' => 'Falta seleccionar el cliente.',
            'cliente_id.exists' => 'El cliente seleccionado no existe en el sistema.',
            'cliente.nombre_cliente.required_with' => 'Falta el nombre del cliente.',
            'cliente.nombre_empresa.required_with' => 'Falta la empresa del cliente.',
            'precio.required' => 'Falta ingresar el precio del pedido.',
            'precio.numeric' => 'El precio del pedido debe ser un número válido.',
            'precio.min' => 'El precio del pedido no puede ser negativo.',
            'fecha_entrega.required' => 'Falta seleccionar la fecha estimada de entrega.',
            'fecha_entrega.date' => 'La fecha estimada de entrega debe ser una fecha válida.',
            'prioridad.required' => 'Falta seleccionar la prioridad del pedido.',
            'prioridad.in' => 'La prioridad seleccionada no es válida.',
            'codigo.required' => 'Falta el código del pedido.',
            'codigo.unique' => 'El código del pedido ya existe.',
            'productos.*.id.exists' => 'Uno de los productos seleccionados no existe.',
            'productos.*.cantidad.min' => 'La cantidad de cada producto debe ser al menos 1.',
        ];

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
            'fecha_entrega' => 'required|date',
            'precio' => 'required|numeric|min:0',
            'comentario' => 'nullable|string',
            'descripcion' => 'nullable|string',
            'tipo_pago' => 'nullable|string|in:unico,parcial',
            'monto_pago_inicial' => 'nullable|numeric|min:0',
            'medio_pago_inicial' => 'nullable|string|max:255',
            'observaciones_pago_inicial' => 'nullable|string|max:1000',
            'productos' => 'nullable|array',
            'productos.*.id' => 'required|exists:productos,id',
            'productos.*.cantidad' => 'required|integer|min:1',
            'productos.*.atributos' => 'nullable|array',
            'asignaciones' => 'nullable|array',
            'asignaciones.*.etapa_id' => 'nullable|integer',
            'asignaciones.*.user_id' => 'nullable|integer|exists:users,id',
        ], $messages);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => implode('. ', $validator->errors()->all()),
                'errors' => $validator->errors()
            ], 422);
        }

        $montoInicial = (float) ($request->input('monto_pago_inicial') ?? 0);
        $precioPedido = (float) ($request->input('precio') ?? 0);
        if ($montoInicial > 0 && round($montoInicial, 2) > round($precioPedido, 2)) {
            return response()->json([
                'status' => 'error',
                'message' => 'El monto del pago inicial ($' . number_format($montoInicial, 2) . ') no puede ser superior al precio total del pedido ($' . number_format($precioPedido, 2) . ').',
                'errors' => [
                    'monto_pago_inicial' => ['El pago inicial excede el precio total del pedido.']
                ]
            ], 422);
        }

        // Las líneas se validan antes de crear nada (cliente o pedido), para no dejar datos a medias
        [$lineas, $errorLineas] = $this->lineasDelRequest($request);
        if ($errorLineas) {
            return $errorLineas;
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

        $cliente = Cliente::find($clienteId);
        if ($cliente && (float) ($cliente->saldo ?? 0) > 0) {
            $limite = (float) $cliente->saldo;
            $consumidoActual = (float) $cliente->total_pedidos;
            $nuevoPrecio = (float) ($request->input('precio') ?? 0);
            $totalConNuevo = $consumidoActual + $nuevoPrecio;

            if ($totalConNuevo > $limite) {
                $disponible = max(0, $limite - $consumidoActual);
                return response()->json([
                    'status' => 'error',
                    'message' => 'No se puede crear el pedido: El monto del nuevo pedido ($' . number_format($nuevoPrecio, 2) . ') sumado a los pedidos existentes ($' . number_format($consumidoActual, 2) . ') supera el límite de crédito asignado ($' . number_format($limite, 2) . '). Crédito disponible: $' . number_format($disponible, 2) . '.',
                    'errors' => [
                        'cliente_id' => ['El cliente sobrepasa su límite de crédito asignado.']
                    ]
                ], 422);
            }
        }

        $data = $request->only(['codigo', 'prioridad', 'fecha_entrega', 'precio', 'comentario', 'tipo_pago']);
        // 'descripcion' es un alias de 'comentario'
        if ($request->filled('descripcion') && empty($data['comentario'])) {
            $data['comentario'] = $request->input('descripcion');
        }
        // El detalle de atributos de cada producto queda al final del comentario
        $data['comentario'] = $this->lineasService->comentarioConAtributos($data['comentario'] ?? null, $lineas ?? []);
        $data['tipo_pago'] = $data['tipo_pago'] ?? ($montoInicial >= $precioPedido && $precioPedido > 0 ? 'unico' : 'parcial');
        $data['cliente_id'] = $clienteId;
        $data['user_id'] = $request->input('user_id') ?? $request->input('vendedor_id') ?? Auth::id() ?? 1; // Asocia el vendedor/usuario del pedido
        $data['estado'] = 'pendiente';      // Por defecto al crear

        if (empty($data['fecha_entrega'])) {
            $data['fecha_entrega'] = now()->addDays(15)->toDateString();
        }

        $pedido = Pedido::create($data);

        if ($lineas !== null) {
            $this->lineasService->sincronizar($pedido, $lineas);
        }
        $this->syncAsignaciones($pedido, $request);

        // Registrar pago inicial si fue proporcionado
        if ($montoInicial > 0) {
            $medioPago = $request->input('medio_pago_inicial') ?: 'efectivo';
            $tipoCobro = ($montoInicial >= $precioPedido) ? 'unico' : 'seña';

            $pedido->pagos()->create([
                'monto' => $montoInicial,
                'medio_pago' => $medioPago,
                'medio' => $medioPago,
                'tipo_cobro' => $tipoCobro,
                'observaciones' => $request->input('observaciones_pago_inicial') ?: 'Pago registrado al crear el pedido',
                'fecha_pago' => now(),
                'pagado_at' => now(),
                'estado' => 'pagado',
                'registrado_por' => Auth::id() ?? 1,
                'vendedor_id' => Auth::id() ?? 1,
                'moneda' => 'ARS',
            ]);
        }

        // Cargar relaciones para la respuesta
        $pedido->load(['cliente', 'user', 'productos', 'pago', 'pagos']);
        $this->adjuntarProgreso(collect([$pedido]));

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
        $this->workflowService->desbloquearTareasSatisfechas($id);

        $pedido = Pedido::with([
            'cliente',
            'user',
            'productos',
            'productos.imagenPrincipal',
            'productos.imagenes',
            'imagenPrincipal',
            'imagenes',
            'pago',
            'pagos',
            'comentarios',
            'comentarios.user:id,name',
            'comentarios.imagenes:id,comentario_id,url',
        ])->find($id);

        if (!$pedido) {
            return response()->json([
                'status' => 'error',
                'message' => 'Pedido no encontrado'
            ], 404);
        }

        $currentUser = auth()->user();
        if ($currentUser) {
            $userRole = $currentUser->role?->slug;
            if (in_array($userRole, ['operario', 'operator', 'encargado', 'supervisor']) && $pedido->estado === 'pendiente') {
                return response()->json([
                    'status' => 'error',
                    'message' => 'El pedido se encuentra pendiente y aún no ha sido habilitado para producción.'
                ], 403);
            }
            if (in_array($userRole, ['operario', 'operator'])) {
                $pedido->makeHidden(['precio', 'monto_pagado', 'saldo_pendiente', 'pagos']);
            }
        }

        $this->adjuntarProgreso(collect([$pedido]));

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

        $messages = [
            'cliente_id.exists' => 'El cliente seleccionado no existe en el sistema.',
            'precio.numeric' => 'El precio del pedido debe ser un número válido.',
            'precio.min' => 'El precio del pedido no puede ser negativo.',
            'fecha_entrega.date' => 'La fecha estimada de entrega debe ser una fecha válida.',
            'prioridad.in' => 'La prioridad seleccionada no es válida.',
            'codigo.unique' => 'El código del pedido ya existe.',
        ];

        $validator = Validator::make($request->all(), [
            'cliente_id' => 'sometimes|required|exists:clientes,id',
            'codigo' => 'sometimes|required|string|max:255|unique:pedidos,codigo,' . $pedido->id,
            'estado' => 'sometimes|required|string',
            'prioridad' => 'sometimes|required|string|in:baja,normal,alta,critica',
            'fecha_entrega' => 'sometimes|nullable|date',
            'precio' => 'sometimes|nullable|numeric|min:0',
            'comentario' => 'sometimes|nullable|string',
            'descripcion' => 'sometimes|nullable|string',
            'tipo_pago' => 'sometimes|nullable|string|in:unico,parcial',
            'productos' => 'sometimes|array',
            'productos.*.id' => 'required|exists:productos,id',
            'productos.*.cantidad' => 'required|integer|min:1',
            'productos.*.atributos' => 'nullable|array',
            'asignaciones' => 'nullable|array',
            'asignaciones.*.etapa_id' => 'nullable|integer',
            'asignaciones.*.user_id' => 'nullable|integer|exists:users,id',
        ], $messages);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => implode('. ', $validator->errors()->all()),
                'errors' => $validator->errors()
            ], 422);
        }

        [$lineas, $errorLineas] = $this->lineasDelRequest($request);
        if ($errorLineas) {
            return $errorLineas;
        }

        $updateData = $request->only(['cliente_id', 'codigo', 'estado', 'prioridad', 'fecha_entrega', 'precio', 'comentario', 'tipo_pago', 'user_id', 'vendedor_id']);
        // 'descripcion' es un alias de 'comentario'
        $comentarioEnviado = $request->has('comentario') || $request->has('descripcion');
        if ($request->has('descripcion') && !$request->has('comentario')) {
            $updateData['comentario'] = $request->input('descripcion');
        }
        // Si cambian los productos o el comentario, se regenera el detalle de atributos al final del comentario
        // (con las líneas nuevas o, si no vinieron, con las que ya tiene el pedido)
        if ($lineas !== null || $comentarioEnviado) {
            $updateData['comentario'] = $this->lineasService->comentarioConAtributos(
                $comentarioEnviado ? ($updateData['comentario'] ?? null) : $pedido->comentario,
                $lineas ?? $this->lineasService->lineasActuales($pedido)
            );
        }
        if (isset($updateData['vendedor_id']) && !isset($updateData['user_id'])) {
            $updateData['user_id'] = $updateData['vendedor_id'];
            unset($updateData['vendedor_id']);
        }
        $pedido->update($updateData);

        if ($lineas !== null) {
            $this->lineasService->sincronizar($pedido, $lineas);
        }
        $this->syncAsignaciones($pedido, $request);
        $this->workflowService->desbloquearTareasSatisfechas($pedido->id);

        $pedido->refresh();
        $pedido->load(['cliente', 'user', 'productos', 'pago', 'pagos', 'ultimoEstado']);
        $this->adjuntarProgreso(collect([$pedido]));

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
     * Generar las tareas del pedido y aplicar las asignaciones de responsables.
     * Las etapas de los productos no se tocan desde acá: se configuran solo desde el producto.
     */
    private function syncAsignaciones(Pedido $pedido, Request $request): void
    {
        DB::transaction(function () use ($pedido, $request) {
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
                    }

                    if ($etapaProductoId) {
                        $userId = !empty($incomingAsignacion['user_id']) ? $incomingAsignacion['user_id'] : null;

                        $task = ResponsableEtapa::where('pedido_id', $pedido->id)
                            ->where('etapa_producto_id', $etapaProductoId)
                            ->first();

                        if ($task) {
                            $ep = $task->etapaProducto;
                            $etapaNombre = mb_strtolower($ep->etapa->nombre ?? '');
                            $isDiseno = ($ep && (int) $ep->etapa_id === 5) || str_contains($etapaNombre, 'diseño') || str_contains($etapaNombre, 'diseno');

                            if ($isDiseno && !empty($pedido->user_id)) {
                                $task->update(['user_id' => $pedido->user_id]);
                            } elseif (!empty($userId)) {
                                $task->update(['user_id' => $userId]);
                            }
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
        $comentarios = $pedido->comentarios()->with(self::RELACIONES_COMENTARIO)->get();
        return response()->json(['status' => 'success', 'data' => $comentarios]);
    }

    /**
     * Agregar un comentario a un pedido, con texto y/o imágenes.
     * Las imágenes se guardan como imágenes del pedido (con comentario_id), así también aparecen en la galería.
     */
    public function addComentario(Request $request, $id): JsonResponse
    {
        $pedido = Pedido::find($id);
        if (!$pedido) {
            return response()->json(['status' => 'error', 'message' => 'Pedido no encontrado'], 404);
        }

        $validator = Validator::make($request->all(), [
            'cuerpo' => 'nullable|required_without:imagenes|string|max:1000',
            'imagenes' => 'nullable|array|max:10',
            'imagenes.*' => 'image|mimes:jpeg,png,jpg,webp,gif|max:10240',
        ], [
            'cuerpo.required_without' => 'Escribí un comentario o adjuntá una imagen.',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => implode(' ', $validator->errors()->all()),
                'errors' => $validator->errors()
            ], 422);
        }

        $comentario = DB::transaction(function () use ($request, $pedido) {
            $comentario = $pedido->comentarios()->create([
                'user_id' => auth()->id() ?? 1,
                'cuerpo' => (string) $request->input('cuerpo', ''),
            ]);

            $orden = (int) $pedido->imagenes()->max('orden');
            foreach ($request->file('imagenes', []) as $archivo) {
                $subida = $this->storageService->uploadImage($archivo, 'pedidos');
                $comentario->imagenes()->create([
                    'pedido_id' => $pedido->id,
                    'url' => $subida['url'],
                    'path_almacenamiento' => $subida['path_almacenamiento'],
                    'orden' => ++$orden,
                    'es_principal' => false, // la portada se elige desde la galería
                ]);
            }

            return $comentario;
        });

        return response()->json([
            'status' => 'success',
            'message' => 'Comentario agregado correctamente',
            // Las imágenes van completas para sumarlas a la galería del pedido sin volver a pedirla
            'data' => $comentario->load(['user:id,name', 'imagenes'])
        ], 201);
    }

    /**
     * Editar el texto de un comentario (solo su autor o un admin).
     */
    public function updateComentario(Request $request, $id, $comentarioId): JsonResponse
    {
        $comentario = ComentarioPedido::where('pedido_id', $id)->find($comentarioId);
        if (!$comentario) {
            return response()->json(['status' => 'error', 'message' => 'Comentario no encontrado'], 404);
        }
        if (!$this->puedeModificarComentario($comentario)) {
            return response()->json(['status' => 'error', 'message' => 'Solo el autor o un administrador pueden editar este comentario.'], 403);
        }

        $validator = Validator::make($request->all(), [
            'cuerpo' => 'required|string|max:1000',
        ]);
        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => implode(' ', $validator->errors()->all()),
                'errors' => $validator->errors()
            ], 422);
        }

        $comentario->update(['cuerpo' => $request->input('cuerpo')]);

        return response()->json([
            'status' => 'success',
            'message' => 'Comentario actualizado',
            'data' => $comentario->only(['id', 'cuerpo', 'updated_at'])
        ]);
    }

    /**
     * Borrado lógico de un comentario (solo su autor o un admin).
     * Sus imágenes quedan en la galería del pedido; desde ahí se pueden borrar.
     */
    public function deleteComentario($id, $comentarioId): JsonResponse
    {
        $comentario = ComentarioPedido::where('pedido_id', $id)->find($comentarioId);
        if (!$comentario) {
            return response()->json(['status' => 'error', 'message' => 'Comentario no encontrado'], 404);
        }
        if (!$this->puedeModificarComentario($comentario)) {
            return response()->json(['status' => 'error', 'message' => 'Solo el autor o un administrador pueden eliminar este comentario.'], 403);
        }

        $comentario->delete();

        return response()->json(['status' => 'success', 'message' => 'Comentario eliminado']);
    }

    private function puedeModificarComentario(ComentarioPedido $comentario): bool
    {
        /** @var User|null $user */
        $user = Auth::user();
        return $user && ($comentario->user_id === $user->id || $user->isAdmin());
    }

    /**
     * Cambiar el estado de varios pedidos a la vez (solo admin).
     * Cada cambio queda en el historial igual que al editar un pedido.
     */
    public function cambiarEstado(Request $request): JsonResponse
    {
        /** @var User|null $user */
        $user = Auth::user();
        if (!$user || !$user->isAdmin()) {
            return response()->json(['status' => 'error', 'message' => 'Solo un administrador puede cambiar pedidos en lote.'], 403);
        }

        $validator = Validator::make($request->all(), [
            'ids' => 'required|array|min:1|max:200',
            'ids.*' => 'integer|distinct',
            'estado' => 'required|string|in:' . implode(',', self::ESTADOS),
        ]);
        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => implode(' ', $validator->errors()->all()),
                'errors' => $validator->errors()
            ], 422);
        }

        $estado = $request->input('estado');
        $pedidos = Pedido::with('ultimoEstado')->whereIn('id', $request->input('ids'))->get();

        DB::transaction(function () use ($pedidos, $estado) {
            foreach ($pedidos as $pedido) {
                $pedido->estado = $estado; // el mutator registra el cambio en pedido_historial_estado
                $this->workflowService->desbloquearTareasSatisfechas($pedido->id);
            }
        });

        return response()->json([
            'status' => 'success',
            'message' => "{$pedidos->count()} pedido(s) pasaron a {$estado}",
            'data' => ['ids' => $pedidos->pluck('id'), 'estado' => $estado],
        ]);
    }

    /**
     * Progreso de todos los pedidos en progreso (porcentaje por pedido y por producto).
     */
    public function progresos(Request $request): JsonResponse
    {
        $progresos = $this->progresoService->listarEnProgreso($request->user());

        return response()->json([
            'status' => 'success',
            'data' => ProgresoPedidoResource::collection($progresos),
        ]);
    }

    /**
     * Progreso de un pedido puntual.
     */
    public function progreso($id): JsonResponse
    {
        $pedido = Pedido::find($id);

        if (!$pedido) {
            return response()->json([
                'status' => 'error',
                'message' => 'Pedido no encontrado'
            ], 404);
        }

        return response()->json([
            'status' => 'success',
            'data' => new ProgresoPedidoResource($this->progresoService->progresoDe($pedido)),
        ]);
    }

    /**
     * Completar en un solo pedido HTTP todas las etapas de un producto del pedido
     * (evita mandar una petición por etapa). Devuelve el progreso actualizado.
     */
    public function completarEtapasProducto($id, $productoId): JsonResponse
    {
        /** @var User|null $currentUser */
        $currentUser = Auth::user();
        if (!$currentUser || !$currentUser->isAdminOrEncargado()) {
            return response()->json([
                'status' => 'error',
                'message' => 'No autorizado. Solo administradores o encargados pueden completar todas las etapas del producto.'
            ], 403);
        }

        $pedido = Pedido::find($id);

        if (!$pedido) {
            return response()->json([
                'status' => 'error',
                'message' => 'Pedido no encontrado'
            ], 404);
        }

        if (!$pedido->productos()->where('productos.id', $productoId)->exists()) {
            return response()->json([
                'status' => 'error',
                'message' => 'El producto no pertenece a este pedido'
            ], 404);
        }

        if ($pedido->estado === 'pendiente') {
            return response()->json([
                'status' => 'error',
                'message' => 'El pedido está pendiente; habilitalo para producción antes de completar etapas.'
            ], 422);
        }

        $completadas = $this->workflowService->completarEtapasDeProducto($pedido, (int) $productoId, Auth::id());

        $pedido->refresh();

        return response()->json([
            'status' => 'success',
            'message' => $completadas > 0
                ? "Se completaron {$completadas} etapa(s) del producto"
                : 'El producto ya tenía todas sus etapas completadas',
            'data' => [
                'completadas' => $completadas,
                'estado' => $pedido->estado,
                'progreso' => new ProgresoPedidoResource($this->progresoService->progresoDe($pedido)),
            ],
        ]);
    }

    /**
     * Obtener pedidos completados con saldo pendiente de cobro.
     */
    public function completadosPorCobrar(): JsonResponse
    {
        $currentUser = auth()->user();

        $query = Pedido::select('id', 'cliente_id', 'user_id', 'codigo', 'prioridad', 'precio', 'created_at', 'updated_at')
            ->with([
                'cliente:id,nombre_empresa,nombre_cliente,telefono,email',
                'user:id,name',
                'pago',
                'pagos',
                'comentarios:id,pedido_id,user_id,cuerpo,created_at,updated_at',
                'comentarios.user:id,name'
            ])
            ->whereHas('ultimoEstado', function ($q) {
                $q->whereIn('estado', ['completado', 'completado_pd']);
            });

        // Restricción por rol: si es vendedor, solo sus pedidos
        if ($currentUser && $currentUser->role?->slug === 'vendedor') {
            $query->where('user_id', $currentUser->id);
        }

        $pedidos = $query->latest()->get()->filter(function ($pedido) {
            $precio = (float) ($pedido->precio ?? 0);
            $paid = $pedido->pagos ? (float) $pedido->pagos->where('estado', 'pagado')->sum('monto') : 0.0;
            return ($precio - $paid) > 0.001;
        })->values();

        return response()->json([
            'status' => 'success',
            'data' => $pedidos
        ]);
    }
}
