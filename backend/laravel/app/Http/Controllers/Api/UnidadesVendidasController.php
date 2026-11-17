<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\UnidadesVendidasRequest;
use App\Http\Resources\UnidadesVendidasResource;
use App\Services\UnidadesVendidasService;
use Illuminate\Http\JsonResponse;

/**
 * Controlador de Unidades Vendidas por Producto.
 *
 * Única responsabilidad: conectar el endpoint HTTP con la validación de entrada
 * (`UnidadesVendidasRequest`), delegar la lógica de negocio a `UnidadesVendidasService`
 * y formatear la salida con `UnidadesVendidasResource`.
 */
class UnidadesVendidasController extends Controller
{
    public function __construct(
        private readonly UnidadesVendidasService $unidadesVendidasService
    ) {
    }

    /**
     * GET /api/metricas/unidades-vendidas
     */
    public function index(UnidadesVendidasRequest $request): JsonResponse
    {
        $resultado = $this->unidadesVendidasService->obtenerUnidadesVendidasPorIntervalo(
            $request->filtros(),
            $request->user()
        );

        return response()->json([
            'status' => 'success',
            'data' => (new UnidadesVendidasResource($resultado))->resolve($request),
        ]);
    }
}
