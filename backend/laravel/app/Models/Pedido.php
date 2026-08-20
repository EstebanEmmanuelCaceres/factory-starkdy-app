<?php

namespace App\Models;

use App\Models\Etapa;
use App\Models\ResponsableEtapa;
use Illuminate\Support\Facades\DB;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class Pedido extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'pedidos';

    protected $with = ['ultimoEstado'];

    protected $attributes = [
        'tipo_pago' => 'parcial',
    ];

    protected $fillable = [
        'cliente_id',
        'user_id',
        'codigo',
        'estado',
        'prioridad',
        'fecha_entrega',
        'precio',
        'comentario',
        'tipo_pago',
    ];

    protected $appends = [
        'estado',
        'monto_pagado',
        'saldo_pendiente',
        'porcentaje_pagado',
        'estado_pago',
    ];

    protected ?string $pendingEstado = null;

    protected static function booted(): void
    {
        static::saved(function (Pedido $pedido) {
            if ($pedido->pendingEstado !== null) {
                $nuevoEstado = $pedido->pendingEstado;
                $pedido->pendingEstado = null;
                $pedido->historialEstados()->create([
                    'estado' => $nuevoEstado,
                    'created_at' => now(),
                ]);
                $pedido->unsetRelation('ultimoEstado');
            } elseif ($pedido->wasRecentlyCreated && $pedido->historialEstados()->count() === 0) {
                $pedido->historialEstados()->create([
                    'estado' => 'pendiente',
                    'created_at' => now(),
                ]);
                $pedido->unsetRelation('ultimoEstado');
            }
        });
    }

    /**
     * Relación: El pedido pertenece a un cliente.
     */
    public function cliente(): BelongsTo
    {
        return $this->belongsTo(Cliente::class, 'cliente_id');
    }

    /**
     * Relación: El pedido fue creado por un usuario.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /**
     * Relación Muchos a Muchos con Productos.
     */
    public function productos(): BelongsToMany
    {
        return $this->belongsToMany(Producto::class, 'pedido_productos', 'pedido_id', 'producto_id')
            ->using(PedidoProducto::class)
            ->withPivot('cantidad')
            ->withTimestamps();
    }

    /**
     * Relación Uno a Muchos con Pagos.
     */
    public function pagos(): HasMany
    {
        return $this->hasMany(Pago::class, 'pedido_id');
    }

    public function pago(): HasOne
    {
        return $this->hasOne(Pago::class, 'pedido_id')->latestOfMany();
    }

    public function comentarios(): HasMany
    {
        return $this->hasMany(ComentarioPedido::class, 'pedido_id')->latest();
    }

    public function tareas(): HasMany
    {
        return $this->hasMany(ResponsableEtapa::class, 'pedido_id');
    }

    /**
     * Relación: Historial de estados del pedido.
     */
    public function historialEstados(): HasMany
    {
        return $this->hasMany(PedidoHistorialEstado::class, 'pedido_id');
    }

    /**
     * Relación: Último estado registrado del pedido.
     */
    public function ultimoEstado(): HasOne
    {
        return $this->hasOne(PedidoHistorialEstado::class, 'pedido_id')->latestOfMany();
    }

    // Accessor y Mutator para la propiedad dinámica 'estado'
    public function getEstadoAttribute(): string
    {
        if ($this->pendingEstado !== null) {
            return $this->pendingEstado;
        }
        return $this->ultimoEstado?->estado ?? 'pendiente';
    }

    public function setEstadoAttribute(?string $value): void
    {
        if ($value === null) {
            return;
        }
        $current = $this->ultimoEstado?->estado;
        if ($current !== $value) {
            $this->pendingEstado = $value;
        }
    }

    // Accessors para atributos dinámicos de pago
    public function getMontoPagadoAttribute(): float
    {
        return (float) $this->pagos()->where('estado', 'pagado')->sum('monto');
    }

    public function getSaldoPendienteAttribute(): float
    {
        $precio = (float) ($this->precio ?? 0);
        return (float) max(0, $precio - $this->monto_pagado);
    }

    public function getPorcentajePagadoAttribute(): float
    {
        $precio = (float) ($this->precio ?? 0);
        if ($precio <= 0) {
            return 0.0;
        }
        return round(($this->monto_pagado / $precio) * 100, 2);
    }

    public function getEstadoPagoAttribute(): string
    {
        if ($this->monto_pagado <= 0) {
            return 'sin_pago';
        }
        $precio = (float) ($this->precio ?? 0);
        if ($this->monto_pagado >= $precio) {
            return 'pagado';
        }
        return 'parcial';
    }

    /**
     * Generar/Sincronizar las tareas (responsables_etapas) del pedido a partir de las etapas de sus productos.
     */
    public function generarTareas(): void
    {
        $productIds = $this->productos()->pluck('productos.id')->toArray();

        // Obtener todas las etapas_productos asociadas a estos productos
        $etapasProductos = EtapaProducto::whereIn('producto_id', $productIds)->get();
        $etapaProductoIds = $etapasProductos->pluck('id')->toArray();

        // Obtener dependencias entre etapas del producto
        $dependencies = DB::table('etapa_producto_dependencias')
            ->whereIn('etapa_producto_id', $etapaProductoIds)
            ->get()
            ->groupBy('etapa_producto_id');

        // Eliminar asignaciones viejas de etapas que ya no pertenecen a los productos asociados
        ResponsableEtapa::where('pedido_id', $this->id)
            ->whereNotIn('etapa_producto_id', $etapaProductoIds)
            ->delete();

        foreach ($etapasProductos as $etapaProducto) {
            // Verificar si ya existe la tarea
            $tarea = ResponsableEtapa::where('pedido_id', $this->id)
                ->where('etapa_producto_id', $etapaProducto->id)
                ->first();

            $tieneDependencias = isset($dependencies[$etapaProducto->id]) && $dependencies[$etapaProducto->id]->count() > 0;
            $estadoInicial = $tieneDependencias ? 'bloqueada' : 'pendiente';

            if (!$tarea) {
                ResponsableEtapa::create([
                    'pedido_id' => $this->id,
                    'etapa_producto_id' => $etapaProducto->id,
                    'user_id' => null,
                    'estado' => $estadoInicial
                ]);
            } else {
                // Si la tarea existe y estaba bloqueada pero ahora no tiene dependencias (o viceversa), actualizar
                // Pero no sobreescribir si está en progreso o completada
                if ($tarea->estado === 'bloqueada' && !$tieneDependencias) {
                    $tarea->update(['estado' => 'pendiente']);
                } elseif ($tarea->estado === 'pendiente' && $tieneDependencias) {
                    $tarea->update(['estado' => 'bloqueada']);
                }
            }
        }
    }

    /**
     * Regenerar/Sincronizar tareas para todos los pedidos activos que contengan un producto específico.
     */
    public static function regenerarTareasParaProducto($productoId): void
    {
        $pedidos = self::whereHas('productos', function ($q) use ($productoId) {
            $q->where('productos.id', $productoId);
        })->whereHas('ultimoEstado', function ($q) {
            $q->whereNotIn('estado', ['completado', 'cancelado']);
        })->get();

        foreach ($pedidos as $pedido) {
            $pedido->generarTareas();
        }
    }

    /**
     * Relación Uno a Muchos con Imágenes del Pedido.
     */
    public function imagenes(): HasMany
    {
        return $this->hasMany(PedidoImagen::class, 'pedido_id')->orderBy('es_principal', 'desc')->orderBy('orden', 'asc');
    }

    /**
     * Relación Uno a Uno con la Imagen Principal / Portada del Pedido.
     */
    public function imagenPrincipal(): HasOne
    {
        return $this->hasOne(PedidoImagen::class, 'pedido_id')->where('es_principal', true);
    }
}


