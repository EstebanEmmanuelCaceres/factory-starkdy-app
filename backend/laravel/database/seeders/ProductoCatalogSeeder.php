<?php

namespace Database\Seeders;

use App\Models\Producto;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\File;

class ProductoCatalogSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $jsonPath = database_path('seeders/catalogo_productos_unificado.json');

        if (!File::exists($jsonPath)) {
            $this->command->error("El archivo JSON no existe en: {$jsonPath}");
            return;
        }

        $json = File::get($jsonPath);
        $products = json_decode($json, true);

        if (!is_array($products)) {
            $this->command->error("El JSON no tiene un formato válido de arreglo.");
            return;
        }

        $this->command->info("Sembrando " . count($products) . " productos...");

        foreach ($products as $item) {
            $nombre = $item['name'] ?? null;
            $descripcion = $item['description'] ?? null;
            $precio = $item['price'] ?? null;

            if (empty($nombre)) {
                continue;
            }

            $precioDecimal = is_numeric($precio) ? (float) $precio : null;

            Producto::updateOrCreate(
                ['nombre' => $nombre],
                [
                    'descripcion' => $descripcion,
                    'precio' => $precioDecimal
                ]
            );
        }

        $this->command->info("✅ Siembra de productos finalizada con éxito.");
    }
}
