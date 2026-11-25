<?php

namespace App\Console\Commands;

use App\Services\TiendanubeClient;
use App\Services\TiendanubeOrderImporter;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Trae de Tiendanube las órdenes modificadas en las últimas horas y crea los pedidos que falten.
 * No guarda estado: la ventana se solapa a propósito y el importador es idempotente, así que repetir
 * una orden no duplica nada. Corre cada 5 minutos desde el scheduler (routes/console.php).
 */
class TiendanubeSincronizar extends Command
{
    protected $signature = 'tiendanube:sincronizar
        {--horas=24 : ventana hacia atrás, en horas (usar un valor grande para recuperar ventas viejas)}
        {--por-pagina=100 : órdenes por página de la API (máx. 200)}';

    protected $description = 'Importa las ventas pagadas de Tiendanube que todavía no están en el sistema';

    private const MAX_PAGINAS = 50;

    public function handle(TiendanubeClient $client, TiendanubeOrderImporter $importer): int
    {
        $desde = now()->subHours(max(1, (int) $this->option('horas')));
        $porPagina = min(200, max(1, (int) $this->option('por-pagina')));
        $conteo = ['creada' => 0, 'existente' => 0, 'cancelada' => 0, 'ignorada' => 0, 'error' => 0];

        for ($pagina = 1; $pagina <= self::MAX_PAGINAS; $pagina++) {
            $ordenes = $client->ordenesActualizadasDesde($desde, $pagina, $porPagina);

            foreach ($ordenes as $orden) {
                try {
                    $conteo[$importer->sincronizar($orden)]++;
                } catch (Throwable $e) {
                    // Una orden con problemas no frena a las demás; se reintenta en la próxima corrida
                    $conteo['error']++;
                    Log::error('Tiendanube: no se pudo importar la orden', ['orden' => $orden['id'] ?? null, 'error' => $e->getMessage()]);
                    $this->warn('Orden ' . ($orden['id'] ?? '?') . ': ' . $e->getMessage());
                }
            }

            if (count($ordenes) < $porPagina) {
                break;
            }

            if ($pagina === self::MAX_PAGINAS) {
                Log::warning('Tiendanube: se alcanzó el tope de páginas al sincronizar, pueden quedar órdenes sin procesar', [
                    'max_paginas' => self::MAX_PAGINAS,
                    'por_pagina' => $porPagina,
                    'desde' => $desde->toAtomString(),
                ]);
                $this->warn('Se alcanzó el tope de ' . self::MAX_PAGINAS . ' páginas; pueden quedar órdenes sin sincronizar.');
            }
        }

        $this->info(sprintf(
            'Tiendanube: %d nuevas, %d ya existentes, %d canceladas, %d ignoradas (sin pagar), %d con error',
            $conteo['creada'], $conteo['existente'], $conteo['cancelada'], $conteo['ignorada'], $conteo['error']
        ));

        return $conteo['error'] > 0 ? self::FAILURE : self::SUCCESS;
    }
}
