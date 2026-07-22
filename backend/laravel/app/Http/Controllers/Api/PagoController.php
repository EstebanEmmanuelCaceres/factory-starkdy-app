<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Pago;
use App\Models\Pedido;
use Illuminate\Http\Request;

class PagoController extends Controller
{
    /**
     * Verificar si el usuario autenticado tiene permisos para gestionar pagos.
     */
    private function authorizePaymentAction()
    {
        $user = auth()->user();
        if (!$user) {
            return false;
        }

        // Permitimos registrar pagos a admin, encargado y vendedor
        $allowedRoles = ['admin', 'encargado', 'vendedor'];
        return in_array($user->role?->slug, $allowedRoles);
    }

    /**
     * Listar pagos de un pedido.
     */
    public function index(Pedido $pedido)
    {
        if (!$this->authorizePaymentAction()) {
            return response()->json(['message' => 'No autorizado para ver pagos.'], 403);
        }

        $pagos = $pedido->pagos()
            ->with(['vendedor', 'user'])
            ->orderBy('fecha_pago', 'asc')
            ->get();

        return response()->json([
            'status' => 'success',
            'data' => $pagos
        ]);
    }

    /**
     * Registrar un nuevo pago (parcial o único) para un pedido.
     */
    public function store(Request $request, Pedido $pedido)
    {
        if (!$this->authorizePaymentAction()) {
            return response()->json(['message' => 'No autorizado para registrar pagos.'], 403);
        }

        $validated = $request->validate([
            'monto' => 'required|numeric|min:0.01',
            'medio_pago' => 'required|string',
            'tipo_cobro' => 'required|in:seña,parcial,saldo,unico',
            'observaciones' => 'nullable|string',
            'fecha_pago' => 'nullable|date',
        ]);

        // Regla 1: Si el pedido es de pago único, no permitir más de un pago activo
        if ($pedido->tipo_pago === 'unico') {
            $hasActivePayment = $pedido->pagos()
                ->where('estado', '!=', 'anulado')
                ->exists();
                
            if ($hasActivePayment) {
                return response()->json([
                    'message' => 'Este pedido es de pago único y ya tiene un cobro registrado.'
                ], 422);
            }
        }

        // Regla 2: El monto del pago no puede superar el saldo pendiente del pedido
        // Redondeamos los flotantes para evitar discrepancias de precisión de punto flotante
        $montoPago = round((float) $validated['monto'], 2);
        $saldoPendiente = round($pedido->saldo_pendiente, 2);
        
        if ($montoPago > $saldoPendiente) {
            return response()->json([
                'message' => 'El monto ingresado ($' . $montoPago . ') excede el saldo pendiente del pedido ($' . $saldoPendiente . ').',
                'saldo_pendiente' => $saldoPendiente
            ], 422);
        }

        $pago = $pedido->pagos()->create([
            'monto' => $validated['monto'],
            'medio_pago' => $validated['medio_pago'],
            'medio' => $validated['medio_pago'], // por compatibilidad
            'tipo_cobro' => $validated['tipo_cobro'],
            'observaciones' => $validated['observaciones'],
            'fecha_pago' => $validated['fecha_pago'] ?? now(),
            'pagado_at' => $validated['fecha_pago'] ?? now(), // por compatibilidad
            'estado' => 'pagado', // por defecto cobrado exitosamente
            'registrado_por' => auth()->id(),
            'vendedor_id' => auth()->id(),
            'moneda' => 'ARS',
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Pago registrado con éxito.',
            'data' => $pago,
            'pedido' => $pedido->fresh(['pagos'])
        ], 201);
    }

    /**
     * Actualizar los datos de un pago.
     */
    public function update(Request $request, Pago $pago)
    {
        if (!$this->authorizePaymentAction()) {
            return response()->json(['message' => 'No autorizado para editar pagos.'], 403);
        }

        $validated = $request->validate([
            'monto' => 'nullable|numeric|min:0.01',
            'medio_pago' => 'nullable|string',
            'tipo_cobro' => 'nullable|in:seña,parcial,saldo,unico',
            'observaciones' => 'nullable|string',
            'fecha_pago' => 'nullable|date',
            'estado' => 'nullable|string|in:pendiente,pagado,anulado',
        ]);

        $pedido = $pago->pedido;

        if (isset($validated['monto']) && $pago->estado !== 'anulado') {
            // Validar que el nuevo monto no exceda el saldo pendiente sin contar este pago
            $montoAnterior = (float) $pago->monto;
            $montoNuevo = (float) $validated['monto'];
            $saldoSinEstePago = $pedido->saldo_pendiente + $montoAnterior;

            if (round($montoNuevo, 2) > round($saldoSinEstePago, 2)) {
                return response()->json([
                    'message' => 'El nuevo monto excede el saldo máximo disponible para este pedido.',
                    'saldo_disponible' => round($saldoSinEstePago, 2)
                ], 422);
            }
        }

        // Actualizar por compatibilidad
        if (isset($validated['medio_pago'])) {
            $pago->medio = $validated['medio_pago'];
        }
        if (isset($validated['fecha_pago'])) {
            $pago->pagado_at = $validated['fecha_pago'];
        }

        $pago->update($validated);

        return response()->json([
            'status' => 'success',
            'message' => 'Pago actualizado con éxito.',
            'data' => $pago,
            'pedido' => $pedido->fresh(['pagos'])
        ]);
    }

    /**
     * Anular un pago (Soft Delete).
     */
    public function destroy(Pago $pago)
    {
        if (!$this->authorizePaymentAction()) {
            return response()->json(['message' => 'No autorizado para anular pagos.'], 403);
        }

        // Cambiar el estado a 'anulado' en lugar de un borrado físico para trazabilidad
        $pago->update(['estado' => 'anulado']);

        return response()->json([
            'status' => 'success',
            'message' => 'Pago anulado con éxito.',
            'data' => $pago,
            'pedido' => $pago->pedido->fresh(['pagos'])
        ]);
    }
}
