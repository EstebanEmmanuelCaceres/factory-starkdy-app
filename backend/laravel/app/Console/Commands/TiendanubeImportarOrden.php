<?php

namespace App\Console\Commands;

use App\Services\TiendanubeClient;
use App\Services\TiendanubeOrderImporter;
use Illuminate\Console\Command;

class TiendanubeImportarOrden extends Command
{
    protected $signature = 'tiendanube:importar {orden : id de la orden en Tiendanube}';

    protected $description = 'Importa a mano una orden de Tiendanube como pedido (útil para probar sin webhook)';

    public function handle(TiendanubeClient $client, TiendanubeOrderImporter $importer): int
    {
        $pedido = $importer->importar($client->orden($this->argument('orden')));
        $this->info("Pedido {$pedido->codigo} (id {$pedido->id}) — estado de pago: {$pedido->estado_pago}");

        return self::SUCCESS;
    }
}
