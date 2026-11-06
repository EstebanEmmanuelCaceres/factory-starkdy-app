<?php

namespace App\Services;

use App\Models\Pedido;
use App\Models\PedidoProducto;
use App\Models\Producto;

/**
 * Líneas de un pedido (pedido_productos): producto + cantidad + valores de sus atributos.
 *
 * Un mismo producto puede estar varias veces en el pedido solo si cada línea tiene atributos distintos
 * (lo garantiza también el índice único pp_unica_linea). Si llegan dos líneas iguales se unen sumando la cantidad.
 *
 * pedido_productos.atributos es un objeto {clave: valor}:
 * - texto:    lo que escribió el usuario (si queda vacío no se guarda la clave)
 * - opciones: el valor de la opción elegida (si no viene, la opción por defecto o la primera)
 */
class PedidoLineasService
{
    // Tipos de atributo que se cargan en el pedido. Color y extra quedan ocultos por ahora.
    public const TIPOS_EN_PEDIDO = ['opciones', 'texto'];

    // Tope de seguridad del texto libre: el valor entra en el índice único de la línea
    private const MAX_TEXTO = 1000;

    /**
     * Valida y normaliza las líneas que manda el front: [{id, cantidad, atributos?}].
     *
     * @return array{0: array<int, array{producto_id: int, cantidad: int, atributos: array<string, string>}>, 1: string[]}
     *         [líneas normalizadas, errores]
     */
    public function normalizar(array $items): array
    {
        $productos = Producto::whereIn('id', collect($items)->pluck('id')->filter()->unique())->get()->keyBy('id');
        $lineas = [];
        $errores = [];

        foreach ($items as $item) {
            $producto = $productos->get($item['id'] ?? null);
            if (!$producto) {
                continue; // Lo informa la validación de 'productos.*.id'
            }

            $valores = $item['atributos'] ?? [];
            if (!is_array($valores)) {
                $errores[] = "Los atributos de \"{$producto->nombre}\" no tienen un formato válido.";
                continue;
            }

            [$atributos, $erroresLinea] = $this->normalizarAtributos($producto, $valores);
            if (!empty($erroresLinea)) {
                array_push($errores, ...$erroresLinea);
                continue;
            }

            $clave = $this->claveLinea($producto->id, $atributos);
            $cantidad = (int) ($item['cantidad'] ?? 1);

            if (isset($lineas[$clave])) {
                $lineas[$clave]['cantidad'] += $cantidad;
            } else {
                $lineas[$clave] = ['producto_id' => $producto->id, 'cantidad' => $cantidad, 'atributos' => $atributos];
            }
        }

        return [array_values($lineas), $errores];
    }

    /**
     * Deja las líneas del pedido iguales a las recibidas: actualiza la cantidad de las que ya estaban
     * (mismo producto y atributos), crea las nuevas y borra (soft delete) las que ya no vienen.
     */
    public function sincronizar(Pedido $pedido, array $lineas): void
    {
        $existentes = PedidoProducto::where('pedido_id', $pedido->id)->get()
            ->keyBy(fn(PedidoProducto $linea) => $this->claveLinea($linea->producto_id, (array) $linea->atributos));

        $mantener = [];
        foreach ($lineas as $linea) {
            $existente = $existentes->get($this->claveLinea($linea['producto_id'], $linea['atributos']));

            if ($existente) {
                if ((int) $existente->cantidad !== $linea['cantidad']) {
                    $existente->update(['cantidad' => $linea['cantidad']]);
                }
                $mantener[] = $existente->id;
                continue;
            }

            $mantener[] = PedidoProducto::create([
                'pedido_id' => $pedido->id,
                'producto_id' => $linea['producto_id'],
                'cantidad' => $linea['cantidad'],
                // Siempre objeto: un array vacío se guardaría como [] y la columna exige {}
                'atributos' => (object) $linea['atributos'],
            ])->id;
        }

        PedidoProducto::where('pedido_id', $pedido->id)->whereNotIn('id', $mantener)->get()
            ->each(fn(PedidoProducto $linea) => $linea->delete());
    }

    /**
     * @return array{0: array<string, string>, 1: string[]} [atributos normalizados, errores]
     */
    private function normalizarAtributos(Producto $producto, array $valores): array
    {
        $definiciones = collect($producto->atributos ?? [])
            ->filter(fn($def) => in_array($def['tipo'] ?? null, self::TIPOS_EN_PEDIDO, true))
            ->keyBy('clave');

        $atributos = [];
        $errores = [];

        foreach (array_keys($valores) as $clave) {
            if (!$definiciones->has($clave)) {
                $errores[] = "El producto \"{$producto->nombre}\" no tiene el atributo \"{$clave}\".";
            }
        }

        foreach ($definiciones as $clave => $def) {
            $valor = $valores[$clave] ?? null;
            $etiqueta = $def['etiqueta'] ?? $clave;

            if ($valor !== null && !is_string($valor)) {
                $errores[] = "El valor de \"{$etiqueta}\" en \"{$producto->nombre}\" debe ser un texto.";
                continue;
            }
            $valor = $valor === null ? '' : trim($valor);

            if ($def['tipo'] === 'texto') {
                if (mb_strlen($valor) > self::MAX_TEXTO) {
                    $errores[] = "\"{$etiqueta}\" en \"{$producto->nombre}\" supera los " . self::MAX_TEXTO . ' caracteres.';
                } elseif ($valor !== '') {
                    $atributos[$clave] = $valor;
                }
                continue;
            }

            // opciones
            $opciones = collect($def['opciones'] ?? []);
            if ($valor === '') {
                $porDefecto = $opciones->firstWhere('por_defecto', true) ?? $opciones->first();
                if ($porDefecto) {
                    $atributos[$clave] = $porDefecto['valor'];
                }
            } elseif ($opciones->contains('valor', $valor)) {
                $atributos[$clave] = $valor;
            } else {
                $errores[] = "\"{$valor}\" no es una opción de \"{$etiqueta}\" en \"{$producto->nombre}\".";
            }
        }

        ksort($atributos);

        return [$atributos, $errores];
    }

    // Encabezado del bloque que se agrega al comentario del pedido. No cambiarlo: se usa para encontrar
    // el bloque anterior y reemplazarlo (si no, cada guardado lo agregaría de nuevo)
    public const ENCABEZADO_COMENTARIO = '── Atributos de los productos ──';

    /**
     * Comentario del pedido con el detalle de atributos de cada línea al final:
     *
     *   <lo que escribió el usuario>
     *
     *   ── Atributos de los productos ──
     *   • Vaso x10: Nombre a grabar: Juan · Tamaño: Grande
     *
     * El bloque anterior se reemplaza por el actual; si ninguna línea tiene atributos, se quita.
     */
    public function comentarioConAtributos(?string $comentario, array $lineas): ?string
    {
        $texto = (string) $comentario;
        $posicion = mb_strpos($texto, self::ENCABEZADO_COMENTARIO);
        if ($posicion !== false) {
            $texto = mb_substr($texto, 0, $posicion);
        }
        $texto = trim($texto);

        $detalle = $this->detalleAtributos($lineas);
        if ($detalle === '') {
            return $texto === '' ? null : $texto;
        }

        return ($texto === '' ? '' : $texto . "\n\n") . self::ENCABEZADO_COMENTARIO . "\n" . $detalle;
    }

    /**
     * Líneas activas del pedido en el mismo formato que normalizar().
     */
    public function lineasActuales(Pedido $pedido): array
    {
        return PedidoProducto::where('pedido_id', $pedido->id)->orderBy('id')->get()
            ->map(fn(PedidoProducto $linea) => [
                'producto_id' => $linea->producto_id,
                'cantidad' => (int) $linea->cantidad,
                'atributos' => (array) $linea->atributos,
            ])
            ->all();
    }

    // Una línea por cada línea del pedido que tenga atributos, con las etiquetas en el orden del producto
    private function detalleAtributos(array $lineas): string
    {
        $productos = Producto::whereIn('id', array_column($lineas, 'producto_id'))->get()->keyBy('id');

        $renglones = [];
        foreach ($lineas as $linea) {
            if (empty($linea['atributos'])) {
                continue;
            }
            $producto = $productos->get($linea['producto_id']);
            $definiciones = collect($producto?->atributos ?? [])->keyBy('clave');

            // Primero en el orden en que el producto define sus atributos; si alguno ya no existe, al final
            $claves = $definiciones->keys()->filter(fn($clave) => array_key_exists($clave, $linea['atributos']))
                ->merge(array_diff(array_keys($linea['atributos']), $definiciones->keys()->all()));

            $valores = $claves->map(
                fn($clave) => ($definiciones->get($clave)['etiqueta'] ?? $clave) . ': ' . $linea['atributos'][$clave]
            )->implode(' · ');

            $nombre = $producto?->nombre ?? "Producto #{$linea['producto_id']}";
            $renglones[] = "• {$nombre} x{$linea['cantidad']}: {$valores}";
        }

        return implode("\n", $renglones);
    }

    // Identifica una línea: mismo producto con los mismos atributos (sin importar el orden de las claves)
    private function claveLinea(int $productoId, array $atributos): string
    {
        ksort($atributos);

        return $productoId . '|' . json_encode($atributos, JSON_UNESCAPED_UNICODE);
    }
}
