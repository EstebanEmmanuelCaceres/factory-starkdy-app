<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ProductoController;
use App\Http\Controllers\Api\EtapaController;
use App\Http\Controllers\Api\ClienteController;
use App\Http\Controllers\Api\PedidoController;
use App\Http\Controllers\Api\ResponsabilidadController;
use App\Http\Controllers\Api\ResponsableEtapaController;
use App\Http\Controllers\Api\OperarioTaskController;
use App\Http\Controllers\Api\EtapaDependenciaController;
use App\Http\Controllers\Api\PagoController;
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
    Route::post('productos/{id}/etapas/sync', [EtapaController::class, 'syncEtapas']);

    // ── Dependencias entre Etapas ──────────────────────────────────
    Route::get('etapa-dependencias', [EtapaDependenciaController::class, 'index']);
    Route::post('etapa-dependencias', [EtapaDependenciaController::class, 'store']);
    Route::delete('etapa-dependencias/{id}', [EtapaDependenciaController::class, 'destroy']);

    // ── Clientes ──────────────────────────────────────────────────
    Route::get('clientes', [ClienteController::class, 'index']);
    Route::post('clientes', [ClienteController::class, 'store']);
    Route::get('clientes/{id}', [ClienteController::class, 'show']);
    Route::patch('clientes/{id}', [ClienteController::class, 'update']);
    Route::delete('clientes/{id}', [ClienteController::class, 'destroy']);

    // ── Pedidos ───────────────────────────────────────────────────
    Route::apiResource('pedidos', PedidoController::class);
    Route::post('pedidos/{id}/generar-tareas', [PedidoController::class, 'generarTareasManual']);
    Route::get('pedidos/{id}/comentarios', [PedidoController::class, 'getComentarios']);
    Route::post('pedidos/{id}/comentarios', [PedidoController::class, 'addComentario']);

    // ── Pagos de Pedidos ───────────────────────────────────────────
    Route::get('pedidos/{pedido}/pagos', [PagoController::class, 'index']);
    Route::post('pedidos/{pedido}/pagos', [PagoController::class, 'store']);
    Route::patch('pagos/{pago}', [PagoController::class, 'update']);
    Route::delete('pagos/{pago}', [PagoController::class, 'destroy']);

    // ── Responsabilidades ──────────────────────────────────────────
    Route::get('responsabilidades', [ResponsabilidadController::class, 'index']);
    Route::post('responsabilidades', [ResponsabilidadController::class, 'store']);
    Route::get('responsabilidades/{id}', [ResponsabilidadController::class, 'show']);
    Route::patch('responsabilidades/{id}', [ResponsabilidadController::class, 'update']);
    Route::delete('responsabilidades/{id}', [ResponsabilidadController::class, 'destroy']);

    // ── Gestión de Responsables de Etapa (Supervisor/Encargado) ───
    Route::get('responsables-etapas', [ResponsableEtapaController::class, 'index']);
    Route::post('responsables-etapas', [ResponsableEtapaController::class, 'store']);
    Route::delete('responsables-etapas/{id}', [ResponsableEtapaController::class, 'destroy']);

    // ── Panel del Operario ─────────────────────────────────────────
    Route::prefix('operario')->group(function () {
        Route::get('tasks', [OperarioTaskController::class, 'index']);
        Route::post('tasks/{id}/start', [OperarioTaskController::class, 'start']);
        Route::post('tasks/{id}/complete', [OperarioTaskController::class, 'complete']);
        Route::get('historial', [OperarioTaskController::class, 'historial']);
    });
});
