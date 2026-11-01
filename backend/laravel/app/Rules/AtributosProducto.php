<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * Valida el contenido de productos.atributos: un array de atributos en el orden del configurador.
 * Además de la forma, controla lo que un JSON Schema no puede: clave única en el producto,
 * valor de opción único en el atributo y como mucho una opción por defecto.
 */
class AtributosProducto implements ValidationRule
{
    public const TIPOS = ['opciones', 'color', 'texto', 'extra'];

    private const CAMPOS = [
        'opciones' => ['clave', 'etiqueta', 'tipo', 'prefijo_etiqueta', 'opciones'],
        // El color no tiene opciones ni recargo: se elige en cada pedido
        'color' => ['clave', 'etiqueta', 'tipo', 'prefijo_etiqueta'],
        'texto' => ['clave', 'etiqueta', 'tipo', 'placeholder'],
        'extra' => ['clave', 'etiqueta', 'tipo', 'recargo'],
    ];

    private const CAMPOS_OPCION = ['valor', 'recargo', 'por_defecto'];

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (!is_array($value) || !array_is_list($value)) {
            $fail('Los atributos deben ser una lista.');
            return;
        }

        $claves = [];

        foreach ($value as $i => $atributo) {
            $n = $i + 1;

            if (!is_array($atributo) || array_is_list($atributo)) {
                $fail("El atributo #{$n} no tiene un formato válido.");
                continue;
            }

            $etiqueta = $atributo['etiqueta'] ?? null;
            $nombre = is_string($etiqueta) && trim($etiqueta) !== '' ? "\"{$etiqueta}\"" : "#{$n}";

            $tipo = $atributo['tipo'] ?? null;
            if (!in_array($tipo, self::TIPOS, true)) {
                $fail("El atributo {$nombre} tiene un tipo inválido (debe ser: " . implode(', ', self::TIPOS) . ').');
                continue;
            }

            $sobrantes = array_diff(array_keys($atributo), self::CAMPOS[$tipo]);
            if (!empty($sobrantes)) {
                $fail("El atributo {$nombre} tiene campos no permitidos para el tipo {$tipo}: " . implode(', ', $sobrantes) . '.');
            }

            $clave = $atributo['clave'] ?? null;
            if (!is_string($clave) || !preg_match('/^[a-z0-9_]{1,50}$/', $clave)) {
                $fail("El atributo {$nombre} tiene una clave inválida (solo minúsculas, números y _; hasta 50 caracteres).");
            } elseif (in_array($clave, $claves, true)) {
                $fail("La clave \"{$clave}\" está repetida en el producto.");
            } else {
                $claves[] = $clave;
            }

            if (!$this->esTexto($etiqueta, 1, 100)) {
                $fail("El atributo #{$n} necesita una etiqueta de hasta 100 caracteres.");
            }

            if (array_key_exists('prefijo_etiqueta', $atributo) && !$this->esTexto($atributo['prefijo_etiqueta'], 0, 50)) {
                $fail("El prefijo del atributo {$nombre} debe tener hasta 50 caracteres.");
            }

            if (array_key_exists('placeholder', $atributo) && !$this->esTexto($atributo['placeholder'], 0, 100)) {
                $fail("El placeholder del atributo {$nombre} debe tener hasta 100 caracteres.");
            }

            if ($tipo === 'extra' && !$this->esRecargo($atributo['recargo'] ?? null)) {
                $fail("El recargo del atributo {$nombre} debe ser un número mayor o igual a 0.");
            }

            if ($tipo === 'opciones') {
                $this->validarOpciones($atributo['opciones'] ?? null, $nombre, $fail);
            }
        }
    }

    private function validarOpciones(mixed $opciones, string $nombre, Closure $fail): void
    {
        if (!is_array($opciones) || !array_is_list($opciones) || count($opciones) === 0) {
            $fail("El atributo {$nombre} necesita al menos una opción.");
            return;
        }

        $valores = [];
        $porDefecto = 0;

        foreach ($opciones as $j => $opcion) {
            $m = $j + 1;

            if (!is_array($opcion) || array_is_list($opcion)) {
                $fail("La opción #{$m} del atributo {$nombre} no tiene un formato válido.");
                continue;
            }

            $sobrantes = array_diff(array_keys($opcion), self::CAMPOS_OPCION);
            if (!empty($sobrantes)) {
                $fail("La opción #{$m} del atributo {$nombre} tiene campos no permitidos: " . implode(', ', $sobrantes) . '.');
            }

            $valor = $opcion['valor'] ?? null;
            if (!$this->esTexto($valor, 1, 100)) {
                $fail("La opción #{$m} del atributo {$nombre} necesita un valor de hasta 100 caracteres.");
            } else {
                // Se compara sin mayúsculas ni espacios de más: "Rojo" y " rojo" serían la misma opción para el cliente
                $normalizado = mb_strtolower(trim($valor));
                if (in_array($normalizado, $valores, true)) {
                    $fail("El atributo {$nombre} tiene la opción \"{$valor}\" repetida.");
                }
                $valores[] = $normalizado;
            }

            if (!$this->esRecargo($opcion['recargo'] ?? null)) {
                $fail("El recargo de la opción #{$m} del atributo {$nombre} debe ser un número mayor o igual a 0.");
            }

            if (array_key_exists('por_defecto', $opcion)) {
                if (!is_bool($opcion['por_defecto'])) {
                    $fail("El campo por_defecto de la opción #{$m} del atributo {$nombre} debe ser verdadero o falso.");
                } elseif ($opcion['por_defecto']) {
                    $porDefecto++;
                }
            }
        }

        if ($porDefecto > 1) {
            $fail("El atributo {$nombre} tiene más de una opción marcada por defecto.");
        }
    }

    private function esTexto(mixed $valor, int $min, int $max): bool
    {
        if (!is_string($valor)) {
            return false;
        }

        $largo = mb_strlen(trim($valor));

        return $largo >= $min && mb_strlen($valor) <= $max;
    }

    private function esRecargo(mixed $valor): bool
    {
        return (is_int($valor) || is_float($valor)) && $valor >= 0;
    }
}
