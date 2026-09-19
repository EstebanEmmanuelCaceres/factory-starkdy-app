<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ResponsableEtapa extends Model
{
    use HasFactory;

    protected $table = 'responsables_etapas';

    protected $fillable = [
        'pedido_id',
        'etapa_producto_id',
        'user_id',
        'estado',
        'fecha_inicio',
        'fecha_fin',
    ];

    protected $casts = [
        'fecha_inicio' => 'datetime',
        'fecha_fin' => 'datetime',
    ];

    /**
     * Relación: La tarea pertenece a un pedido.
     */
    public function pedido(): BelongsTo
    {
        return $this->belongsTo(Pedido::class, 'pedido_id');
    }

    /**
     * Relación: La tarea pertenece a una EtapaProducto.
     */
    public function etapaProducto(): BelongsTo
    {
        return $this->belongsTo(EtapaProducto::class, 'etapa_producto_id');
    }

    /**
     * Relación o helper de conveniencia para acceder directamente a la EtapaProducto / Etapa.
     */
    public function etapa(): BelongsTo
    {
        return $this->belongsTo(EtapaProducto::class, 'etapa_producto_id');
    }

    /**
     * Relación: La tarea está asignada a un operario (usuario).
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /**
     * Relación: Historiales de cambio de estado.
     */
    public function historiales(): HasMany
    {
        return $this->hasMany(EtapaHistorialEstado::class, 'responsable_etapa_id');
    }

    protected static function booted()
    {
        static::creating(function ($task) {
            if (empty($task->user_id)) {
                $adminUser = User::whereHas('role', function ($q) {
                    $q->where('slug', 'admin');
                })->first() ?? User::first();

                if ($adminUser) {
                    $task->user_id = $adminUser->id;
                }
            }
        });

        static::created(function ($task) {
            self::logStateChange($task, null, $task->estado, 'Creación automática/manual de tarea');
        });

        static::updating(function ($task) {
            if ($task->isDirty('estado')) {
                self::logStateChange($task, $task->getOriginal('estado'), $task->estado, 'Cambio de estado');
            }
        });

        static::updated(function ($task) {
            if ($task->wasChanged('estado')) {
                if ($task->estado === 'completado') {
                    self::unblockDependentTasks($task);
                }
                self::checkAndCompletePedidoIfAllTasksDone($task->pedido_id);
            }
        });
    }

    public static function logStateChange($task, $estadoAnterior, $estadoNuevo, $observacion = null)
    {
        \DB::table('etapa_historial_estado')->insert([
            'responsable_etapa_id' => $task->id,
            'user_id' => \Auth::id() ?? $task->pedido->user_id ?? 1,
            'estado_anterior' => $estadoAnterior,
            'estado_nuevo' => $estadoNuevo,
            'observacion' => $observacion,
            'created_at' => now(),
        ]);
    }

    public function isBlockedByDependencies(): bool
    {
        $requiredEtapaProductoIds = \DB::table('etapa_producto_dependencias')
            ->where('etapa_producto_id', $this->etapa_producto_id)
            ->pluck('depende_de_etapa_producto_id')
            ->toArray();

        if (!empty($requiredEtapaProductoIds)) {
            $completedCount = self::where('pedido_id', $this->pedido_id)
                ->whereIn('etapa_producto_id', $requiredEtapaProductoIds)
                ->where('estado', 'completado')
                ->count();

            if ($completedCount < count($requiredEtapaProductoIds)) {
                return true;
            }
        }

        if ($this->estado === 'bloqueada') {
            $this->update(['estado' => 'pendiente']);
        }

        return false;
    }

    public static function unblockDependentTasks($task)
    {
        self::unblockAllSatisfiedTasksForPedido($task->pedido_id);
    }

    public static function unblockAllSatisfiedTasksForPedido($pedidoId)
    {
        $blockedTasks = self::where('pedido_id', $pedidoId)
            ->where('estado', 'bloqueada')
            ->get();

        foreach ($blockedTasks as $bTask) {
            if (!$bTask->isBlockedByDependencies()) {
                $bTask->update([
                    'estado' => 'pendiente'
                ]);
            }
        }

        self::checkAndCompletePedidoIfAllTasksDone($pedidoId);
    }

    /**
     * Verifica si todas las etapas/tareas de todos los productos del pedido están completadas.
     * Si es así, cambia automáticamente el estado del pedido a 'completado'.
     */
    public static function checkAndCompletePedidoIfAllTasksDone($pedidoId): bool
    {
        if (!$pedidoId) return false;

        $totalTasks = self::where('pedido_id', $pedidoId)->count();
        if ($totalTasks === 0) return false;

        $incompleteTasks = self::where('pedido_id', $pedidoId)
            ->where('estado', '!=', 'completado')
            ->count();

        $pedido = Pedido::find($pedidoId);
        if (!$pedido) return false;

        if ($incompleteTasks === 0) {
            if (!in_array($pedido->estado, ['completado', 'completado_pd', 'enviado', 'enviado_faltante', 'cancelado'])) {
                $pedido->estado = 'completado';
                $pedido->save();
                return true;
            }
        } else {
            if ($pedido->estado === 'completado') {
                $pedido->estado = 'en_produccion';
                $pedido->save();
                return true;
            }
        }

        return false;
    }
}
