<?php

namespace App\Http\Requests;

use App\Models\Pedido;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Contrato para crear una reposición de un pedido (POST /api/pedidos/{id}/reposicion).
 *
 * Solo admin y encargado/a. Se elige qué líneas del pedido se reponen y cuántas unidades;
 * los productos y sus atributos los toma el servicio del pedido, no se aceptan del cliente.
 */
class CrearReposicionRequest extends FormRequest
{
    public const ROLES_PERMITIDOS = ['admin', 'encargado'];

    public function authorize(): bool
    {
        return in_array($this->user()?->role?->slug, self::ROLES_PERMITIDOS, true);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'motivo' => ['required', 'string', Rule::in(array_keys(Pedido::MOTIVOS_REPOSICION))],
            'detalle' => ['nullable', 'string', 'max:1000'],
            'lineas' => ['required', 'array', 'min:1'],
            'lineas.*.linea_id' => ['required', 'integer', 'distinct'],
            'lineas.*.cantidad' => ['required', 'integer', 'min:1'],
            'fecha_entrega' => ['nullable', 'date'],
            'prioridad' => ['nullable', 'string', Rule::in(Pedido::PRIORIDADES)],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'motivo.required' => 'Indicá el motivo de la reposición.',
            'motivo.in' => 'El motivo no es válido.',
            'lineas.required' => 'Elegí al menos un producto para reponer.',
            'lineas.min' => 'Elegí al menos un producto para reponer.',
            'lineas.*.linea_id.distinct' => 'Hay un producto repetido en la reposición.',
            'lineas.*.cantidad.min' => 'La cantidad a reponer debe ser al menos 1.',
        ];
    }

    protected function failedAuthorization(): void
    {
        abort(403, 'Solo administración o encargados pueden crear reposiciones.');
    }

    /**
     * Datos validados y tipados para el servicio.
     *
     * @return array{
     *   motivo: string,
     *   detalle: string|null,
     *   lineas: array<int, int>,
     *   fecha_entrega: string|null,
     *   prioridad: string|null
     * }  lineas: [linea_id => cantidad]
     */
    public function datos(): array
    {
        $validated = $this->validated();

        return [
            'motivo' => $validated['motivo'],
            'detalle' => isset($validated['detalle']) ? trim($validated['detalle']) ?: null : null,
            'lineas' => collect($validated['lineas'])
                ->mapWithKeys(fn(array $linea) => [(int) $linea['linea_id'] => (int) $linea['cantidad']])
                ->all(),
            'fecha_entrega' => $validated['fecha_entrega'] ?? null,
            'prioridad' => $validated['prioridad'] ?? null,
        ];
    }
}
