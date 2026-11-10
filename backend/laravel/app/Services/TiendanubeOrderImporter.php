<?php

namespace App\Services;

use App\Models\Cliente;
use App\Models\Pago;
use App\Models\Pedido;
use App\Models\Producto;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Convierte una orden de Tiendanube en un Pedido de la fábrica.
 *
 * Es idempotente: Tiendanube reintenta los webhooks y order/created + order/paid llegan para la misma orden,
 * así que se identifica el pedido por pedidos.tiendanube_order_id y se actualiza en vez de duplicar.
 */
class TiendanubeOrderImporter
{
    public const ORIGEN = 'tiendanube';

    public function __construct(private readonly PedidoLineasService $lineasService)
    {
    }

    /**
     * Crea (o completa) el pedido de una orden de Tiendanube.
     *
     * @param array<string, mixed> $orden respuesta de GET /orders/{id}
     */
    public function importar(array $orden): Pedido
    {
        return DB::transaction(function () use ($orden) {
            $tnId = (string) $orden['id'];
            $pedido = Pedido::withTrashed()->where('tiendanube_order_id', $tnId)->first();

            if (!$pedido) {
                $pedido = $this->crearPedido($orden);
            }

            if (($orden['payment_status'] ?? null) === 'paid') {
                $this->registrarPago($pedido, $orden);
                if ($pedido->tipo_pago !== 'unico') {
                    $pedido->tipo_pago = 'unico';
                    $pedido->save();
                }
            }

            return $pedido->fresh();
        });
    }

    /** Orden cancelada en Tiendanube → pedido cancelado (si ya existe). */
    public function cancelar(int|string $tnId): ?Pedido
    {
        $pedido = Pedido::where('tiendanube_order_id', (string) $tnId)->first();
        if ($pedido && $pedido->estado !== 'cancelado') {
            $pedido->estado = 'cancelado';
            $pedido->save();
        }

        return $pedido;
    }

    private function crearPedido(array $orden): Pedido
    {
        $cliente = $this->clienteDe($orden);
        [$lineas, $sinMapear] = $this->lineasDe($orden);
        $total = (float) ($orden['total'] ?? 0);
        $pagada = ($orden['payment_status'] ?? null) === 'paid';

        $pedido = new Pedido([
            'cliente_id' => $cliente->id,
            'user_id' => $this->usuarioResponsableId(),
            'codigo' => 'TN-' . ($orden['number'] ?? $orden['id']),
            'prioridad' => 'normal',
            'fecha_entrega' => now()->addDays(15)->toDateString(),
            'precio' => $total,
            'comentario' => $this->comentarioDe($orden, $sinMapear),
            'tipo_pago' => $pagada ? 'unico' : 'parcial',
            'estado' => 'pendiente',
            'origen' => self::ORIGEN,
            'tiendanube_order_id' => (string) $orden['id'],
        ]);
        $pedido->save();

        $this->lineasService->sincronizar($pedido, $lineas);

        // TODO: Generación automática de tareas de fabricación ($pedido->generarTareas()).
        // Si hay productos del sistema mapeados, se generan las etapas correspondientes.
        // Si los productos se cargarán a mano más tarde, las tareas se generan al guardar el pedido editado.
        if (!empty($lineas)) {
            $pedido->generarTareas();
        }

        if (!empty($sinMapear)) {
            Log::warning('Tiendanube: productos sin SKU coincidente en el sistema', [
                'orden' => $orden['id'],
                'productos' => $sinMapear,
            ]);
        }

        return $pedido;
    }

    private function registrarPago(Pedido $pedido, array $orden): void
    {
        $referencia = 'tiendanube:' . $orden['id'];
        if ($pedido->pagos()->where('referencia_externa', $referencia)->exists()) {
            return; // ya registrado (webhook repetido)
        }

        $medio = $orden['gateway_name'] ?? $orden['gateway'] ?? 'tiendanube';
        $fecha = !empty($orden['paid_at']) ? \Carbon\Carbon::parse($orden['paid_at']) : now();
        $usuarioId = $pedido->user_id;

        $pedido->pagos()->create([
            'monto' => (float) ($orden['total'] ?? 0),
            'moneda' => $orden['currency'] ?? 'ARS',
            'medio' => $medio,
            'medio_pago' => $medio,
            'tipo_cobro' => 'unico',
            'estado' => Pago::ESTADO_PAGADO,
            'referencia_externa' => $referencia,
            'observaciones' => 'Cobro registrado automáticamente desde Tiendanube',
            'fecha_pago' => $fecha,
            'pagado_at' => $fecha,
            'registrado_por' => $usuarioId,
            'vendedor_id' => $usuarioId,
        ]);
    }

    private function clienteDe(array $orden): Cliente
    {
        $cliente = $orden['customer'] ?? [];
        $direccion = $orden['shipping_address'] ?? [];

        $nombre = $orden['contact_name'] ?? $cliente['name'] ?? 'Cliente Tiendanube';
        $email = $orden['contact_email'] ?? $cliente['email'] ?? null;
        $dni = $orden['contact_identification'] ?? $cliente['identification'] ?? null;

        $existente = null;
        if ($email && trim($email) !== '') {
            $emailNorm = mb_strtolower(trim($email));
            $existente = Cliente::whereRaw('LOWER(TRIM(email)) = ?', [$emailNorm])->first();
        }
        if (!$existente && $dni && trim((string) $dni) !== '') {
            $dniNorm = trim((string) $dni);
            $existente = Cliente::where('dni', $dniNorm)->first();
        }
        if ($existente) {
            return $existente;
        }

        return Cliente::create([
            'nombre_cliente' => $nombre,
            'nombre_empresa' => $nombre, // la tabla exige empresa: para ventas online es el mismo nombre
            'telefono' => $orden['contact_phone'] ?? $cliente['phone'] ?? 'Sin teléfono',
            'email' => $email ? trim($email) : null,
            'dni' => $dni ? trim((string) $dni) : null,
            'direccion' => trim(($direccion['address'] ?? '') . ' ' . ($direccion['number'] ?? '')) ?: null,
            'localidad' => $direccion['locality'] ?? $direccion['city'] ?? null,
            'provincia' => $direccion['province'] ?? null,
            'cp' => $direccion['zipcode'] ?? null,
        ]);
    }

    /**
     * @return array{0: array<int, array{producto_id: int, cantidad: int, atributos: array}>, 1: string[]}
     *         [líneas del pedido, descripción de los productos que no se pudieron mapear]
     */
    private function lineasDe(array $orden): array
    {
        $lineas = [];
        $sinMapear = [];

        foreach ($orden['products'] ?? [] as $item) {
            $cantidad = max(1, (int) ($item['quantity'] ?? 1));
            $sku = trim((string) ($item['sku'] ?? ''));
            $producto = $this->productoDe($sku, (string) ($item['name'] ?? ''));

            if (!$producto) {
                $sinMapear[] = ($item['name'] ?? 'Producto') . ' x' . $cantidad . ($sku !== '' ? " (SKU {$sku})" : ' (sin SKU)');
                continue;
            }

            // Un mismo producto no puede repetirse en dos líneas sin atributos: se suma la cantidad
            if (isset($lineas[$producto->id])) {
                $lineas[$producto->id]['cantidad'] += $cantidad;
            } else {
                $lineas[$producto->id] = ['producto_id' => $producto->id, 'cantidad' => $cantidad, 'atributos' => []];
            }
        }

        return [array_values($lineas), $sinMapear];
    }

    /**
     * Producto de la fábrica que corresponde a un ítem de Tiendanube: primero por SKU y,
     * si no hay SKU o no coincide, por nombre exacto (solo si es único, para no equivocarse de producto).
     */
    private function productoDe(string $sku, string $nombre): ?Producto
    {
        if ($sku !== '' && ($producto = Producto::where('sku', $sku)->first())) {
            return $producto;
        }

        if ($nombre !== '') {
            $porNombre = Producto::whereRaw('LOWER(nombre) = ?', [mb_strtolower(trim($nombre))])->limit(2)->get();
            if ($porNombre->count() === 1) {
                return $porNombre->first();
            }
        }

        return null;
    }

    private function comentarioDe(array $orden, array $sinMapear): string
    {
        $partes = ['Venta Tiendanube #' . ($orden['number'] ?? $orden['id'])];

        $detalle = collect($orden['products'] ?? [])
            ->map(function ($p) {
                $variante = $p['variant_values'] ?? [];
                $variante = is_array($variante) && $variante ? ' [' . implode(', ', $variante) . ']' : '';
                $sku = !empty($p['sku']) ? ' (SKU: ' . $p['sku'] . ')' : '';
                $precio = !empty($p['price']) ? ' - $' . number_format((float) $p['price'], 2, ',', '.') : '';

                return '- ' . ($p['name'] ?? 'Producto') . $variante . $sku . ' x' . ($p['quantity'] ?? 1) . $precio;
            })
            ->implode("\n");
        if ($detalle !== '') {
            $partes[] = "PRODUCTOS COMPRADOS EN TIENDANUBE:\n" . $detalle;
        }

        if (!empty($orden['shipping_address'])) {
            $dir = $orden['shipping_address'];
            $dirTexto = trim(($dir['address'] ?? '') . ' ' . ($dir['number'] ?? ''));
            $locTexto = trim(($dir['locality'] ?? $dir['city'] ?? '') . ', ' . ($dir['province'] ?? ''));
            $cpTexto = !empty($dir['zipcode']) ? ' (CP ' . $dir['zipcode'] . ')' : '';
            if ($dirTexto || $locTexto) {
                $partes[] = 'Dirección de envío: ' . trim($dirTexto . ' - ' . $locTexto . $cpTexto, ' -');
            }
        }

        if (!empty($orden['note'])) {
            $partes[] = 'Nota del cliente: ' . $orden['note'];
        }
        if (!empty($sinMapear)) {
            $partes[] = 'PRODUCTOS SIN MAPEAR (pendientes de cargar a mano): ' . implode('; ', $sinMapear);
        }

        return implode("\n\n", $partes);
    }

    /** Vendedor/usuario al que se asocia el pedido: TIENDANUBE_USER_ID, o el primer admin. */
    private function usuarioResponsableId(): ?int
    {
        $configurado = config('services.tiendanube.user_id');
        if ($configurado) {
            return (int) $configurado;
        }

        return (User::whereHas('role', fn ($q) => $q->where('slug', 'admin'))->first() ?? User::first())?->id;
    }
}
