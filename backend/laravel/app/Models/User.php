<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    /** @var array<int, string> */
    protected $fillable = [
        'name',
        'email',
        'password',
        'role_id',
    ];

    /** @var array<int, string> */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /** @var array<string, string> */
    protected $casts = [
        'email_verified_at' => 'datetime',
        'password'          => 'hashed',
    ];

    /**
     * Relación: Un usuario pertenece a un rol.
     */
    public function role(): BelongsTo
    {
        return $this->belongsTo(Role::class);
    }

    /**
     * Relación Muchos a Muchos con Responsabilidades (skills).
     */
    public function responsabilidades(): BelongsToMany
    {
        return $this->belongsToMany(Responsabilidad::class, 'user_responsabilidades', 'user_id', 'responsabilidad_id')
                    ->withTimestamps();
    }

    /**
     * Relación: Tareas (etapas de pedidos) asignadas a este operario.
     */
    public function tareasAsignadas()
    {
        return $this->hasMany(ResponsableEtapa::class, 'user_id');
    }

    // ── Helpers de rol ────────────────────────────────────────────
    public function isAdmin(): bool
    {
        return $this->role?->slug === 'admin';
    }

    public function isSupervisor(): bool
    {
        return $this->role?->slug === 'supervisor';
    }

    public function isOperator(): bool
    {
        return in_array($this->role?->slug, ['operario', 'operator']);
    }

    public function hasRole(string $roleSlug): bool
    {
        return $this->role?->slug === $roleSlug;
    }

    public function getRoleLabel(): string
    {
        return $this->role?->name ?? 'Desconocido';
    }
}
