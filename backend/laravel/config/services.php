<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'tiendanube' => [
        'app_id' => env('TIENDANUBE_APP_ID'),
        'client_secret' => env('TIENDANUBE_CLIENT_SECRET'),
        'store_id' => env('TIENDANUBE_STORE_ID'),
        'access_token' => env('TIENDANUBE_ACCESS_TOKEN'),
        'user_agent' => env('TIENDANUBE_USER_AGENT', 'StarkDY'),
        'webhook_url' => env('TIENDANUBE_WEBHOOK_URL'),
        // Usuario (vendedor) al que se asignan los pedidos importados; si está vacío se usa el primer admin
        'user_id' => env('TIENDANUBE_USER_ID'),
    ],

];
