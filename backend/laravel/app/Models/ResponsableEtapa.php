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
        static::created(function ($task) {
            self::logStateChange($task, null, $task->estado, 'Creación automática/manual de tarea');
        });

        static::updating(function ($task) {
            if ($task->isDirty('estado')) {
                self::logStateChange($task, $task->getOriginal('estado'), $task->estado, 'Cambio de estado');
            }
        });

        static::updated(function ($task) {
            if ($task->wasChanged('estado') && $task->estado === 'completado') {
                self::unblockDependentTasks($task);
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

    public static function unblockDependentTasks($task)
    {
        // Obtener etapas_productos que dependen directamente de la etapa que acabamos de completar
        $dependentEtapaProductoIds = \DB::table('etapa_producto_dependencias')
            ->where('depende_de_etapa_producto_id', $task->etapa_producto_id)
            ->pluck('etapa_producto_id')
            ->toArray();
            
        if (empty($dependentEtapaProductoIds)) {
            return;
        }

        // Para cada etapa dependiente, verificar si todas sus dependencias están completadas para este pedido
        foreach ($dependentEtapaProductoIds as $etapaProductoId) {
            // Obtener todas las etapas previas de las que depende esta etapa
            $requiredEtapaProductoIds = \DB::table('etapa_producto_dependencias')
                ->where('etapa_producto_id', $etapaProductoId)
                ->pluck('depende_de_etapa_producto_id')
                ->toArray();
                
            // Contar cuántas de estas dependencias ya están en estado 'completado' para este pedido
            $completedCount = self::where('pedido_id', $task->pedido_id)
                ->whereIn('etapa_producto_id', $requiredEtapaProductoIds)
                ->where('estado', 'completado')
                ->count();
                
            // Si el número de dependencias completadas coincide con el total de dependencias requeridas
            if ($completedCount === count($requiredEtapaProductoIds)) {
                // Desbloquear la tarea
                $dependentTask = self::where('pedido_id', $task->pedido_id)
                    ->where('etapa_producto_id', $etapaProductoId)
                    ->first();
                    
                if ($dependentTask && $dependentTask->estado === 'bloqueada') {
                    $dependentTask->update([
                        'estado' => 'pendiente'
                    ]);
                }
            }
        }
    }
}
