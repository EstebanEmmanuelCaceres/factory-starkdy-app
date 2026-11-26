<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Solo quedan las prioridades normal y alta, y se elimina el estado "completado_pd".
 * Los pedidos existentes se pasan al valor equivalente:
 *  - prioridad baja    -> normal
 *  - prioridad critica -> alta
 *  - estado completado_pd -> completado (en todo el historial de estados)
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('pedidos')->where('prioridad', 'baja')->update(['prioridad' => 'normal']);
        DB::table('pedidos')->where('prioridad', 'critica')->update(['prioridad' => 'alta']);

        DB::table('pedido_historial_estado')->where('estado', 'completado_pd')->update(['estado' => 'completado']);
    }

    /**
     * No se puede deshacer: después de migrar ya no se sabe cuáles eran bajas, críticas o completado_pd.
     */
    public function down(): void
    {
    }
};
