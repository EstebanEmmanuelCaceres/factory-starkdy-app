<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        // Permite que Sanctum gestione tokens Bearer en las rutas api/*
        // No usamos statefulApi() porque el frontend consume la API via token, no cookies
    })
    ->withExceptions(function (Exceptions $exceptions) {
        //
    })->create();
