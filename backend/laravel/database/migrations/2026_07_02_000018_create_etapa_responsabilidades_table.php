<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('etapa_responsabilidades', function (Blueprint $table) {
            $table->id();
            $table->foreignId('etapa_id')->constrained('etapas')->cascadeOnDelete();
            $table->foreignId('responsabilidad_id')->constrained('responsabilidades')->cascadeOnDelete();
            $table->unique(['etapa_id', 'responsabilidad_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('etapa_responsabilidades');
    }
};
