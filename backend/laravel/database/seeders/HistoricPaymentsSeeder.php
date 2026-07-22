<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class HistoricPaymentsSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function up(): void
    {
        // 1. Obtener todos los pedidos que tienen un pago asociado y marcar su tipo_pago como 'unico'
        $pedidosConPago = DB::table('pagos')->pluck('pedido_id');
        
        DB::table('pedidos')
            ->whereIn('id', $pedidosConPago)
            ->update(['tipo_pago' => 'unico']);

        // 2. Migrar los registros de la tabla pagos a la nueva estructura
        $pagos = DB::table('pagos')->get();

        foreach ($pagos as $pago) {
            DB::table('pagos')
                ->where('id', $pago->id)
                ->update([
                    'tipo_cobro' => 'unico',
                    'vendedor_id' => $pago->vendedor_id ?? $pago->registrado_por,
                    'medio_pago' => $pago->medio_pago ?? $pago->medio,
                    'fecha_pago' => $pago->fecha_pago ?? $pago->pagado_at ?? $pago->created_at,
                ]);
        }
    }

    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $this->up();
    }
}
