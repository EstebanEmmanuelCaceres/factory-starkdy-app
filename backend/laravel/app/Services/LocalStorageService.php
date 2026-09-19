<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class LocalStorageService
{
    /**
     * Subir un archivo de imagen al almacenamiento local en el disco público.
     *
     * @param UploadedFile|string $file Archivo adjunto o ruta local
     * @param string|null $folder Carpeta destino (ej. 'productos', 'pedidos')
     * @return array ['url' => string, 'path_almacenamiento' => string, 'public_id' => null, 'provider' => 'local']
     */
    public function uploadImage($file, ?string $folder = null): array
    {
        $disk = 'public';
        $rawFolder = $folder ?? 'productos';
        $folderName = str_replace('factory_', '', $rawFolder);

        if ($file instanceof UploadedFile) {
            $path = $file->store($folderName, $disk);
            $url = Storage::disk($disk)->url($path);
        } else {
            $extension = pathinfo($file, PATHINFO_EXTENSION);
            if (empty($extension) || strlen($extension) > 5) {
                $extension = 'jpg';
            }
            $filename = \Illuminate\Support\Str::random(40) . '.' . $extension;
            $path = $folderName . '/' . $filename;
            Storage::disk($disk)->put($path, file_get_contents($file));
            $url = Storage::disk($disk)->url($path);
        }

        Log::info("Imagen subida exitosamente al almacenamiento local: {$path}");

        return [
            'url' => $url,
            'path_almacenamiento' => $path,
            'public_id' => null,
            'provider' => 'local',
        ];
    }

    /**
     * Eliminar una imagen del almacenamiento local público.
     *
     * @param string|null $path Ruta relativa del archivo en el storage (ej. 'productos/abc.jpg')
     * @return bool
     */
    public function deleteImage(?string $path): bool
    {
        if (empty($path)) {
            return false;
        }

        $disk = 'public';
        if (Storage::disk($disk)->exists($path)) {
            Log::info("Imagen eliminada del almacenamiento local: {$path}");
            return Storage::disk($disk)->delete($path);
        }

        return false;
    }
}
