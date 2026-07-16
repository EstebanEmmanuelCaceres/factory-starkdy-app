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
        'etapa_id',
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
     * Relación: La tarea pertenece a una etapa.
     */
    public function etapa(): BelongsTo
    {
        return $this->belongsTo(Etapa::class, 'etapa_id');
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
        // Obtener etapas que dependen directamente de la etapa que acabamos de completar
        $dependentEtapaIds = \DB::table('etapa_dependencias')
            ->where('depende_de_etapa_id', $task->etapa_id)
            ->pluck('etapa_id')
            ->toArray();
            
        if (empty($dependentEtapaIds)) {
            return;
        }

        // Para cada etapa dependiente, verificar si todas sus dependencias están completadas para este pedido
        foreach ($dependentEtapaIds as $etapaId) {
            // Obtener todas las etapas previas de las que depende esta etapa
            $requiredEtapaIds = \DB::table('etapa_dependencias')
                ->where('etapa_id', $etapaId)
                ->pluck('depende_de_etapa_id')
                ->toArray();
                
            // Contar cuántas de estas dependencias ya están en estado 'completado' para este pedido
            $completedCount = self::where('pedido_id', $task->pedido_id)
                ->whereIn('etapa_id', $requiredEtapaIds)
                ->where('estado', 'completado')
                ->count();
                
            // Si el número de dependencias completadas coincide con el total de dependencias requeridas
            if ($completedCount === count($requiredEtapaIds)) {
                // Desbloquear la tarea
                $dependentTask = self::where('pedido_id', $task->pedido_id)
                    ->where('etapa_id', $etapaId)
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
