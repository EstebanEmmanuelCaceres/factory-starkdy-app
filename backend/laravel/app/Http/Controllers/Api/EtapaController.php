<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Etapa;
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

        $etapas = $query->with(['dependencias'])->orderBy('orden', 'asc')->get();

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
            'orden' => 'nullable|integer|min:0',
            'depende_de_ids' => 'nullable|array',
            'depende_de_ids.*' => 'integer|exists:etapas,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Error de validación',
                'errors' => $validator->errors()
            ], 422);
        }

        $productoId = $request->input('producto_id');
        $dependeDeIds = $request->input('depende_de_ids', []);

        // Verificar que todas las dependencias pertenezcan al mismo producto
        if (!empty($dependeDeIds)) {
            $validDepsCount = Etapa::whereIn('id', $dependeDeIds)
                ->where('producto_id', $productoId)
                ->count();

            if ($validDepsCount !== count($dependeDeIds)) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Todas las dependencias deben pertenecer al mismo producto'
                ], 422);
            }
        }

        $etapa = Etapa::create($request->all());

        if (!empty($dependeDeIds)) {
            $etapa->dependencias()->sync($dependeDeIds);
        }

        $etapa->load(['dependencias']);

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
        $etapa = Etapa::with(['dependencias', 'responsabilidades'])->find($id);

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
            'orden' => 'sometimes|required|integer|min:0',
            'depende_de_ids' => 'nullable|array',
            'depende_de_ids.*' => 'integer|exists:etapas,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Error de validación',
                'errors' => $validator->errors()
            ], 422);
        }

        $productoId = $request->input('producto_id', $etapa->producto_id);
        $dependeDeIds = $request->input('depende_de_ids');

        if ($dependeDeIds !== null) {
            // 1. Evitar autodependencia
            if (in_array($etapa->id, $dependeDeIds)) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Una etapa no puede depender de sí misma'
                ], 422);
            }

            // 2. Verificar que pertenezcan al mismo producto
            $validDepsCount = Etapa::whereIn('id', $dependeDeIds)
                ->where('producto_id', $productoId)
                ->count();

            if ($validDepsCount !== count($dependeDeIds)) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Todas las dependencias deben pertenecer al mismo producto'
                ], 422);
            }

            // 3. Detectar ciclos
            if ($this->checkCycle($etapa->id, $dependeDeIds)) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'La dependencia generaría un ciclo infinito en el proceso de fabricación'
                ], 422);
            }
        }

        $etapa->update($request->all());

        if ($dependeDeIds !== null) {
            $etapa->dependencias()->sync($dependeDeIds);
        }

        $etapa->load(['dependencias']);

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

        $productoId = $etapa->producto_id;
        $deletedOrden = $etapa->orden;

        // Puenteo automático de dependencias
        $prereqs = $etapa->dependencias()->pluck('depende_de_etapa_id')->toArray();
        $dependents = $etapa->dependientes()->pluck('etapas.id')->toArray();

        foreach ($dependents as $depId) {
            $depEtapa = Etapa::find($depId);
            if ($depEtapa) {
                // Obtener dependencias actuales que no sean la etapa a eliminar
                $currentDeps = $depEtapa->dependencias()
                    ->where('depende_de_etapa_id', '!=', $etapa->id)
                    ->pluck('depende_de_etapa_id')
                    ->toArray();

                // Combinar dependencias actuales con las de la etapa eliminada
                $newDeps = array_unique(array_merge($currentDeps, $prereqs));

                $depEtapa->dependencias()->sync($newDeps);
            }
        }

        // Limpiar relaciones de la etapa a eliminar
        DB::table('etapa_dependencias')->where('etapa_id', $etapa->id)->delete();
        DB::table('etapa_dependencias')->where('depende_de_etapa_id', $etapa->id)->delete();

        $etapa->delete();

        // Reajustar el campo orden del resto de las etapas del producto
        Etapa::where('producto_id', $productoId)
            ->where('orden', '>', $deletedOrden)
            ->decrement('orden');

        return response()->json([
            'status' => 'success',
            'message' => 'Etapa eliminada correctamente'
        ]);
    }

    /**
     * Sincronizar en lote todas las etapas y dependencias de un producto.
     */
    public function syncEtapas(Request $request, $productId): JsonResponse
    {
        $productExists = DB::table('productos')->where('id', $productId)->exists();
        if (!$productExists) {
            return response()->json([
                'status' => 'error',
                'message' => 'Producto no encontrado'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'etapas' => 'required|array',
            'etapas.*.nombre' => 'required|string|max:255',
            'etapas.*.orden' => 'required|integer|min:0',
            'etapas.*.id' => 'nullable|integer',
            'etapas.*.temp_id' => 'nullable|string',
            'etapas.*.depende_de_ids' => 'nullable|array',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Error de validación',
                'errors' => $validator->errors()
            ], 422);
        }

        $incomingEtapas = $request->input('etapas');

        DB::beginTransaction();
        try {
            // 1. Obtener etapas actuales del producto
            $existingEtapas = Etapa::where('producto_id', $productId)->get();
            $existingIds = $existingEtapas->pluck('id')->toArray();

            // 2. Identificar cuáles eliminar
            $incomingIds = array_filter(array_column($incomingEtapas, 'id'));
            $idsToDelete = array_diff($existingIds, $incomingIds);

            // Eliminar etapas que no vienen en el request
            if (!empty($idsToDelete)) {
                // Limpiar sus relaciones en la tabla pivote
                DB::table('etapa_dependencias')->whereIn('etapa_id', $idsToDelete)->delete();
                DB::table('etapa_dependencias')->whereIn('depende_de_etapa_id', $idsToDelete)->delete();
                // Soft delete de las etapas
                Etapa::whereIn('id', $idsToDelete)->delete();
            }

            // 3. Crear/Actualizar etapas y construir mapa de IDs
            $idMap = []; // mapa de (temp_id o db_id) a db_id
            $savedEtapas = [];

            foreach ($incomingEtapas as $incomingEtapa) {
                $etapaData = [
                    'producto_id' => $productId,
                    'nombre' => $incomingEtapa['nombre'],
                    'orden' => $incomingEtapa['orden'],
                ];

                if (!empty($incomingEtapa['id'])) {
                    // Actualizar
                    $etapa = Etapa::findOrFail($incomingEtapa['id']);
                    $etapa->update($etapaData);
                    $dbId = $etapa->id;
                } else {
                    // Crear
                    $etapa = Etapa::create($etapaData);
                    $dbId = $etapa->id;
                }

                if (!empty($incomingEtapa['temp_id'])) {
                    $idMap[$incomingEtapa['temp_id']] = $dbId;
                }
                $idMap[$dbId] = $dbId;
                
                $savedEtapas[] = [
                    'etapa' => $etapa,
                    'depende_de_ids' => $incomingEtapa['depende_de_ids'] ?? []
                ];
            }

            // 4. Sincronizar dependencias
            foreach ($savedEtapas as $item) {
                $etapa = $item['etapa'];
                $dependeDeIds = $item['depende_de_ids'];

                $resolvedDeps = [];
                foreach ($dependeDeIds as $depId) {
                    if (isset($idMap[$depId])) {
                        $resolvedDeps[] = $idMap[$depId];
                    }
                }

                // Evitar autodependencia
                if (in_array($etapa->id, $resolvedDeps)) {
                    DB::rollBack();
                    return response()->json([
                        'status' => 'error',
                        'message' => "La etapa '{$etapa->nombre}' no puede depender de sí misma"
                    ], 422);
                }

                $etapa->dependencias()->sync($resolvedDeps);
            }

            // 5. Validar que no existan ciclos en el grafo final de dependencias de este producto
            $updatedEtapas = Etapa::where('producto_id', $productId)->get();
            foreach ($updatedEtapas as $etapa) {
                $deps = $etapa->dependencias()->pluck('depende_de_etapa_id')->toArray();
                if ($this->checkCycle($etapa->id, $deps)) {
                    DB::rollBack();
                    return response()->json([
                        'status' => 'error',
                        'message' => 'La configuración generaría un ciclo infinito en el proceso de fabricación'
                    ], 422);
                }
            }

            DB::commit();

            // Cargar y retornar el estado final
            $finalEtapas = Etapa::where('producto_id', $productId)
                ->with(['dependencias'])
                ->orderBy('orden', 'asc')
                ->get();

            return response()->json([
                'status' => 'success',
                'message' => 'Etapas sincronizadas correctamente',
                'data' => $finalEtapas
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'status' => 'error',
                'message' => 'Error al sincronizar etapas: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Detectar si hay un ciclo en las dependencias.
     */
    private function checkCycle(int $etapaId, array $dependeDeIds): bool
    {
        foreach ($dependeDeIds as $depId) {
            if ($this->hasPath($depId, $etapaId)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Verificar si existe un camino desde fromId hasta toId en el grafo de dependencias.
     */
    private function hasPath(int $fromId, int $toId, array &$visited = []): bool
    {
        if ($fromId === $toId) {
            return true;
        }

        $visited[] = $fromId;

        $directDependencies = DB::table('etapa_dependencias')
            ->where('etapa_id', $fromId)
            ->pluck('depende_de_etapa_id')
            ->toArray();

        foreach ($directDependencies as $depId) {
            if (!in_array($depId, $visited)) {
                if ($this->hasPath($depId, $toId, $visited)) {
                    return true;
                }
            }
        }

        return false;
    }
}

