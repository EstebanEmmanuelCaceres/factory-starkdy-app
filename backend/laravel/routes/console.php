<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Respaldo de ventas de Tiendanube → pedidos cada 30 min (webhooks activos en tiempo real)
Schedule::command('tiendanube:sincronizar')
    ->everyThirtyMinutes()
    ->withoutOverlapping(10)
    ->when(fn () => config('services.tiendanube.store_id') && config('services.tiendanube.access_token'));
