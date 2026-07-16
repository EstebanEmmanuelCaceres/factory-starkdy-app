<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Agregar responsabilidad requerida a etapas
        Schema::table('etapas', function (Blueprint $table) {
            $table->foreignId('responsabilidad_id')
                ->nullable()
                ->constrained('responsabilidades')
                ->nullOnDelete();
        });

        // 2. Nueva tabla etapa_dependencias
        Schema::create('etapa_dependencias', function (Blueprint $table) {
            $table->id();
            $table->foreignId('etapa_id')->constrained('etapas')->cascadeOnDelete();
            $table->foreignId('depende_de_etapa_id')->constrained('etapas')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['etapa_id', 'depende_de_etapa_id'], 'uq_etapa_dependencia');
        });

        // Agregar restricción de no autodependencia en etapa_dependencias
        if (DB::getDriverName() !== 'sqlite') {
            DB::statement('ALTER TABLE etapa_dependencias ADD CONSTRAINT chk_no_autodependencia CHECK (etapa_id <> depende_de_etapa_id)');
        }

        // Hacer user_id nullable
        if (DB::getDriverName() === 'sqlite') {
            Schema::table('responsables_etapas', function (Blueprint $table) {
                $table->unsignedBigInteger('user_id')->nullable()->change();
            });
        } else {
            DB::statement('ALTER TABLE responsables_etapas ALTER COLUMN user_id DROP NOT NULL');
        }

        // Agregar restricción de estado en responsables_etapas
        if (DB::getDriverName() !== 'sqlite') {
            DB::statement("ALTER TABLE responsables_etapas DROP CONSTRAINT IF EXISTS chk_responsables_etapas_estado");
            DB::statement("ALTER TABLE responsables_etapas ADD CONSTRAINT chk_responsables_etapas_estado CHECK (estado IN ('bloqueada', 'pendiente', 'en_progreso', 'completado'))");
        }

        // 4. Corregir el FK de etapa_historial_estado
        Schema::table('etapa_historial_estado', function (Blueprint $table) {
            $table->foreignId('responsable_etapa_id')
                ->nullable()
                ->constrained('responsables_etapas')
                ->cascadeOnDelete();
        });

        // Backfill de datos antiguos (si existen)
        if (DB::getDriverName() !== 'sqlite') {
            DB::statement("
                UPDATE etapa_historial_estado eh
                SET responsable_etapa_id = (
                    SELECT re.id FROM responsables_etapas re
                    WHERE re.etapa_id = eh.etapa_id
                    LIMIT 1
                )
            ");
        }

        // Eliminar huérfanos que no se pudieron backfillear para evitar errores de NOT NULL
        DB::table('etapa_historial_estado')->whereNull('responsable_etapa_id')->delete();

        // Hacer responsable_etapa_id NOT NULL
        if (DB::getDriverName() === 'sqlite') {
            Schema::table('etapa_historial_estado', function (Blueprint $table) {
                $table->unsignedBigInteger('responsable_etapa_id')->nullable(false)->change();
            });
        } else {
            DB::statement('ALTER TABLE etapa_historial_estado ALTER COLUMN responsable_etapa_id SET NOT NULL');
        }

        // Quitar etapa_id y agregar las nuevas columnas a etapa_historial_estado
        Schema::table('etapa_historial_estado', function (Blueprint $table) {
            $table->dropForeign(['etapa_id']);
            $table->dropColumn('etapa_id');
            $table->string('estado_anterior')->nullable();
            $table->string('estado_nuevo')->default('pendiente');
            $table->text('observacion')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Nota: El rollback de una reestructuración de FK destructiva como esta puede ser complejo.
        // Se implementa un rollback básico eliminando las tablas creadas o columnas añadidas.
        
        Schema::table('etapa_historial_estado', function (Blueprint $table) {
            $table->foreignId('etapa_id')->nullable()->constrained('etapas')->cascadeOnDelete();
            $table->dropColumn(['responsable_etapa_id', 'estado_anterior', 'estado_nuevo', 'observacion']);
        });

        if (DB::getDriverName() !== 'sqlite') {
            DB::statement("ALTER TABLE responsables_etapas DROP CONSTRAINT IF EXISTS chk_responsables_etapas_estado");
            DB::statement("ALTER TABLE responsables_etapas ADD CONSTRAINT chk_responsables_etapas_estado CHECK (estado IN ('pendiente', 'en_progreso', 'completado'))");
        }
        if (DB::getDriverName() === 'sqlite') {
            Schema::table('responsables_etapas', function (Blueprint $table) {
                $table->unsignedBigInteger('user_id')->nullable(false)->change();
            });
        } else {
            DB::statement('ALTER TABLE responsables_etapas ALTER COLUMN user_id SET NOT NULL');
        }

        Schema::dropIfExists('etapa_dependencias');

        Schema::table('etapas', function (Blueprint $table) {
            $table->dropColumn('responsabilidad_id');
        });
    }
};
