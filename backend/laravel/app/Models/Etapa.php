<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Etapa extends Model
{
    use HasFactory;

    protected $table = 'etapas';

    protected $fillable = [
        'nombre',
        'descripcion',
    ];

    /**
     * Relación Uno a Muchos con EtapasProductos (Configuraciones de esta etapa en productos).
     */
    public function etapasProductos(): HasMany
    {
        return $this->hasMany(EtapaProducto::class, 'etapa_id');
    }

    /**
     * Relación Muchos a Muchos con Productos.
     */
    public function productos(): BelongsToMany
    {
        return $this->belongsToMany(Producto::class, 'etapas_productos', 'etapa_id', 'producto_id')
                    ->withPivot(['id', 'orden'])
                    ->withTimestamps();
    }
}
