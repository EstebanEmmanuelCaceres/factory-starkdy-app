<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Atributos de producto y de línea de pedido (aditiva).
 *
 * - productos.atributos         jsonb NOT NULL DEFAULT '[]'  + CHECK productos_atributos_array_chk
 * - pedido_productos.atributos  jsonb NOT NULL DEFAULT '{}'  + CHECK pedido_productos_atributos_objeto_chk
 * - pp_unica_linea: índice único parcial (pedido_id, producto_id, atributos) WHERE deleted_at IS NULL
 *
 * Las filas existentes quedan con el default. Antes de crear el índice se verifica que no haya
 * líneas activas duplicadas (hoy todas tienen '{}', así que un duplicado haría fallar el índice).
 *
 * En SQLite (solo tests) se agregan columnas json equivalentes, sin CHECK ni índice.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            Schema::table('productos', function (Blueprint $table) {
                $table->json('atributos')->default('[]');
            });

            Schema::table('pedido_productos', function (Blueprint $table) {
                $table->json('atributos')->default('{}');
            });

            return;
        }

        DB::transaction(function () {
            // Bloqueo antes de verificar, para que nadie inserte duplicados entre el chequeo y el índice
            DB::statement('LOCK TABLE productos, pedido_productos IN ACCESS EXCLUSIVE MODE');

            $duplicados = DB::select(<<<'SQL'
                SELECT pedido_id, producto_id, string_agg(id::text, ',' ORDER BY id) AS ids
                FROM pedido_productos
                WHERE deleted_at IS NULL
                GROUP BY pedido_id, producto_id
                HAVING count(*) > 1
                ORDER BY pedido_id, producto_id
            SQL);

            if (! empty($duplicados)) {
                $detalle = collect($duplicados)
                    ->map(fn ($d) => "pedido_id={$d->pedido_id} producto_id={$d->producto_id} ids=[{$d->ids}]")
                    ->implode('; ');

                throw new RuntimeException(
                    'No se puede crear pp_unica_linea: hay líneas activas duplicadas en pedido_productos. '
                    ."Resolverlas antes de migrar: {$detalle}"
                );
            }

            DB::statement("ALTER TABLE productos ADD COLUMN atributos jsonb NOT NULL DEFAULT '[]'::jsonb");
            DB::statement(<<<'SQL'
                ALTER TABLE productos
                ADD CONSTRAINT productos_atributos_array_chk CHECK (jsonb_typeof(atributos) = 'array')
            SQL);

            DB::statement("ALTER TABLE pedido_productos ADD COLUMN atributos jsonb NOT NULL DEFAULT '{}'::jsonb");
            DB::statement(<<<'SQL'
                ALTER TABLE pedido_productos
                ADD CONSTRAINT pedido_productos_atributos_objeto_chk CHECK (jsonb_typeof(atributos) = 'object')
            SQL);

            DB::statement(<<<'SQL'
                CREATE UNIQUE INDEX pp_unica_linea
                ON pedido_productos (pedido_id, producto_id, atributos)
                WHERE deleted_at IS NULL
            SQL);
        });
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            Schema::table('pedido_productos', function (Blueprint $table) {
                $table->dropColumn('atributos');
            });

            Schema::table('productos', function (Blueprint $table) {
                $table->dropColumn('atributos');
            });

            return;
        }

        DB::transaction(function () {
            DB::statement('DROP INDEX IF EXISTS pp_unica_linea');
            DB::statement('ALTER TABLE pedido_productos DROP CONSTRAINT IF EXISTS pedido_productos_atributos_objeto_chk');
            DB::statement('ALTER TABLE productos DROP CONSTRAINT IF EXISTS productos_atributos_array_chk');
            DB::statement('ALTER TABLE pedido_productos DROP COLUMN IF EXISTS atributos');
            DB::statement('ALTER TABLE productos DROP COLUMN IF EXISTS atributos');
        });
    }
};
