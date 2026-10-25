<?php

namespace App\Services;

use App\Models\Pedido;
use App\Models\ResponsableEtapa;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class PedidoWorkflowService
{
    /**
     * Sincroniza el estado general del pedido según el avance de sus etapas.
     * - Si todas las etapas están completadas -> pasa a "completado".
     * - Si al menos una etapa se completó y estaba en "pendiente" o "listo_para_produccion" -> pasa a "en_progreso".
     * - Si estaba en "completado" pero se reabrió alguna etapa -> pasa a "en_progreso".
     */
    public function sincronizarEstadoPedido(int $pedidoId): bool
    {
        if (!$pedidoId) {
            return false;
        }

        $totalTasks = ResponsableEtapa::where('pedido_id', $pedidoId)->count();
        if ($totalTasks === 0) {
            return false;
        }

        $incompleteTasks = ResponsableEtapa::where('pedido_id', $pedidoId)
            ->where('estado', '!=', 'completado')
            ->count();

        $pedido = Pedido::find($pedidoId);
        if (!$pedido) {
            return false;
        }

        if ($incompleteTasks === 0) {
            if (!in_array($pedido->estado, ['completado', 'completado_pd', 'enviado', 'enviado_faltante', 'cancelado'])) {
                $pedido->estado = 'completado';
                $pedido->save();
                return true;
            }
        } else {
            $completedTasks = $totalTasks - $incompleteTasks;
            $inProgressTasks = ResponsableEtapa::where('pedido_id', $pedidoId)
                ->where('estado', 'en_progreso')
                ->count();

            if ($completedTasks > 0 || $inProgressTasks > 0) {
                if (in_array($pedido->estado, ['pendiente', 'listo_para_produccion'])) {
                    $pedido->estado = 'en_progreso';
                    $pedido->save();
                    return true;
                }
            }

            if ($pedido->estado === 'completado') {
                $pedido->estado = 'en_progreso';
                $pedido->save();
                return true;
            }
        }

        return false;
    }

    /**
     * Actualiza el bloqueo de etapas según dependencias y orden cronológico.
     * Importante: Nunca bloquea las etapas que ya se encuentran completadas.
     */
    public function actualizarBloqueosPedido(int $pedidoId): void
    {
        $tasks = ResponsableEtapa::where('pedido_id', $pedidoId)->get();

        foreach ($tasks as $task) {
            // "para este caso no bloquees las que ya estan completas despuse de la que quiero revisar, eso traería problemas."
            if ($task->estado === 'completado') {
                continue;
            }

            $isBlocked = $task->isBlockedByDependencies();
            if ($isBlocked && $task->estado !== 'bloqueada') {
                $estadoAnterior = $task->estado;
                $task->update(['estado' => 'bloqueada']);
                $this->logStateChange($task, $estadoAnterior, 'bloqueada', 'Bloqueo automático por etapa previa no completada');
            } elseif (!$isBlocked && $task->estado === 'bloqueada') {
                $estadoAnterior = $task->estado;
                $task->update(['estado' => 'pendiente']);
                $this->logStateChange($task, $estadoAnterior, 'pendiente', 'Desbloqueo automático por cumplimiento de etapas previas');
            }
        }
    }

    /**
     * Desbloquea las etapas de un pedido cuyas dependencias ya fueron completadas.
     */
    public function desbloquearTareasSatisfechas(int $pedidoId): void
    {
        $this->actualizarBloqueosPedido($pedidoId);
    }

    /**
     * Marcar una etapa como completada, desbloquear dependencias y sincronizar estado del pedido.
     */
    public function completarTarea(
        ResponsableEtapa $task,
        ?int $userId = null,
        ?string $observacion = 'Tarea completada'
    ): ResponsableEtapa {
        $estadoAnterior = $task->estado;

        $updateData = [
            'estado' => 'completado',
            'fecha_inicio' => $task->fecha_inicio ?? now(),
            'fecha_fin' => now(),
        ];

        if ($userId) {
            $updateData['user_id'] = $userId;
        }

        $task->update($updateData);

        $this->logStateChange($task, $estadoAnterior, 'completado', $observacion, $userId);
        $this->actualizarBloqueosPedido($task->pedido_id);
        $this->sincronizarEstadoPedido($task->pedido_id);

        return $task->fresh();
    }

    /**
     * Completar en lote varias tareas de un pedido (ej. diseños pendientes).
     */
    public function completarTareasPorIds(
        int $pedidoId,
        array $taskIds,
        ?int $userId = null,
        ?string $observacion = 'Completado en lote'
    ): void {
        $tasks = ResponsableEtapa::where('pedido_id', $pedidoId)
            ->whereIn('id', $taskIds)
            ->get();

        foreach ($tasks as $task) {
            if ($task->estado !== 'completado') {
                $estadoAnterior = $task->estado;
                $task->update([
                    'estado' => 'completado',
                    'fecha_inicio' => $task->fecha_inicio ?? now(),
                    'fecha_fin' => now(),
                ]);
                $this->logStateChange($task, $estadoAnterior, 'completado', $observacion, $userId);
            }
        }

        $this->actualizarBloqueosPedido($pedidoId);
        $this->sincronizarEstadoPedido($pedidoId);
    }

    /**
     * Iniciar una etapa (pasar a 'en_progreso').
     */
    public function iniciarTarea(
        ResponsableEtapa $task,
        ?int $userId = null,
        ?string $observacion = 'Tarea iniciada'
    ): ResponsableEtapa {
        $estadoAnterior = $task->estado;

        $updateData = [
            'estado' => 'en_progreso',
            'fecha_inicio' => $task->fecha_inicio ?? now(),
        ];

        if ($userId) {
            $updateData['user_id'] = $userId;
        }

        $task->update($updateData);
        $this->logStateChange($task, $estadoAnterior, 'en_progreso', $observacion, $userId);
        $this->sincronizarEstadoPedido($task->pedido_id);

        return $task->fresh();
    }

    /**
     * Cambiar el estado de una etapa y sincronizar consecuencias.
     */
    public function cambiarEstadoTarea(
        ResponsableEtapa $task,
        string $nuevoEstado,
        ?int $userId = null,
        ?string $observacion = null
    ): ResponsableEtapa {
        $estadoAnterior = $task->estado;

        if ($estadoAnterior === $nuevoEstado) {
            if ($userId && $task->user_id !== $userId) {
                $task->update(['user_id' => $userId]);
            }
            return $task->fresh();
        }

        $updateData = ['estado' => $nuevoEstado];
        if ($userId) {
            $updateData['user_id'] = $userId;
        }
        if ($nuevoEstado === 'completado') {
            $updateData['fecha_inicio'] = $task->fecha_inicio ?? now();
            $updateData['fecha_fin'] = now();
        }

        $task->update($updateData);
        $this->logStateChange($task, $estadoAnterior, $nuevoEstado, $observacion, $userId);

        $this->actualizarBloqueosPedido($task->pedido_id);
        $this->sincronizarEstadoPedido($task->pedido_id);

        return $task->fresh();
    }

    /**
     * Registrar cambio de estado en la tabla de auditoría etapa_historial_estado.
     */
    public function logStateChange(
        ResponsableEtapa $task,
        ?string $estadoAnterior,
        ?string $estadoNuevo,
        ?string $observacion = null,
        ?int $userId = null
    ): void {
        DB::table('etapa_historial_estado')->insert([
            'responsable_etapa_id' => $task->id,
            'user_id' => $userId ?? Auth::id() ?? $task->pedido?->user_id ?? 1,
            'estado_anterior' => $estadoAnterior,
            'estado_nuevo' => $estadoNuevo,
            'observacion' => $observacion,
            'created_at' => now(),
        ]);
    }
}
