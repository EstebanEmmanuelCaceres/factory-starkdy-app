<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Configuración de Cloudinary (Gestor de Imágenes)
    |--------------------------------------------------------------------------
    |
    | Puedes configurar Cloudinary mediante una URL completa en CLOUDINARY_URL
    | o especificando las credenciales individuales.
    |
    */

    'url' => env('CLOUDINARY_URL'),

    'cloud_name' => env('CLOUDINARY_CLOUD_NAME'),
    'api_key'    => env('CLOUDINARY_API_KEY'),
    'api_secret' => env('CLOUDINARY_API_SECRET'),

    'folder' => env('CLOUDINARY_FOLDER', 'factory_productos'),
];
