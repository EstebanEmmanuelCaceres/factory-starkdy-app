<?php

namespace App\Observers;

use App\Models\Etapa;
use App\Models\EtapaHistorialEstado;
use Illuminate\Support\Facades\Auth;

class EtapaObserver
{
    /**
     * Handle the Etapa "created" event.
     */
    public function created(Etapa $etapa): void
    {
        EtapaHistorialEstado::create([
            'etapa_id' => $etapa->id,
            'user_id' => Auth::id() ?? 1,
            'comentario' => 'Inicialización de la etapa.',
        ]);
    }
}
