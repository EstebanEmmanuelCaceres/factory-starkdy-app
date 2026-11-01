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
     * Incluye las etapas quitadas del producto (borrado lógico): los pedidos que ya las tenían las conservan.
     */
    public function etapaProducto(): BelongsTo
    {
        return $this->belongsTo(EtapaProducto::class, 'etapa_producto_id')->withTrashed();
    }

    /**
     * Relación o helper de conveniencia para acceder directamente a la EtapaProducto / Etapa.
     */
    public function etapa(): BelongsTo
    {
        return $this->belongsTo(EtapaProducto::class, 'etapa_producto_id')->withTrashed();
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
    }

    public function isBlockedByDependencies(): bool
    {
        // "para este caso no bloquees las que ya estan completas despuse de la que quiero revisar, eso traería problemas."
        if ($this->estado === 'completado') {
            return false;
        }

        // Dependencias explícitas en etapa_producto_dependencias (incluyendo transitivas)
        $directDeps = \DB::table('etapa_producto_dependencias')
            ->where('etapa_producto_id', $this->etapa_producto_id)
            ->pluck('depende_de_etapa_producto_id')
            ->toArray();

        $allDeps = $directDeps;
        $toCheck = $directDeps;
        while (!empty($toCheck)) {
            $curr = array_pop($toCheck);
            $parentDeps = \DB::table('etapa_producto_dependencias')
                ->where('etapa_producto_id', $curr)
                ->pluck('depende_de_etapa_producto_id')
                ->toArray();
            foreach ($parentDeps as $pId) {
                if (!in_array($pId, $allDeps)) {
                    $allDeps[] = $pId;
                    $toCheck[] = $pId;
                }
            }
        }

        // El bloqueo depende solo de etapa_producto_dependencias. El orden es solo visual:
        // las etapas paralelas (que dependen de la misma etapa) se habilitan juntas.
        // Solo cuentan las dependencias que este pedido tiene como tarea: si al producto se le agregó
        // una etapa después de crear el pedido, el pedido no la tiene y no debe quedar esperándola.
        if (!empty($allDeps)) {
            $estadosDependencias = self::where('pedido_id', $this->pedido_id)
                ->whereIn('etapa_producto_id', array_unique($allDeps))
                ->pluck('estado');

            if ($estadosDependencias->contains(fn($estado) => $estado !== 'completado')) {
                return true;
            }
        }

        if ($this->estado === 'bloqueada') {
            $this->update(['estado' => 'pendiente']);
        }

        return false;
    }
}
