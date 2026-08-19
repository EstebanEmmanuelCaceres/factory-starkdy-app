<?php

namespace App\Services;

use Cloudinary\Cloudinary;
use Cloudinary\Configuration\Configuration;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class CloudinaryService
{
    protected ?Cloudinary $cloudinary = null;
    protected bool $isConfigured = false;

    public function __construct()
    {
        $cloudinaryUrl = config('cloudinary.url');
        $cloudName = config('cloudinary.cloud_name');
        $apiKey = config('cloudinary.api_key');
        $apiSecret = config('cloudinary.api_secret');

        try {
            if (!empty($cloudinaryUrl)) {
                $this->cloudinary = new Cloudinary($cloudinaryUrl);
                $this->isConfigured = true;
            } elseif (!empty($cloudName) && !empty($apiKey) && !empty($apiSecret)) {
                $config = new Configuration();
                $config->cloud->cloudName = $cloudName;
                $config->cloud->apiKey = $apiKey;
                $config->cloud->apiSecret = $apiSecret;
                $config->url->secure = true;
                $this->cloudinary = new Cloudinary($config);
                $this->isConfigured = true;
            }
        } catch (\Throwable $e) {
            Log::warning('Error al inicializar Cloudinary SDK: ' . $e->getMessage());
            $this->cloudinary = null;
            $this->isConfigured = false;
        }
    }

    /**
     * Verificar si Cloudinary está configurado con credenciales válidas.
     */
    public function isConfigured(): bool
    {
        return $this->isConfigured;
    }

    /**
     * Subir un archivo de imagen a Cloudinary (o fallback a disco local público).
     *
     * @param UploadedFile|string $file Archivo adjunto o ruta local
     * @param string|null $folder Carpeta personalizada en Cloudinary
     * @return array ['url' => string, 'path_almacenamiento' => string|null, 'public_id' => string|null, 'provider' => string]
     */
    public function uploadImage($file, ?string $folder = null): array
    {
        $folderName = $folder ?? "factory_productos";
        if ($this->isConfigured && $this->cloudinary !== null) {
            try {
                $filePath = $file instanceof UploadedFile ? $file->getRealPath() : $file;

                $uploadApi = $this->cloudinary->uploadApi();
                $result = $uploadApi->upload($filePath, [
                    'folder' => $folderName,
                    'resource_type' => 'image',
                    'overwrite' => true,
                ]);

                Log::info('Imagen subida exitosamente a Cloudinary: ' . ($result['secure_url'] ?? $result['url']));

                return [
                    'url' => $result['secure_url'] ?? $result['url'],
                    'path_almacenamiento' => $result['public_id'] ?? null,
                    'public_id' => $result['public_id'] ?? null,
                    'provider' => 'cloudinary',
                ];
            } catch (\Exception $e) {
                Log::error('Error al subir imagen a Cloudinary: ' . $e->getMessage());
            }
        } else {
            Log::warning('Cloudinary no está configurado o falló su inicialización. Usando almacenamiento local de fallback.');
        }

        // Fallback a almacenamiento local público
        $disk = config('filesystems.default', 'public');
        if ($file instanceof UploadedFile) {
            $path = $file->store('productos', $disk);
            $url = Storage::disk($disk)->url($path);
        } else {
            $path = 'productos/' . basename($file);
            Storage::disk($disk)->put($path, file_get_contents($file));
            $url = Storage::disk($disk)->url($path);
        }

        return [
            'url' => $url,
            'path_almacenamiento' => $path,
            'public_id' => null,
            'provider' => 'local',
        ];
    }

    /**
     * Eliminar una imagen de Cloudinary o del storage local.
     *
     * @param string|null $pathOrPublicId Public ID en Cloudinary o path local
     * @return bool
     */
    public function deleteImage(?string $pathOrPublicId): bool
    {
        if (empty($pathOrPublicId)) {
            return false;
        }

        if ($this->isConfigured && $this->cloudinary !== null) {
            try {
                $uploadApi = $this->cloudinary->uploadApi();
                $result = $uploadApi->destroy($pathOrPublicId, [
                    'resource_type' => 'image',
                    'invalidate' => true,
                ]);

                if (isset($result['result']) && ($result['result'] === 'ok' || $result['result'] === 'not found')) {
                    return true;
                }
            } catch (\Exception $e) {
                Log::warning('Error o advertencia al borrar en Cloudinary: ' . $e->getMessage());
            }
        }

        // Fallback borrado local
        $disk = config('filesystems.default', 'public');
        if (Storage::disk($disk)->exists($pathOrPublicId)) {
            return Storage::disk($disk)->delete($pathOrPublicId);
        }

        return false;
    }
}
