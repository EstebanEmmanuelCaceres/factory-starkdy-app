<?php

namespace App\Models;

use App\Models\Etapa;
use App\Models\EtapaProducto;
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

    /**
     * Relación Uno a Muchos con Imagenes del Producto.
     */
    public function imagenes(): HasMany
    {
        return $this->hasMany(ProductoImagen::class, 'producto_id')->orderBy('es_principal', 'desc')->orderBy('orden', 'asc');
    }

    /**
     * Relación Uno a Uno con la Imagen Principal (Logo).
     */
    public function imagenPrincipal()
    {
        return $this->hasOne(ProductoImagen::class, 'producto_id')->where('es_principal', true);
    }

    /**
     * Asignar las 3 etapas globales por defecto (diseño -> produccion -> finalizado)
     * con sus dependencias secuenciales.
     */
    public function asignarEtapasPorDefecto(): void
    {
        if ($this->etapasProductos()->count() > 0) {
            return;
        }

        $nombresEtapas = ['diseño', 'produccion', 'finalizado'];
        $etapasCatalog = [];

        foreach ($nombresEtapas as $nombre) {
            $etapasCatalog[$nombre] = Etapa::firstOrCreate(
                ['nombre' => $nombre],
                ['descripcion' => 'Etapa global por defecto: ' . ucfirst($nombre)]
            );
        }

        // 1. Crear etapa diseño (orden 1)
        $epDiseno = EtapaProducto::create([
            'producto_id' => $this->id,
            'etapa_id' => $etapasCatalog['diseño']->id,
            'orden' => 1,
        ]);

        // 2. Crear etapa produccion (orden 2)
        $epProduccion = EtapaProducto::create([
            'producto_id' => $this->id,
            'etapa_id' => $etapasCatalog['produccion']->id,
            'orden' => 2,
        ]);

        // 3. Crear etapa finalizado (orden 3)
        $epFinalizado = EtapaProducto::create([
            'producto_id' => $this->id,
            'etapa_id' => $etapasCatalog['finalizado']->id,
            'orden' => 3,
        ]);

        // 4. Vincular dependencias secuenciales
        // produccion depende de diseño
        $epProduccion->dependencias()->attach($epDiseno->id);

        // finalizado depende de produccion
        $epFinalizado->dependencias()->attach($epProduccion->id);
    }
}

