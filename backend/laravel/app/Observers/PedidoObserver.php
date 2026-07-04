<?php

namespace App\Observers;

use App\Models\Pedido;
use App\Models\PedidoHistorialEstado;
use Illuminate\Support\Facades\Auth;

class PedidoObserver
{
    /**
     * Handle the Pedido "created" event.
     */
    public function created(Pedido $pedido): void
    {
        PedidoHistorialEstado::create([
            'pedido_id' => $pedido->id,
            'user_id' => Auth::id() ?? 1,
            'estado_anterior' => null,
            'estado_nuevo' => $pedido->estado ?? 'pendiente',
            'comentario' => 'Inicialización del pedido.',
        ]);
    }

    /**
     * Handle the Pedido "updated" event.
     */
    public function updated(Pedido $pedido): void
    {
        if ($pedido->isDirty('estado')) {
            PedidoHistorialEstado::create([
                'pedido_id' => $pedido->id,
                'user_id' => Auth::id() ?? 1,
                'estado_anterior' => $pedido->getOriginal('estado'),
                'estado_nuevo' => $pedido->estado,
                'comentario' => 'Cambio de estado del pedido.',
            ]);
        }
    }
}
