<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Ventas de Tiendanube → pedidos (solo si hay credenciales cargadas en el .env)
Schedule::command('tiendanube:sincronizar')
    ->everyFiveMinutes()
    ->withoutOverlapping(10)
    ->when(fn () => config('services.tiendanube.store_id') && config('services.tiendanube.access_token'));
