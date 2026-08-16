<?php

namespace App\Models;

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
     * Total acumulado de los precios de los pedidos activos del cliente.
     */
    public function getTotalPedidosAttribute(): float
    {
        return (float) $this->pedidos()
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
