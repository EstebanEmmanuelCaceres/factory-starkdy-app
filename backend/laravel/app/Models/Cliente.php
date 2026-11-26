<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Cliente extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'clientes';

    protected $fillable = [
        'nombre_cliente',
        'nombre_empresa',
        'email',
        'telefono',
        'dni',
        'direccion',
        'provincia',
        'cp',
        'localidad',
        'ingreso',
        'valor_total',
        'saldo',
        'observaciones',
    ];

    protected $casts = [
        'saldo' => 'float',
        'ingreso' => 'float',
        'valor_total' => 'float',
    ];

    protected $appends = [
        'total_pedidos',
        'saldo_disponible',
        'alcanzo_limite',
    ];

    /**
     * Datos que exige el envío (los obligatorios del CSV de Andreani). Si falta alguno,
     * el pedido no se puede despachar. clave => etiqueta.
     */
    public const DATOS_ENVIO = [
        'telefono' => 'Teléfono',
        'dni' => 'DNI',
        'email' => 'Email',
        'direccion' => 'Dirección',
        'provincia' => 'Provincia',
        'localidad' => 'Localidad',
        'cp' => 'Código postal',
    ];

    protected ?float $cachedTotalPedidos = null;

    /**
     * Claves de los datos de envío que faltan. Vacío, solo espacios o "-" cuentan como no cargado.
     *
     * @return list<string>
     */
    public function datosEnvioFaltantes(): array
    {
        return array_values(array_filter(
            array_keys(self::DATOS_ENVIO),
            fn(string $campo) => in_array(trim((string) $this->{$campo}), ['', '-'], true)
        ));
    }

    /**
     * Clientes a los que les falta al menos un dato de envío (misma regla que datosEnvioFaltantes).
     */
    public function scopeSinDatosEnvio(Builder $query): Builder
    {
        return $query->where(function (Builder $q) {
            foreach (array_keys(self::DATOS_ENVIO) as $campo) {
                $q->orWhereRaw("coalesce(trim({$campo}), '') in ('', '-')");
            }
        });
    }

    /**
     * Total acumulado de los precios de los pedidos activos del cliente.
     */
    public function getTotalPedidosAttribute(): float
    {
        if (array_key_exists('total_pedidos_calculado', $this->attributes)) {
            return (float) ($this->attributes['total_pedidos_calculado'] ?? 0);
        }
        if ($this->cachedTotalPedidos !== null) {
            return $this->cachedTotalPedidos;
        }
        return $this->cachedTotalPedidos = (float) $this->pedidos()
            ->whereDoesntHave('ultimoEstado', function ($q) {
                $q->where('estado', 'cancelado');
            })
            ->sum('precio');
    }

    /**
     * Crédito disponible (saldo Límite - total_pedidos).
     * Si no tiene límite (saldo es null o <= 0), retorna null.
     */
    public function getSaldoDisponibleAttribute(): ?float
    {
        $limite = (float) ($this->saldo ?? 0);
        if ($limite <= 0) {
            return null;
        }
        return $limite - $this->total_pedidos;
    }

    /**
     * Determina si el cliente ha alcanzado o superado el límite de crédito asignado.
     */
    public function getAlcanzoLimiteAttribute(): bool
    {
        $limite = (float) ($this->saldo ?? 0);
        if ($limite <= 0) {
            return false;
        }
        return $this->total_pedidos >= $limite;
    }

    /**
     * Relación Uno a Muchos con Pedidos.
     */
    public function pedidos(): HasMany
    {
        return $this->hasMany(Pedido::class);
    }
}
