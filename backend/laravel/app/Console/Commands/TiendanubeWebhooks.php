<?php

namespace App\Console\Commands;

use App\Services\TiendanubeClient;
use Illuminate\Console\Command;

class TiendanubeWebhooks extends Command
{
    protected $signature = 'tiendanube:webhooks {accion=listar : listar | registrar | borrar} {id? : id del webhook (solo para borrar)}';

    protected $description = 'Lista, registra o borra los webhooks de Tiendanube (usa TIENDANUBE_WEBHOOK_URL del .env)';

    private const EVENTOS = ['order/created', 'order/paid', 'order/cancelled'];

    public function handle(TiendanubeClient $client): int
    {
        switch ($this->argument('accion')) {
            case 'listar':
                $this->table(['id', 'evento', 'url'], collect($client->webhooks())->map(fn ($w) => [$w['id'], $w['event'], $w['url']])->all());

                return self::SUCCESS;

            case 'registrar':
                $url = config('services.tiendanube.webhook_url');
                if (!$url) {
                    $this->error('Falta TIENDANUBE_WEBHOOK_URL en el .env.');

                    return self::FAILURE;
                }
                // Los que ya apuntan a esta URL no se vuelven a registrar
                $existentes = collect($client->webhooks())->where('url', $url)->pluck('event')->all();
                foreach (self::EVENTOS as $evento) {
                    if (in_array($evento, $existentes, true)) {
                        $this->line("= {$evento} ya estaba registrado");
                        continue;
                    }
                    $client->registrarWebhook($evento, $url);
                    $this->info("+ {$evento} registrado → {$url}");
                }

                return self::SUCCESS;

            case 'borrar':
                if (!$this->argument('id')) {
                    $this->error('Indicá el id del webhook: php artisan tiendanube:webhooks borrar 123');

                    return self::FAILURE;
                }
                $client->borrarWebhook($this->argument('id'));
                $this->info('Webhook borrado.');

                return self::SUCCESS;
        }

        $this->error('Acción inválida. Usá: listar | registrar | borrar');

        return self::FAILURE;
    }
}
