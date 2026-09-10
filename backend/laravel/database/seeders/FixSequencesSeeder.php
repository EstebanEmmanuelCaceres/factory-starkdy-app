<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class FixSequencesSeeder extends Seeder
{
    public function run(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        $columns = DB::select("
            SELECT table_name, column_name, column_default
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND column_default LIKE 'nextval%'
        ");

        foreach ($columns as $col) {
            $table = $col->table_name;
            $column = $col->column_name;
            $default = $col->column_default;

            // Extract sequence name from column_default (e.g. nextval('pagos_id_seq'::regclass))
            $seq = null;
            if (preg_match("/nextval\('([^']+)'/i", $default, $matches)) {
                $seq = explode("'", $matches[1])[0];
                $seq = explode("::", $seq)[0];
            }

            if (!$seq) {
                $seqResult = DB::select("SELECT pg_get_serial_sequence('$table', '$column') as seq");
                $seq = $seqResult[0]->seq ?? null;
            }

            if (!$seq) {
                $seq = "{$table}_{$column}_seq";
            }

            try {
                $maxId = DB::table($table)->max($column);
                $val = max((int) $maxId, 1);

                DB::statement("SELECT setval('$seq', $val)");
                if (isset($this->command)) {
                    $this->command->info("Sequence '$seq' for table '$table' ($column) reset to $val.");
                }
            } catch (\Throwable $e) {
                if (isset($this->command)) {
                    $this->command->error("Failed resetting sequence '$seq' for '$table': " . $e->getMessage());
                }
            }
        }
    }
}
