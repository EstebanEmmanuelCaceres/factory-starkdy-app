<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Etapa;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\JsonResponse;

class EtapaDependenciaController extends Controller
{
    /**
     * Listar dependencias de etapas.
     */
    public function index(Request $request): JsonResponse
    {
        $query = DB::table('etapa_dependencias');

        if ($request->has('etapa_id')) {
            $query->where('etapa_id', $request->input('etapa_id'));
        }

        if ($request->has('producto_id')) {
            $query->whereIn('etapa_id', function ($q) use ($request) {
                $q->select('id')->from('etapas')->where('producto_id', $request->input('producto_id'));
            });
        }

        $dependencias = $query->get();

        return response()->json([
            'status' => 'success',
            'data' => $dependencias
        ]);
    }

    /**
     * Crear una dependencia (etapa_id depende de depende_de_etapa_id).
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'etapa_id' => 'required|exists:etapas,id',
            'depende_de_etapa_id' => 'required|exists:etapas,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Error de validación',
                'errors' => $validator->errors()
            ], 422);
        }

        $etapaId = $request->input('etapa_id');
        $dependeDeEtapaId = $request->input('depende_de_etapa_id');

        // 1. Evitar autodependencia directa
        if ($etapaId == $dependeDeEtapaId) {
            return response()->json([
                'status' => 'error',
                'message' => 'Una etapa no puede depender de sí misma'
            ], 422);
        }

        // 2. Verificar que ambas etapas pertenezcan al mismo producto
        $etapa = Etapa::find($etapaId);
        $dependeDeEtapa = Etapa::find($dependeDeEtapaId);

        if ($etapa->producto_id !== $dependeDeEtapa->producto_id) {
            return response()->json([
                'status' => 'error',
                'message' => 'Ambas etapas deben pertenecer al mismo producto'
            ], 422);
        }

        // 3. Validar si ya existe
        $exists = DB::table('etapa_dependencias')
            ->where('etapa_id', $etapaId)
            ->where('depende_de_etapa_id', $dependeDeEtapaId)
            ->exists();

        if ($exists) {
            return response()->json([
                'status' => 'error',
                'message' => 'Esta dependencia ya se encuentra registrada'
            ], 422);
        }

        // 4. Validar detección de ciclos en el grafo (DAG)
        if ($this->detectsCycle($etapaId, $dependeDeEtapaId)) {
            return response()->json([
                'status' => 'error',
                'message' => 'La dependencia generaría un ciclo infinito en el proceso de fabricación'
            ], 422);
        }

        // 5. Crear la dependencia
        $id = DB::table('etapa_dependencias')->insertGetId([
            'etapa_id' => $etapaId,
            'depende_de_etapa_id' => $dependeDeEtapaId,
            'created_at' => now(),
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Dependencia creada correctamente',
            'data' => [
                'id' => $id,
                'etapa_id' => $etapaId,
                'depende_de_etapa_id' => $dependeDeEtapaId
            ]
        ], 201);
    }

    /**
     * Eliminar una dependencia.
     */
    public function destroy($id): JsonResponse
    {
        $deleted = DB::table('etapa_dependencias')->where('id', $id)->delete();

        if (!$deleted) {
            return response()->json([
                'status' => 'error',
                'message' => 'Dependencia no encontrada'
            ], 404);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Dependencia eliminada correctamente'
        ]);
    }

    /**
     * Detectar si al agregar la relación A depende de B, se produce un ciclo.
     * Hay ciclo si B depende transitivamente de A.
     */
    private function detectsCycle(int $etapaId, int $dependeDeEtapaId): bool
    {
        return $this->hasPath($dependeDeEtapaId, $etapaId);
    }

    private function hasPath(int $fromId, int $toId, array &$visited = []): bool
    {
        if ($fromId === $toId) {
            return true;
        }

        $visited[] = $fromId;

        // Obtener todos los IDs de etapas de las que depende $fromId
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
