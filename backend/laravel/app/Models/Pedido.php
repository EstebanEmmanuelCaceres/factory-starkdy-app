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

    public ?string $pendingInitialState = null;

    protected static function booted(): void
    {
        static::created(function (Pedido $pedido) {
            if ($pedido->historialEstados()->count() === 0) {
                $initialState = $pedido->pendingInitialState ?? 'pendiente';
                $nuevoHistorial = $pedido->historialEstados()->create([
                    'estado' => $initialState,
                    'created_at' => now(),
                ]);
                $pedido->setRelation('ultimoEstado', $nuevoHistorial);
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
            ->withTimestamps()
            // Al quitar un producto del pedido la fila se borra lógicamente: no debe seguir apareciendo
            ->wherePivotNull('deleted_at');
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
        return $this->hasOne(PedidoHistorialEstado::class, 'pedido_id')->latestOfMany(['created_at', 'id']);
    }



    // Accessor y Mutator para el estado basado 100% en la tabla de historial (pedido_historial_estado)
    public function getEstadoAttribute(): string
    {
        return $this->ultimoEstado?->estado ?? 'pendiente';
    }

    public function setEstadoAttribute(?string $value): void
    {
        if ($value === null) {
            return;
        }
        if (!$this->exists) {
            $this->pendingInitialState = $value;
            return;
        }
        $current = $this->ultimoEstado?->estado;
        if ($current !== $value) {
            $nuevoHistorial = $this->historialEstados()->create([
                'estado' => $value,
                'created_at' => now(),
            ]);
            $this->setRelation('ultimoEstado', $nuevoHistorial);
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
     * Generar las tareas (responsables_etapas) del pedido a partir de las etapas de sus productos.
     *
     * Las tareas son la "foto" de las etapas que tenía cada producto al entrar al pedido:
     * - Un producto que todavía no tiene tareas en el pedido (pedido nuevo o producto recién agregado)
     *   recibe una tarea por cada etapa que tenga configurada en este momento.
     * - Un producto que ya tiene tareas no se toca: agregar o quitar etapas del producto
     *   solo afecta a los pedidos que se creen (o a los que se agregue el producto) después.
     * - Se borran solo las tareas de los productos que se quitaron del pedido.
     */
    public function generarTareas(): void
    {
        $productIds = $this->productos()->pluck('productos.id')->all();

        // Tareas actuales con su etapa (incluye etapas ya quitadas del producto)
        $tareas = ResponsableEtapa::where('pedido_id', $this->id)->with('etapaProducto.etapa')->get();

        // Borrar las tareas de productos que ya no están en el pedido
        $tareasDeProductosQuitados = $tareas->filter(
            fn($tarea) => !$tarea->etapaProducto || !in_array($tarea->etapaProducto->producto_id, $productIds)
        );
        if ($tareasDeProductosQuitados->isNotEmpty()) {
            ResponsableEtapa::whereIn('id', $tareasDeProductosQuitados->pluck('id'))->delete();
        }
        $tareas = $tareas->diff($tareasDeProductosQuitados);

        $adminUser = User::whereHas('role', function ($q) {
            $q->where('slug', 'admin');
        })->first() ?? User::first();
        $adminUserId = $adminUser?->id;

        // Productos que ya tienen tareas: se respeta su foto, solo se asegura el responsable de diseño
        $productosConTareas = $tareas->map(fn($tarea) => $tarea->etapaProducto->producto_id)->unique()->all();
        foreach ($tareas as $tarea) {
            if ($this->esEtapaDiseno($tarea->etapaProducto) && !empty($this->user_id) && $tarea->user_id !== $this->user_id) {
                $tarea->update(['user_id' => $this->user_id]);
            }
        }

        // Productos sin tareas: crear una tarea por cada etapa configurada hoy
        $productosSinTareas = array_diff($productIds, $productosConTareas);
        if (!empty($productosSinTareas)) {
            $etapasProductos = EtapaProducto::whereIn('producto_id', $productosSinTareas)->with('etapa')->get();

            $conDependencias = DB::table('etapa_producto_dependencias')
                ->whereIn('etapa_producto_id', $etapasProductos->pluck('id'))
                ->pluck('etapa_producto_id')
                ->unique()
                ->all();

            foreach ($etapasProductos as $etapaProducto) {
                ResponsableEtapa::create([
                    'pedido_id' => $this->id,
                    'etapa_producto_id' => $etapaProducto->id,
                    'user_id' => $this->esEtapaDiseno($etapaProducto) ? ($this->user_id ?? $adminUserId) : $adminUserId,
                    'estado' => in_array($etapaProducto->id, $conDependencias) ? 'bloqueada' : 'pendiente',
                ]);
            }
        }
    }

    /**
     * La etapa de diseño se asigna al vendedor del pedido (etapa_id 5 o por nombre).
     */
    private function esEtapaDiseno(?EtapaProducto $etapaProducto): bool
    {
        if (!$etapaProducto) {
            return false;
        }

        $nombre = mb_strtolower($etapaProducto->etapa->nombre ?? '');

        return (int) $etapaProducto->etapa_id === 5 || str_contains($nombre, 'diseño') || str_contains($nombre, 'diseno');
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


