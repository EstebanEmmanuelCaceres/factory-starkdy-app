<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Pago extends Model
{
    use HasFactory;

    public const ESTADO_PENDIENTE = 'pendiente';
    public const ESTADO_PAGADO = 'pagado';
    public const ESTADO_ANULADO = 'anulado';

    public const ESTADOS = [self::ESTADO_PENDIENTE, self::ESTADO_PAGADO, self::ESTADO_ANULADO];
    public const TIPOS_COBRO = ['seña', 'parcial', 'saldo', 'unico'];

    protected $table = 'pagos';

    protected $hidden = [
        'pedido',
    ];

    protected $fillable = [
        'pedido_id',
        'registrado_por',
        'medio',
        'estado',
        'monto',
        'moneda',
        'referencia_externa',
        'comprobante_url',
        'pagado_at',
        'tipo_cobro',
        'vendedor_id',
        'medio_pago',
        'observaciones',
        'fecha_pago',
    ];

    protected $casts = [
        'fecha_pago' => 'datetime',
        'pagado_at' => 'datetime',
        'monto' => 'decimal:2',
    ];

    /**
     * Relación: El pago pertenece a un pedido.
     */
    public function pedido(): BelongsTo
    {
        return $this->belongsTo(Pedido::class, 'pedido_id');
    }

    /**
     * Relación: El pago fue registrado por un usuario (historico).
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'registrado_por');
    }

    /**
     * Relación: El cobro fue realizado por un vendedor.
     */
    public function vendedor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'vendedor_id');
    }

    /**
     * Relación Uno a Muchos con PagoIntentos.
     */
    public function intentos(): HasMany
    {
        return $this->hasMany(PagoIntento::class, 'pago_id');
    }

    public function estaAnulado(): bool
    {
        return $this->estado === self::ESTADO_ANULADO;
    }

    /**
     * Scope: pagos cuya fecha de cobro cae en el rango (registros viejos sin fecha_pago usan pagado_at / created_at).
     */
    public function scopeFechaCobroEntre(Builder $query, ?string $desde, ?string $hasta): Builder
    {
        $fecha = 'COALESCE(pagos.fecha_pago, pagos.pagado_at, pagos.created_at)';

        return $query
            ->when($desde, fn (Builder $q) => $q->whereRaw("DATE($fecha) >= ?", [$desde]))
            ->when($hasta, fn (Builder $q) => $q->whereRaw("DATE($fecha) <= ?", [$hasta]));
    }

    /**
     * Scope: ordena por fecha de cobro (asc | desc). El id desempata cobros del mismo momento.
     */
    public function scopeOrdenarPorFechaCobro(Builder $query, string $direccion = 'desc'): Builder
    {
        $direccion = strtolower($direccion) === 'asc' ? 'asc' : 'desc';

        return $query
            ->orderByRaw('COALESCE(pagos.fecha_pago, pagos.pagado_at, pagos.created_at) ' . $direccion)
            ->orderBy('pagos.id', $direccion);
    }

    /**
     * Scope: pagos de pedidos de un vendedor (pedidos.user_id).
     */
    public function scopeDelVendedor(Builder $query, int $vendedorId): Builder
    {
        return $query->whereHas('pedido', fn (Builder $q) => $q->where('user_id', $vendedorId));
    }
}
