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
            'estado_anterior' => null,
            'estado_nuevo' => $etapa->estado ?? 'pendiente',
            'comentario' => 'Inicialización de la etapa.',
        ]);
    }

    /**
     * Handle the Etapa "updating" event.
     */
    public function updating(Etapa $etapa): void
    {
        if ($etapa->isDirty('estado')) {
            $estado = strtolower($etapa->estado);
            if ($estado === 'en_progreso' || $estado === 'en progreso' || $estado === 'progreso') {
                $etapa->fecha_inicio = now();
            } elseif ($estado === 'completado' || $estado === 'completada' || $estado === 'finalizado') {
                $etapa->fecha_fin = now();
            }
        }
    }

    /**
     * Handle the Etapa "updated" event.
     */
    public function updated(Etapa $etapa): void
    {
        if ($etapa->isDirty('estado')) {
            EtapaHistorialEstado::create([
                'etapa_id' => $etapa->id,
                'user_id' => Auth::id() ?? 1,
                'estado_anterior' => $etapa->getOriginal('estado'),
                'estado_nuevo' => $etapa->estado,
                'comentario' => 'Cambio de estado de la etapa.',
            ]);
        }
    }
}
