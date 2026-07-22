<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() === 'sqlite') {
            return;
        }
        DB::statement("UPDATE pedidos SET fecha_entrega = NULL WHERE fecha_entrega IS NOT NULL AND fecha_entrega !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'");
        DB::statement('ALTER TABLE pedidos ALTER COLUMN fecha_entrega TYPE date USING NULLIF(fecha_entrega, \'\')::date');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (DB::getDriverName() === 'sqlite') {
            return;
        }
        DB::statement('ALTER TABLE pedidos ALTER COLUMN fecha_entrega TYPE varchar(255) USING fecha_entrega::varchar');
    }
};
