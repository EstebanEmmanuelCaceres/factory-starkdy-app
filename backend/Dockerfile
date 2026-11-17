FROM php:8.3-fpm

# ── Dependencias del sistema ──────────────────────────────────────
RUN apt-get update && apt-get install -y \
    git \
    curl \
    libpq-dev \
    zip \
    unzip \
    libzip-dev \
    nginx \
    supervisor \
    dos2unix \
    && docker-php-ext-install pdo pdo_pgsql zip \
    && pecl install redis \
    && docker-php-ext-enable redis \
    && rm -rf /var/lib/apt/lists/*

# ── Composer ──────────────────────────────────────────────────────
COPY --from=composer:2.7 /usr/bin/composer /usr/bin/composer

# ── Configuración de Nginx ────────────────────────────────────────
COPY nginx.conf /etc/nginx/sites-available/default
RUN ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default \
    && rm -f /etc/nginx/sites-enabled/000-default 2>/dev/null || true

# ── Configuración de Supervisor ───────────────────────────────────
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# ── Límites de subida de archivos en PHP (alineado con Nginx 50M) ─
RUN printf "upload_max_filesize = 50M\npost_max_size = 55M\nmax_file_uploads = 20\nmemory_limit = 256M\n" > /usr/local/etc/php/conf.d/uploads.ini

# ── Directorios de logs ───────────────────────────────────────────
RUN mkdir -p /var/log/supervisor /var/log/nginx /var/log/php-fpm

# ── Entrypoint ────────────────────────────────────────────────────
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN dos2unix /docker-entrypoint.sh && chmod +x /docker-entrypoint.sh

WORKDIR /var/www/html

EXPOSE 80

ENTRYPOINT ["/docker-entrypoint.sh"]
