<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Categoria extends Model
{
    use HasFactory;

    protected $table = 'categorias';

    protected $fillable = [
        'nombre'
    ];

    /**
     * Relación Muchos a Muchos con Etapas del catálogo maestro.
     */
    public function etapas(): BelongsToMany
    {
        return $this->belongsToMany(Etapa::class, 'categoria_etapa', 'categoria_id', 'etapa_id');
    }

    /**
     * Relación Muchos a Muchos con Usuarios.
     */
    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'categoria_user', 'categoria_id', 'user_id');
    }
}
