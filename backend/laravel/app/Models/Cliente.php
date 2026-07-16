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

    /**
     * Relación Uno a Muchos con Pedidos.
     */
    public function pedidos(): HasMany
    {
        return $this->hasMany(Pedido::class);
    }
}
