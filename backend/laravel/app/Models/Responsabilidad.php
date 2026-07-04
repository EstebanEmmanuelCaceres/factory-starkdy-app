<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Responsabilidad extends Model
{
    use HasFactory;

    protected $table = 'responsabilidades';

    protected $fillable = [
        'nombre',
        'descripcion',
    ];

    /**
     * Relación Muchos a Muchos con Usuarios.
     */
    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'user_responsabilidades', 'responsabilidad_id', 'user_id')
                    ->timestamps();
    }

    /**
     * Relación Muchos a Muchos con Etapas.
     */
    public function etapas(): BelongsToMany
    {
        return $this->belongsToMany(Etapa::class, 'etapa_responsabilidades', 'responsabilidad_id', 'etapa_id');
    }
}
