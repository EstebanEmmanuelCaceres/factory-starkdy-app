<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * FormRequest que valida los filtros de entrada para la matriz mensual
 * de unidades vendidas por producto.
 * Por defecto toma el intervalo desde el mes actual hacia 6 meses atrás.
 */
class UnidadesVendidasRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();
        if (!$user) {
            return false;
        }

        $roleSlug = $user->role?->slug;

        return !in_array($roleSlug, ['operario', 'operator'], true);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'anio' => 'nullable|integer|between:2020,2100',
            'mes_desde' => 'nullable|integer|between:1,12',
            'mes_hasta' => 'nullable|integer|between:1,12',
            'vendedor_id' => 'nullable|integer|exists:users,id',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'anio.integer' => 'El año debe ser un número entero válido.',
            'anio.between' => 'El año debe estar entre 2020 y 2100.',
            'mes_desde.integer' => 'El mes inicial debe ser un número entre 1 y 12.',
            'mes_desde.between' => 'El mes inicial debe estar entre 1 y 12.',
            'mes_hasta.integer' => 'El mes final debe ser un número entre 1 y 12.',
            'mes_hasta.between' => 'El mes final debe estar entre 1 y 12.',
            'vendedor_id.exists' => 'El vendedor seleccionado no existe.',
        ];
    }

    /**
     * Devuelve los filtros validados y tipados para el Servicio.
     * Si no se envían `mes_desde` / `mes_hasta`, por defecto usa la ventana
     * del mes actual hacia 6 meses atrás.
     *
     * @return array{
     *   anio: int,
     *   mes_desde: int|null,
     *   mes_hasta: int|null,
     *   vendedor_id: int|null
     * }
     */
    public function filtros(): array
    {
        $validated = $this->validated();
        $now = now();

        $anio = isset($validated['anio']) ? (int) $validated['anio'] : $now->year;
        $mesDesde = isset($validated['mes_desde']) ? (int) $validated['mes_desde'] : null;
        $mesHasta = isset($validated['mes_hasta']) ? (int) $validated['mes_hasta'] : null;

        return [
            'anio' => $anio,
            'mes_desde' => $mesDesde,
            'mes_hasta' => $mesHasta,
            'vendedor_id' => isset($validated['vendedor_id']) ? (int) $validated['vendedor_id'] : null,
        ];
    }
}
