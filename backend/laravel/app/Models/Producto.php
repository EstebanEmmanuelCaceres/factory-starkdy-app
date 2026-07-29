<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Producto extends Model
{
    use HasFactory;

    protected $table = 'productos';

    protected $fillable = [
        'nombre',
        'descripcion',
        'precio',
    ];

    /**
     * Relación Muchos a Muchos con Pedidos.
     */
    public function pedidos(): BelongsToMany
    {
        return $this->belongsToMany(Pedido::class, 'pedido_productos', 'producto_id', 'pedido_id')
            ->using(PedidoProducto::class)
            ->withTimestamps();
    }

    /**
     * Relación Muchos a Muchos con Materias Primas (Receta / BOM).
     */
    public function materiasPrimas(): BelongsToMany
    {
        return $this->belongsToMany(MateriaPrima::class, 'producto_materias_primas', 'producto_id', 'materia_prima_id')
            ->using(ProductoMateriaPrima::class)
            ->withPivot('cantidad_necesaria')
            ->withTimestamps();
    }

    /**
     * Relación Uno a Muchos con EtapasProductos (Instancias de etapa asociadas al producto).
     */
    public function etapasProductos(): HasMany
    {
        return $this->hasMany(EtapaProducto::class, 'producto_id')->orderBy('orden', 'asc');
    }

    /**
     * Relación Muchos a Muchos con el Catálogo de Etapas.
     */
    public function etapas(): BelongsToMany
    {
        return $this->belongsToMany(Etapa::class, 'etapas_productos', 'producto_id', 'etapa_id')
            ->withPivot(['id', 'orden'])
            ->withTimestamps();
    }
}
