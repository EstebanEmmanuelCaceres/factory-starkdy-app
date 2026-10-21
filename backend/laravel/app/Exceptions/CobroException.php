<?php

namespace App\Exceptions;

use Exception;
use Illuminate\Http\JsonResponse;

/**
 * Error de regla de negocio en cobros (monto mayor al saldo, cobro anulado, etc.).
 * Laravel llama a render() automáticamente, así el controlador no necesita try/catch.
 */
class CobroException extends Exception
{
    public function __construct(string $message, private readonly array $errors = [], int $code = 422)
    {
        parent::__construct($message, $code);
    }

    public function render(): JsonResponse
    {
        return response()->json([
            'status' => 'error',
            'message' => $this->getMessage(),
            'errors' => $this->errors,
        ], $this->getCode());
    }
}
