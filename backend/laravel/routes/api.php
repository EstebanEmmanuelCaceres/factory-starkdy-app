<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ProductoController;
use App\Http\Controllers\Api\EtapaController;
use App\Http\Controllers\Api\ClienteController;
use App\Http\Controllers\Api\PedidoController;
use App\Http\Controllers\Api\ResponsabilidadController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes — Sistema Fábrica
|--------------------------------------------------------------------------
*/

// ── Rutas de autenticación (públicas) ───────────────────────────────
Route::prefix('auth')->group(function () {
    Route::post('/login',    [AuthController::class, 'login'])->name('api.auth.login');
    Route::post('/register', [AuthController::class, 'register'])->name('api.auth.register');
});

// ── Rutas protegidas (requieren token Sanctum) ───────────────────────
Route::middleware('auth:sanctum')->group(function () {
    Route::prefix('auth')->group(function () {
        Route::post('/logout', [AuthController::class, 'logout'])->name('api.auth.logout');
        Route::get('/me', [AuthController::class, 'me'])->name('api.auth.me');
    });

    Route::get('/users', [AuthController::class, 'users'])->name('api.users.index');

    // ── Módulos de fábrica (se irán agregando aquí) ──────────────
    Route::get('productos', [ProductoController::class, 'index']);
    Route::post('productos', [ProductoController::class, 'store']);
    Route::get('productos/{id}', [ProductoController::class, 'show']);
    Route::patch('productos/{id}', [ProductoController::class, 'update']);
    Route::delete('productos/{id}', [ProductoController::class, 'destroy']);

    // ── Etapas de Producto ─────────────────────────────────────────
    Route::get('etapas', [EtapaController::class, 'index']);
    Route::post('etapas', [EtapaController::class, 'store']);
    Route::get('etapas/{id}', [EtapaController::class, 'show']);
    Route::patch('etapas/{id}', [EtapaController::class, 'update']);
    Route::delete('etapas/{id}', [EtapaController::class, 'destroy']);
    Route::post('etapas/{id}/operarios', [EtapaController::class, 'asignarOperario']);
    Route::delete('etapas/{id}/operarios/{userId}', [EtapaController::class, 'desasignarOperario']);

    // ── Clientes ──────────────────────────────────────────────────
    Route::get('clientes', [ClienteController::class, 'index']);
    Route::post('clientes', [ClienteController::class, 'store']);
    Route::get('clientes/{id}', [ClienteController::class, 'show']);
    Route::patch('clientes/{id}', [ClienteController::class, 'update']);
    Route::delete('clientes/{id}', [ClienteController::class, 'destroy']);

    // ── Pedidos ───────────────────────────────────────────────────
    Route::apiResource('pedidos', PedidoController::class);

    // ── Responsabilidades ──────────────────────────────────────────
    Route::get('responsabilidades', [ResponsabilidadController::class, 'index']);
    Route::post('responsabilidades', [ResponsabilidadController::class, 'store']);
    Route::get('responsabilidades/{id}', [ResponsabilidadController::class, 'show']);
    Route::patch('responsabilidades/{id}', [ResponsabilidadController::class, 'update']);
    Route::delete('responsabilidades/{id}', [ResponsabilidadController::class, 'destroy']);
});
