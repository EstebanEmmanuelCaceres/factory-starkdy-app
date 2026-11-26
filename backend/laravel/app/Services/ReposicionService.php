<?php

namespace App\Services;

use App\Models\Pedido;
use App\Models\PedidoProducto;
use App\Models\User;
use App\Repositories\PedidoRepository;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Reglas de negocio de las reposiciones: volver a hacer un pedido que llegó mal.
 *
 * Una reposición es un pedido más (pasa por diseño, producción y despacho), pero:
 * - no es una venta: precio 0, sin pagos y fuera de las métricas de ventas;
 * - apunta siempre a la venta original, aunque se cree desde otra reposición;
 * - lleva solo las líneas elegidas, con cantidades que no superan las del pedido del que sale;
 * - su código es DV-<número de la venta>-<n>, para reconocerla a simple vista.
 */
class ReposicionService
{
    public const PREFIJO_CODIGO = 'DV';

    public function __construct(
        private readonly PedidoRepository $pedidos,
        private readonly PedidoLineasService $lineasService,
    ) {
    }

    /**
     * Crea la reposición del pedido $pedidoId con las líneas elegidas.
     *
     * @param array{motivo: string, detalle: string|null, lineas: array<int, int>, fecha_entrega: string|null, prioridad: string|null} $datos
     */
    public function crear(int $pedidoId, array $datos, User $usuario): Pedido
    {
        $pedido = $this->pedidos->buscarConLineas($pedidoId)
            ?? throw (new ModelNotFoundException())->setModel(Pedido::class, [$pedidoId]);

        if (! in_array($pedido->estado, Pedido::ESTADOS_REPONIBLES, true)) {
            throw ValidationException::withMessages(['pedido' => 'Solo se pueden reponer pedidos en estado Enviado.']);
        }

        $lineas = $this->lineasAReponer($pedido, $datos['lineas']);

        // Siempre cuelga de la venta original, aunque se repita desde una reposición
        $origenId = $pedido->esReposicion() ? $pedido->pedido_origen_id : $pedido->id;

        $reposicion = DB::transaction(function () use ($pedido, $origenId, $lineas, $datos, $usuario) {
            $original = $this->pedidos->bloquearParaReposicion($origenId);
            $codigo = $this->generarCodigo($original);
            $motivo = Pedido::MOTIVOS_REPOSICION[$datos['motivo']];

            $reposicion = Pedido::create([
                'tipo' => Pedido::TIPO_REPOSICION,
                'pedido_origen_id' => $original->id,
                'motivo_reposicion' => $datos['motivo'],
                'codigo' => $codigo,
                'cliente_id' => $pedido->cliente_id,
                'user_id' => $pedido->user_id, // el vendedor de la venta la sigue viendo
                'prioridad' => $datos['prioridad'] ?? $pedido->prioridad,
                'fecha_entrega' => $datos['fecha_entrega'] ?? now()->addDays(15)->toDateString(),
                'precio' => 0,
                'tipo_pago' => null,
                'estado' => 'pendiente',
                'comentario' => $this->lineasService->comentarioConAtributos(
                    $this->descripcion($original->codigo, $motivo, $datos['detalle']),
                    $lineas
                ),
            ]);

            $this->lineasService->sincronizar($reposicion, $lineas);
            $reposicion->generarTareas();

            // Queda registrado quién la creó, en los dos pedidos
            $original->comentarios()->create([
                'user_id' => $usuario->id,
                'cuerpo' => "Se creó la reposición {$codigo}. Motivo: {$motivo}.",
            ]);
            $reposicion->comentarios()->create([
                'user_id' => $usuario->id,
                'cuerpo' => "Reposición creada desde {$pedido->codigo}. Motivo: {$motivo}.",
            ]);

            return $reposicion;
        });

        return $this->pedidos->cargarReposicion($reposicion);
    }

    /**
     * Al editar una reposición no se puede cambiar precio, cliente ni código.
     * Se rechaza solo si el valor cambia: el formulario de edición los manda siempre.
     *
     * @param array{precio?: mixed, cliente_id?: mixed, codigo?: mixed} $cambios
     */
    public function validarEdicion(Pedido $pedido, array $cambios): void
    {
        if (!$pedido->esReposicion()) {
            return;
        }

        $errores = [];
        if (array_key_exists('precio', $cambios) && (float) $cambios['precio'] !== 0.0) {
            $errores['precio'] = 'Una reposición no tiene precio: no es una venta.';
        }
        if (array_key_exists('cliente_id', $cambios) && (int) $cambios['cliente_id'] !== $pedido->cliente_id) {
            $errores['cliente_id'] = 'Una reposición es del mismo cliente que el pedido original.';
        }
        if (array_key_exists('codigo', $cambios) && $cambios['codigo'] !== $pedido->codigo) {
            $errores['codigo'] = 'El código de una reposición no se puede cambiar.';
        }

        if ($errores) {
            throw ValidationException::withMessages($errores);
        }
    }

    /**
     * Valida que las líneas sean del pedido y no se repongan más unidades de las que tiene.
     * Producto y atributos salen de la línea original.
     *
     * @param array<int, int> $cantidades [linea_id => cantidad]
     * @return array<int, array{producto_id: int, cantidad: int, atributos: array}>
     */
    private function lineasAReponer(Pedido $pedido, array $cantidades): array
    {
        $delPedido = $pedido->lineas->keyBy('id');
        $errores = [];
        $lineas = [];

        foreach ($cantidades as $lineaId => $cantidad) {
            /** @var PedidoProducto|null $linea */
            $linea = $delPedido->get($lineaId);
            if (!$linea) {
                $errores[] = "La línea {$lineaId} no pertenece al pedido {$pedido->codigo}.";
                continue;
            }

            $nombre = $linea->producto?->nombre ?? "Producto #{$linea->producto_id}";
            if ($cantidad > $linea->cantidad) {
                $errores[] = "No se pueden reponer {$cantidad} unidades de {$nombre}: el pedido tiene {$linea->cantidad}.";
                continue;
            }

            $lineas[] = [
                'producto_id' => $linea->producto_id,
                'cantidad' => $cantidad,
                'atributos' => (array) $linea->atributos,
            ];
        }

        if ($errores) {
            throw ValidationException::withMessages(['lineas' => $errores]);
        }

        return $lineas;
    }

    /**
     * DV-<número de la venta>-<n>: "PD-473612" → "DV-473612-1", "DV-473612-2"...
     * Se saltean los códigos ya usados (por ejemplo, si alguno se cargó a mano).
     */
    private function generarCodigo(Pedido $original): string
    {
        $numero = preg_replace('/^[A-Za-z]+-/', '', $original->codigo) ?: (string) $original->id;
        $n = $this->pedidos->contarReposiciones($original->id);

        do {
            $codigo = self::PREFIJO_CODIGO . "-{$numero}-" . ++$n;
        } while ($this->pedidos->existeCodigo($codigo));

        return $codigo;
    }

    private function descripcion(string $codigoOriginal, string $motivo, ?string $detalle): string
    {
        return "Reposición de {$codigoOriginal} — Motivo: {$motivo}." . ($detalle ? "\n{$detalle}" : '');
    }
}
