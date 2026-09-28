<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('categoria_etapa', function (Blueprint $table) {
            $table->id();
            $table->foreignId('categoria_id')->constrained('categorias')->cascadeOnDelete();
            $table->foreignId('etapa_id')->constrained('etapas')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['categoria_id', 'etapa_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('categoria_etapa');
    }
};
