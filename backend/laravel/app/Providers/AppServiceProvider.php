<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        \App\Models\Pedido::observe(\App\Observers\PedidoObserver::class);
        \App\Models\Etapa::observe(\App\Observers\EtapaObserver::class);
    }
}
