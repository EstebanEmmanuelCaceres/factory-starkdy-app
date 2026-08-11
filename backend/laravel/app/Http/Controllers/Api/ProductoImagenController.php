<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Producto;
use App\Models\ProductoImagen;
use App\Services\CloudinaryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class ProductoImagenController extends Controller
{
    protected CloudinaryService $cloudinaryService;

    public function __construct(CloudinaryService $cloudinaryService)
    {
        $this->cloudinaryService = $cloudinaryService;
    }

    /**
     * Listar todas las imágenes de un producto.
     */
    public function index($productoId): JsonResponse
    {
        $producto = Producto::find($productoId);

        if (!$producto) {
            return response()->json([
                'status' => 'error',
                'message' => 'Producto no encontrado'
            ], 404);
        }

        $imagenes = $producto->imagenes;

        return response()->json([
            'status' => 'success',
            'data' => $imagenes
        ]);
    }

    /**
     * Subir una o varias imágenes para un producto.
     * Soporta archivos adjuntos subidos a Cloudinary (o disco local) o URLs externas.
     */
    public function store(Request $request, $productoId): JsonResponse
    {
        $producto = Producto::find($productoId);

        if (!$producto) {
            return response()->json([
                'status' => 'error',
                'message' => 'Producto no encontrado'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'imagenes' => 'nullable|array',
            'imagenes.*' => 'image|mimes:jpeg,png,jpg,webp,svg,gif|max:10240',
            'imagen' => 'nullable|image|mimes:jpeg,png,jpg,webp,svg,gif|max:10240',
            'url' => 'nullable|url',
            'urls' => 'nullable|array',
            'urls.*' => 'url',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Error de validación de imágenes',
                'errors' => $validator->errors()
            ], 422);
        }

        $hasPrincipal = $producto->imagenes()->where('es_principal', true)->exists();
        $maxOrden = $producto->imagenes()->max('orden') ?? 0;

        $createdImages = [];

        // 1. Procesar archivo individual "imagen" con CloudinaryService
        if ($request->hasFile('imagen')) {
            $file = $request->file('imagen');
            $uploadResult = $this->cloudinaryService->uploadImage($file);

            $maxOrden++;
            $isPrincipal = !$hasPrincipal && count($createdImages) === 0;

            $createdImages[] = ProductoImagen::create([
                'producto_id' => $producto->id,
                'url' => $uploadResult['url'],
                'path_almacenamiento' => $uploadResult['path_almacenamiento'],
                'orden' => $maxOrden,
                'es_principal' => $isPrincipal,
            ]);

            if ($isPrincipal) {
                $hasPrincipal = true;
            }
        }

        // 2. Procesar array de archivos "imagenes" con CloudinaryService
        if ($request->hasFile('imagenes')) {
            foreach ($request->file('imagenes') as $file) {
                $uploadResult = $this->cloudinaryService->uploadImage($file);

                $maxOrden++;
                $isPrincipal = !$hasPrincipal && count($createdImages) === 0;

                $createdImages[] = ProductoImagen::create([
                    'producto_id' => $producto->id,
                    'url' => $uploadResult['url'],
                    'path_almacenamiento' => $uploadResult['path_almacenamiento'],
                    'orden' => $maxOrden,
                    'es_principal' => $isPrincipal,
                ]);

                if ($isPrincipal) {
                    $hasPrincipal = true;
                }
            }
        }

        // 3. Procesar URL individual "url"
        if ($request->filled('url')) {
            $maxOrden++;
            $isPrincipal = !$hasPrincipal && count($createdImages) === 0;

            $createdImages[] = ProductoImagen::create([
                'producto_id' => $producto->id,
                'url' => $request->input('url'),
                'path_almacenamiento' => null,
                'orden' => $maxOrden,
                'es_principal' => $isPrincipal,
            ]);

            if ($isPrincipal) {
                $hasPrincipal = true;
            }
        }

        // 4. Procesar array de URLs "urls"
        if ($request->has('urls') && is_array($request->input('urls'))) {
            foreach ($request->input('urls') as $externalUrl) {
                if (filter_var($externalUrl, FILTER_VALIDATE_URL)) {
                    $maxOrden++;
                    $isPrincipal = !$hasPrincipal && count($createdImages) === 0;

                    $createdImages[] = ProductoImagen::create([
                        'producto_id' => $producto->id,
                        'url' => $externalUrl,
                        'path_almacenamiento' => null,
                        'orden' => $maxOrden,
                        'es_principal' => $isPrincipal,
                    ]);

                    if ($isPrincipal) {
                        $hasPrincipal = true;
                    }
                }
            }
        }

        if (empty($createdImages)) {
            return response()->json([
                'status' => 'error',
                'message' => 'No se enviaron imágenes válidas (adjunte archivos o proporcione URLs)'
            ], 400);
        }

        return response()->json([
            'status' => 'success',
            'message' => count($createdImages) . ' imagen(es) agregada(s) correctamente',
            'data' => $producto->fresh()->imagenes
        ], 201);
    }

    /**
     * Establecer una imagen específica como la principal (Logo).
     */
    public function setPrincipal($productoId, $imagenId): JsonResponse
    {
        $producto = Producto::find($productoId);

        if (!$producto) {
            return response()->json([
                'status' => 'error',
                'message' => 'Producto no encontrado'
            ], 404);
        }

        $targetImagen = ProductoImagen::where('producto_id', $productoId)
            ->where('id', $imagenId)
            ->first();

        if (!$targetImagen) {
            return response()->json([
                'status' => 'error',
                'message' => 'Imagen no encontrada para este producto'
            ], 404);
        }

        // Quitar flag principal de todas las imágenes del producto
        ProductoImagen::where('producto_id', $productoId)->update(['es_principal' => false]);

        // Marcar la seleccionada como principal
        $targetImagen->update(['es_principal' => true]);

        return response()->json([
            'status' => 'success',
            'message' => 'Imagen principal (logo) actualizada correctamente',
            'data' => $producto->fresh()->imagenes
        ]);
    }

    /**
     * Eliminar una imagen del producto de Cloudinary o storage local.
     */
    public function destroy($productoId, $imagenId): JsonResponse
    {
        $producto = Producto::find($productoId);

        if (!$producto) {
            return response()->json([
                'status' => 'error',
                'message' => 'Producto no encontrado'
            ], 404);
        }

        $imagen = ProductoImagen::where('producto_id', $productoId)
            ->where('id', $imagenId)
            ->first();

        if (!$imagen) {
            return response()->json([
                'status' => 'error',
                'message' => 'Imagen no encontrada'
            ], 404);
        }

        $wasPrincipal = $imagen->es_principal;

        // Eliminar archivo de Cloudinary o storage local mediante CloudinaryService
        if ($imagen->path_almacenamiento) {
            $this->cloudinaryService->deleteImage($imagen->path_almacenamiento);
        }

        $imagen->delete();

        // Si era la principal, reasignar la siguiente disponible
        if ($wasPrincipal) {
            $nextPrincipal = ProductoImagen::where('producto_id', $productoId)
                ->orderBy('orden', 'asc')
                ->first();

            if ($nextPrincipal) {
                $nextPrincipal->update(['es_principal' => true]);
            }
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Imagen eliminada correctamente',
            'data' => $producto->fresh()->imagenes
        ]);
    }

    /**
     * Reordenar las imágenes del producto.
     */
    public function reorder(Request $request, $productoId): JsonResponse
    {
        $producto = Producto::find($productoId);

        if (!$producto) {
            return response()->json([
                'status' => 'error',
                'message' => 'Producto no encontrado'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'ordenes' => 'required|array',
            'ordenes.*.id' => 'required|integer',
            'ordenes.*.orden' => 'required|integer',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Datos de reordenamiento inválidos',
                'errors' => $validator->errors()
            ], 422);
        }

        foreach ($request->input('ordenes') as $item) {
            ProductoImagen::where('producto_id', $productoId)
                ->where('id', $item['id'])
                ->update(['orden' => $item['orden']]);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Orden de imágenes actualizado',
            'data' => $producto->fresh()->imagenes
        ]);
    }
}
