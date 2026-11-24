<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Reposiciones: un pedido que se vuelve a hacer porque el original llegó mal (no es una venta).
 *
 * - pedidos.tipo               'venta' | 'reposicion' (los existentes quedan como 'venta')
 * - pedidos.pedido_origen_id   venta original que se repone (siempre la original, nunca otra reposición)
 * - pedidos.motivo_reposicion  por qué se repone
 *
 * En Postgres la base hace cumplir las reglas con CHECK: una reposición siempre tiene origen
 * y motivo, y su precio es 0. En SQLite (solo tests) se agregan las columnas sin CHECK.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pedidos', function (Blueprint $table) {
            $table->string('tipo', 20)->default('venta')->after('origen');
            $table->foreignId('pedido_origen_id')->nullable()->after('tipo')
                ->constrained('pedidos')->restrictOnDelete();
            $table->string('motivo_reposicion', 30)->nullable()->after('pedido_origen_id');
            $table->index('tipo');
        });

        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement(<<<'SQL'
            ALTER TABLE pedidos
                ADD CONSTRAINT pedidos_tipo_chk CHECK (tipo IN ('venta', 'reposicion')),
                ADD CONSTRAINT pedidos_reposicion_origen_chk CHECK ((tipo = 'reposicion') = (pedido_origen_id IS NOT NULL)),
                ADD CONSTRAINT pedidos_reposicion_motivo_chk CHECK ((tipo = 'reposicion') = (motivo_reposicion IS NOT NULL)),
                ADD CONSTRAINT pedidos_motivo_reposicion_chk CHECK (
                    motivo_reposicion IS NULL
                    OR motivo_reposicion IN ('falla_produccion', 'error_diseno', 'danado_envio', 'faltante', 'otro')
                ),
                ADD CONSTRAINT pedidos_reposicion_precio_chk CHECK (tipo <> 'reposicion' OR precio = 0)
        SQL);
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement(<<<'SQL'
                ALTER TABLE pedidos
                    DROP CONSTRAINT IF EXISTS pedidos_reposicion_precio_chk,
                    DROP CONSTRAINT IF EXISTS pedidos_motivo_reposicion_chk,
                    DROP CONSTRAINT IF EXISTS pedidos_reposicion_motivo_chk,
                    DROP CONSTRAINT IF EXISTS pedidos_reposicion_origen_chk,
                    DROP CONSTRAINT IF EXISTS pedidos_tipo_chk
            SQL);
        }

        Schema::table('pedidos', function (Blueprint $table) {
            $table->dropIndex(['tipo']);
            $table->dropConstrainedForeignId('pedido_origen_id');
            $table->dropColumn(['tipo', 'motivo_reposicion']);
        });
    }
};
