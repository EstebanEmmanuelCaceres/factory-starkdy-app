#!/bin/bash
set -e

LARAVEL_PATH="/var/www/html"
LOCK_FILE="$LARAVEL_PATH/storage/.initialized"

# ─────────────────────────────────────────────────────────────────
print_banner() {
    echo ""
    echo "╔══════════════════════════════════════════════╗"
    echo "║     🏭  Sistema de Gestión — Fábrica         ║"
    echo "║         Backend Laravel 11 (PHP 8.3)         ║"
    echo "╚══════════════════════════════════════════════╝"
    echo ""
}

# ─────────────────────────────────────────────────────────────────
wait_for_postgres() {
    echo "⏳ Esperando conexión con PostgreSQL..."
    local max_tries=40
    local count=0
    until php -r "
try {
    new PDO(
        'pgsql:host=${DB_HOST:-db};port=${DB_PORT:-5432};dbname=${DB_DATABASE:-factory_db}',
        '${DB_USERNAME:-factory_user}',
        '${DB_PASSWORD:-factory_secret}'
    );
    echo 'ok';
} catch (Exception \$e) {
    exit(1);
}
" 2>/dev/null | grep -q "ok"; do
        count=$((count + 1))
        if [ "$count" -ge "$max_tries" ]; then
            echo "❌ No se pudo conectar a PostgreSQL después de $max_tries intentos. Abortando."
            exit 1
        fi
        echo "   [$count/$max_tries] PostgreSQL no disponible, reintentando en 3s..."
        sleep 3
    done
    echo "✅ PostgreSQL conectado!"
}

# ─────────────────────────────────────────────────────────────────
install_laravel() {
    if [ -f "$LARAVEL_PATH/artisan" ]; then
        echo "✅ Laravel ya instalado — omitiendo instalación."
        return
    fi

    echo ""
    echo "📦 Primera ejecución: instalando Laravel 11..."
    echo "   (Este proceso puede tomar 3-5 minutos la primera vez)"
    echo ""

    TEMP=$(mktemp -d)
    cd "$TEMP"

    COMPOSER_ALLOW_SUPERUSER=1 composer create-project laravel/laravel . \
        --prefer-dist \
        --no-interaction \
        --no-progress \
        --quiet

    echo "   Moviendo archivos a $LARAVEL_PATH..."
    cp -a "$TEMP/." "$LARAVEL_PATH/"
    cd "$LARAVEL_PATH"
    rm -rf "$TEMP"

    echo "✅ Laravel instalado correctamente."
}

# ─────────────────────────────────────────────────────────────────

# ─────────────────────────────────────────────────────────────────
configure_env() {
    if [ -f "$LARAVEL_PATH/.env" ]; then
        return
    fi

    echo "⚙️  Generando archivo .env..."
    cat > "$LARAVEL_PATH/.env" << EOF
APP_NAME="Sistema Fábrica"
APP_ENV=local
APP_KEY=
APP_DEBUG=true
APP_URL=http://localhost:8000
APP_LOCALE=es
APP_FALLBACK_LOCALE=es
APP_FAKER_LOCALE=es_AR
APP_TIMEZONE=America/Argentina/Buenos_Aires

LOG_CHANNEL=stack
LOG_LEVEL=debug

DB_CONNECTION=pgsql
DB_HOST=${DB_HOST:-db}
DB_PORT=${DB_PORT:-5432}
DB_DATABASE=${DB_DATABASE:-factory_db}
DB_USERNAME=${DB_USERNAME:-factory_user}
DB_PASSWORD=${DB_PASSWORD:-factory_secret}

CACHE_STORE=redis
QUEUE_CONNECTION=redis
SESSION_DRIVER=redis
SESSION_LIFETIME=120

REDIS_HOST=${REDIS_HOST:-redis}
REDIS_PORT=${REDIS_PORT:-6379}
REDIS_PASSWORD=null

CORS_ALLOWED_ORIGINS=${CORS_ALLOWED_ORIGINS:-http://localhost:3000}
SANCTUM_STATEFUL_DOMAINS=localhost:3000

MAIL_MAILER=log
EOF
    echo "✅ Archivo .env generado."
}

# ─────────────────────────────────────────────────────────────────
setup_laravel() {
    cd "$LARAVEL_PATH"

    # Generar clave de aplicación si está vacía
    local key_value
    key_value=$(grep "^APP_KEY=" .env | cut -d'=' -f2-)
    if [ -z "$key_value" ]; then
        COMPOSER_ALLOW_SUPERUSER=1 php artisan key:generate --force --quiet
        echo "✅ Clave de aplicación generada."
    fi

    # Instalar Sanctum si no está en composer.json
    if ! grep -q '"laravel/sanctum"' composer.json 2>/dev/null; then
        echo "🔐 Instalando Laravel Sanctum..."
        COMPOSER_ALLOW_SUPERUSER=1 composer require laravel/sanctum --no-interaction --quiet 2>&1 | tail -2
        php artisan vendor:publish \
            --provider="Laravel\Sanctum\SanctumServiceProvider" \
            --force --quiet
        echo "✅ Sanctum instalado."
    fi

    # Permisos
    chown -R www-data:www-data "$LARAVEL_PATH/storage" "$LARAVEL_PATH/bootstrap/cache" 2>/dev/null || true
    chmod -R 775 "$LARAVEL_PATH/storage" "$LARAVEL_PATH/bootstrap/cache"

    # Migraciones
    echo "🗄️  Ejecutando migraciones..."
    php artisan migrate --force 2>&1 | grep -E "(Migrating|Migrated|Nothing)" | head -20
    echo "✅ Migraciones completadas."

    # Seeder (solo primera vez)
    if [ ! -f "$LOCK_FILE" ]; then
        echo "🌱 Ejecutando seeders..."
        php artisan db:seed --force --quiet
        touch "$LOCK_FILE"
        echo "✅ Base de datos poblada con datos iniciales."
    fi

    # Caché de configuración y rutas
    php artisan config:clear --quiet
    php artisan route:clear --quiet
}

# ─────────────────────────────────────────────────────────────────
# EJECUCIÓN PRINCIPAL
# ─────────────────────────────────────────────────────────────────
print_banner
wait_for_postgres
install_laravel
configure_env
setup_laravel

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  ✅  ¡Backend listo!                                     ║"
echo "║  📍  API disponible en → http://localhost:8000/api       ║"
echo "║                                                          ║"
echo "║  👤  Usuarios demo:                                      ║"
echo "║      admin@fabrica.com     / password  (Admin)           ║"
echo "║      supervisor@fabrica.com / password (Supervisor)      ║"
echo "║      operador@fabrica.com  / password  (Operador)        ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
