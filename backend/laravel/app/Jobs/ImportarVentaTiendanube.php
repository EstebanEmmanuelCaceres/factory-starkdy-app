<?php

namespace App\Jobs;

use App\Services\TiendanubeClient;
use App\Services\TiendanubeOrderImporter;
use Illuminate\Foundation\Bus\Dispatchable;

/**
 * Procesa un evento de orden de Tiendanube. El webhook lo despacha con dispatchAfterResponse():
 * se responde 200 enseguida y esto corre al terminar la request (el contenedor no tiene worker de colas).
 */
class ImportarVentaTiendanube
{
    use Dispatchable;

    public function __construct(
        public readonly string $evento,
        public readonly string $ordenId,
    ) {
    }

    public function handle(TiendanubeClient $client, TiendanubeOrderImporter $importer): void
    {
        if ($this->evento === 'order/cancelled') {
            $importer->cancelar($this->ordenId);

            return;
        }

        $importer->importar($client->orden($this->ordenId));
    }
}
