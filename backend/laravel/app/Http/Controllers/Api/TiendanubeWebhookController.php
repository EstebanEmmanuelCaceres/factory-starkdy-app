<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\TiendanubeClient;
use App\Services\TiendanubeOrderImporter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Webhooks de Tiendanube. Payload: {"store_id": 123, "event": "order/paid", "id": 456}.
 * El detalle de la orden se pide aparte a la API (ver TiendanubeOrderImporter).
 */
class TiendanubeWebhookController extends Controller
{
    private const EVENTOS = ['order/created', 'order/paid', 'order/cancelled'];

    public function __invoke(Request $request, TiendanubeClient $client, TiendanubeOrderImporter $importer): JsonResponse
    {
        if (!$this->firmaValida($request)) {
            Log::warning('Tiendanube webhook: firma inválida');

            return response()->json(['status' => 'error', 'message' => 'Firma inválida'], 401);
        }

        $evento = (string) $request->input('event');
        $ordenId = $request->input('id');
        $tienda = (string) $request->input('store_id');

        $tiendaConfigurada = (string) config('services.tiendanube.store_id');
        if ($tiendaConfigurada !== '' && $tienda !== $tiendaConfigurada) {
            return response()->json(['status' => 'ignored', 'message' => 'Tienda distinta a la configurada']);
        }

        if (!in_array($evento, self::EVENTOS, true) || empty($ordenId)) {
            return response()->json(['status' => 'ignored']);
        }

        try {
            if ($evento === 'order/cancelled') {
                $importer->cancelar((string) $ordenId);
            } else {
                $importer->importar($client->orden((string) $ordenId));
            }

            return response()->json(['status' => 'ok']);
        } catch (Throwable $e) {
            Log::error('Tiendanube webhook: error procesando evento ' . $evento . ' para orden ' . $ordenId, [
                'error' => $e->getMessage(),
                'file' => $e->getFile() . ':' . $e->getLine(),
            ]);

            // Se devuelve 500 para que Tiendanube reintente automáticamente el webhook
            return response()->json([
                'status' => 'error',
                'message' => 'Error al procesar el evento de Tiendanube: ' . $e->getMessage(),
            ], 500);
        }
    }

    /** HMAC-SHA256 del body crudo con el client secret de la app, en el header x-linkedstore-hmac-sha256. */
    private function firmaValida(Request $request): bool
    {
        $secreto = (string) config('services.tiendanube.client_secret');
        $firma = (string) $request->header('x-linkedstore-hmac-sha256');

        if ($secreto === '' || $firma === '') {
            return false;
        }

        return hash_equals(hash_hmac('sha256', $request->getContent(), $secreto), $firma);
    }
}
