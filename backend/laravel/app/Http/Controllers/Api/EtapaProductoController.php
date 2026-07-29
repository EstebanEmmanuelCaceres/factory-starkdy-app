<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Etapa;
use App\Models\EtapaProducto;
use App\Models\Producto;
use App\Models\Pedido;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\JsonResponse;

class EtapaProductoController extends Controller
{
    /**
     * Listar las etapas configuradas para un producto.
     */
    public function index($productId): JsonResponse
    {
        $producto = Producto::find($productId);

        if (!$producto) {
            return response()->json([
                'status' => 'error',
                'message' => 'Producto no encontrado'
            ], 404);
        }

        $etapasProductos = EtapaProducto::where('producto_id', $productId)
            ->with(['etapa', 'dependencias.etapa'])
            ->orderBy('orden', 'asc')
            ->get();

        return response()->json([
            'status' => 'success',
            'data' => $etapasProductos
        ]);
    }

    /**
     * Sincronizar en lote las etapas de un producto (Crear, Editar, Eliminar y Vincular Dependencias).
     */
    public function sync(Request $request, $productId): JsonResponse
    {
        $producto = Producto::find($productId);

        if (!$producto) {
            return response()->json([
                'status' => 'error',
                'message' => 'Producto no encontrado'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'etapas' => 'required|array',
            'etapas.*.id' => 'nullable',
            'etapas.*.temp_id' => 'nullable|string',
            'etapas.*.etapa_id' => 'nullable|integer|exists:etapas,id',
            'etapas.*.nombre' => 'nullable|string|max:255',
            'etapas.*.orden' => 'required|integer|min:1',
            'etapas.*.depende_de_ids' => 'nullable|array',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Error de validación',
                'errors' => $validator->errors()
            ], 422);
        }

        $items = $request->input('etapas', []);

        // Validar detección de ciclos en dependencias
        if ($this->hasCycle($items)) {
            return response()->json([
                'status' => 'error',
                'message' => 'La configuración generaría un ciclo infinito en el proceso de fabricación'
            ], 422);
        }

        DB::beginTransaction();
        try {
            // Mapeo de (id existente o temp_id) -> instancia de EtapaProducto creada/actualizada
            $stageMap = [];
            $keptIds = [];

            // 1. Crear o actualizar registros en etapas_productos
            foreach ($items as $item) {
                $nombre = isset($item['nombre']) ? trim($item['nombre']) : null;
                $etapaCatalogId = $item['etapa_id'] ?? null;

                // Si no viene etapa_id pero sí el nombre, buscar o crear la etapa en el catálogo maestro
                if (!$etapaCatalogId && $nombre) {
                    $catalogItem = Etapa::whereRaw('LOWER(nombre) = ?', [mb_strtolower($nombre)])->first();
                    if (!$catalogItem) {
                        $catalogItem = Etapa::create(['nombre' => $nombre]);
                    }
                    $etapaCatalogId = $catalogItem->id;
                }

                if (!$etapaCatalogId) {
                    DB::rollBack();
                    return response()->json([
                        'status' => 'error',
                        'message' => 'Cada etapa debe tener un nombre o etapa_id válido'
                    ], 422);
                }

                $etapaProducto = null;
                $existingId = isset($item['id']) && is_numeric($item['id']) ? (int)$item['id'] : null;

                if ($existingId) {
                    $etapaProducto = EtapaProducto::where('producto_id', $productId)->find($existingId);
                }

                if ($etapaProducto) {
                    $etapaProducto->update([
                        'etapa_id' => $etapaCatalogId,
                        'orden' => $item['orden'],
                    ]);
                } else {
                    $etapaProducto = EtapaProducto::create([
                        'producto_id' => $productId,
                        'etapa_id' => $etapaCatalogId,
                        'orden' => $item['orden'],
                    ]);
                }

                $keptIds[] = $etapaProducto->id;

                // Registrar en el mapa por ID real y por temp_id si existe
                if ($existingId) {
                    $stageMap[(string)$existingId] = $etapaProducto->id;
                }
                if (!empty($item['temp_id'])) {
                    $stageMap[(string)$item['temp_id']] = $etapaProducto->id;
                }
                $stageMap[(string)$etapaProducto->id] = $etapaProducto->id;
            }

            // 2. Eliminar (soft-delete) etapas_productos que fueron removidas
            EtapaProducto::where('producto_id', $productId)
                ->whereNotIn('id', $keptIds)
                ->delete();

            // 3. Sincronizar dependencias en etapa_producto_dependencias
            foreach ($items as $item) {
                $itemKey = !empty($item['id']) && is_numeric($item['id']) ? (string)$item['id'] : (!empty($item['temp_id']) ? (string)$item['temp_id'] : null);
                if (!$itemKey || !isset($stageMap[$itemKey])) {
                    continue;
                }

                $realEtapaProductoId = $stageMap[$itemKey];
                $depIds = [];

                if (!empty($item['depende_de_ids'])) {
                    foreach ($item['depende_de_ids'] as $depRef) {
                        $refStr = (string)$depRef;
                        if (isset($stageMap[$refStr])) {
                            $depIds[] = $stageMap[$refStr];
                        }
                    }
                }

                $epModel = EtapaProducto::find($realEtapaProductoId);
                if ($epModel) {
                    $epModel->dependencias()->sync($depIds);
                }
            }

            DB::commit();

            // Regenerar tareas para pedidos activos con este producto
            Pedido::regenerarTareasParaProducto($productId);

            $result = EtapaProducto::where('producto_id', $productId)
                ->with(['etapa', 'dependencias.etapa'])
                ->orderBy('orden', 'asc')
                ->get();

            return response()->json([
                'status' => 'success',
                'message' => 'Etapas sincronizadas correctamente',
                'data' => $result
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'status' => 'error',
                'message' => 'Error al sincronizar las etapas: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Algoritmo de detección de ciclos en dependencias.
     */
    private function hasCycle(array $items): bool
    {
        $adj = [];
        $nodes = [];

        foreach ($items as $index => $item) {
            $key = !empty($item['id']) && is_numeric($item['id']) ? (string)$item['id'] : (!empty($item['temp_id']) ? (string)$item['temp_id'] : "idx_$index");
            $nodes[] = $key;
            $adj[$key] = [];

            if (!empty($item['depende_de_ids'])) {
                foreach ($item['depende_de_ids'] as $dep) {
                    $adj[$key][] = (string)$dep;
                }
            }
        }

        $visited = [];
        $recStack = [];

        foreach ($nodes as $node) {
            if (!isset($visited[$node])) {
                if ($this->detectCycleDfs($node, $adj, $visited, $recStack)) {
                    return true;
                }
            }
        }

        return false;
    }

    private function detectCycleDfs(string $node, array &$adj, array &$visited, array &$recStack): bool
    {
        $visited[$node] = true;
        $recStack[$node] = true;

        if (isset($adj[$node])) {
            foreach ($adj[$node] as $neighbor) {
                if (!isset($visited[$neighbor])) {
                    if ($this->detectCycleDfs($neighbor, $adj, $visited, $recStack)) {
                        return true;
                    }
                } elseif (!empty($recStack[$neighbor])) {
                    return true;
                }
            }
        }

        $recStack[$node] = false;
        return false;
    }
}
