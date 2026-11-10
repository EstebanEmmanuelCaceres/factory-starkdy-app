<?php

namespace App\Services;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * Cliente mínimo de la API de Tiendanube (https://tiendanube.github.io/api-documentation).
 * Credenciales en config/services.php → 'tiendanube' (variables TIENDANUBE_* del .env).
 */
class TiendanubeClient
{
    private const BASE_URL = 'https://api.tiendanube.com/v1';

    /** Orden completa (productos, cliente, pago, envío). */
    public function orden(int|string $id): array
    {
        return $this->http()->get("orders/{$id}")->throw()->json();
    }

    /** Webhooks registrados en la tienda. */
    public function webhooks(): array
    {
        return $this->http()->get('webhooks')->throw()->json() ?? [];
    }

    public function registrarWebhook(string $evento, string $url): array
    {
        return $this->http()->post('webhooks', ['event' => $evento, 'url' => $url])->throw()->json();
    }

    public function borrarWebhook(int|string $id): void
    {
        $this->http()->delete("webhooks/{$id}")->throw();
    }

    private function http(): PendingRequest
    {
        $config = config('services.tiendanube');

        if (empty($config['store_id']) || empty($config['access_token'])) {
            throw new RuntimeException('Faltan TIENDANUBE_STORE_ID y/o TIENDANUBE_ACCESS_TOKEN en el .env.');
        }

        return Http::baseUrl(self::BASE_URL . "/{$config['store_id']}/")
            ->withHeaders([
                // Tiendanube usa "Authentication" (no "Authorization") y exige User-Agent
                'Authentication' => 'bearer ' . $config['access_token'],
                'User-Agent' => $config['user_agent'] ?: 'StarkDY',
            ])
            ->acceptJson()
            ->timeout(15)
            ->retry(2, 500, throw: false);
    }
}
