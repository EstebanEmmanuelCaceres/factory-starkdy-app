# 🏭 Sistema de Gestión Industrial

Plataforma de gestión para fábrica construida con **Next.js 14**, **Laravel 11** y **PostgreSQL**, completamente dockerizada.

---

## Stack Tecnológico

| Capa | Tecnología | Puerto |
|------|-----------|--------|
| Frontend | Next.js 14 + React 18 + TypeScript | `3000` |
| Backend API | Laravel 11 (PHP 8.3) + Nginx | `8000` |
| Base de datos | PostgreSQL 16 | `5432` |
| Caché / Colas | Redis 7 | `6379` |

---

## Requisitos

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado y corriendo
- Git (opcional)

---

## Inicio Rápido

### 1. Clonar / Descomprimir el proyecto
```bash
cd factory-app
```

### 2. Configurar variables de entorno
```bash
copy .env.example .env
# Editar .env si necesitás cambiar puertos o credenciales
```

### 3. Levantar los contenedores
```bash
docker-compose up --build
```

> ⏳ **La primera vez puede tomar 5-8 minutos** mientras Docker instala Laravel y sus dependencias.  
> Las siguientes veces será casi instantáneo.

### 4. Acceder a la aplicación

| Servicio | URL |
|----------|-----|
| 🌐 Frontend (Next.js) | http://localhost:3000 |
| 🔌 API (Laravel) | http://localhost:8000/api |
| 📋 Health check | http://localhost:8000/up |

---

## Usuarios de Demo

| Usuario | Email | Contraseña | Rol |
|---------|-------|-----------|-----|
| Administrador | `admin@fabrica.com` | `password` | Admin |
| Supervisor | `supervisor@fabrica.com` | `password` | Supervisor |
| Operador | `operador@fabrica.com` | `password` | Operador |

---

## API Endpoints

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/auth/login` | Iniciar sesión | No |
| `POST` | `/api/auth/logout` | Cerrar sesión | Sí |
| `GET`  | `/api/auth/me` | Usuario actual | Sí |

**Ejemplo de login:**
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@fabrica.com","password":"password"}'
```

---

## Estructura del Proyecto

```
factory-app/
├── docker-compose.yml          # Orquestación Docker
├── .env                        # Variables de entorno
│
├── backend/                    # Laravel 11 (PHP 8.3)
│   ├── Dockerfile
│   ├── docker-entrypoint.sh    # Script de inicialización automática
│   ├── nginx.conf              # Servidor web
│   ├── supervisord.conf        # Gestor de procesos
│   ├── laravel/                # ← Laravel se instala aquí (generado)
│   └── src/                    # Código personalizado del proyecto
│       ├── routes/api.php
│       ├── app/Http/Controllers/Api/AuthController.php
│       ├── app/Models/User.php
│       ├── database/
│       │   ├── migrations/
│       │   └── seeders/
│       ├── config/cors.php
│       └── bootstrap/app.php
│
└── frontend/                   # Next.js 14 + React + TypeScript
    ├── Dockerfile
    ├── app/
    │   ├── globals.css
    │   ├── login/page.tsx      # Pantalla de login
    │   └── dashboard/
    │       ├── layout.tsx      # Layout con sidebar y header
    │       └── page.tsx        # Dashboard principal
    ├── components/
    │   ├── Sidebar.tsx
    │   └── Header.tsx
    ├── lib/
    │   ├── api.ts              # Cliente Axios
    │   └── auth.ts             # Módulo de autenticación
    └── middleware.ts           # Protección de rutas
```

---

## Comandos Útiles

```bash
# Iniciar en background
docker-compose up -d --build

# Ver logs de un servicio
docker-compose logs -f backend
docker-compose logs -f frontend

# Detener todo
docker-compose down

# Detener y borrar volúmenes (resetea la BD)
docker-compose down -v

# Ejecutar comandos de Artisan
docker-compose exec backend php artisan tinker
docker-compose exec backend php artisan make:controller Api/MiController

# Instalar dependencias de Composer
docker-compose exec backend composer require paquete/nuevo

# Ejecutar migraciones manualmente
docker-compose exec backend php artisan migrate

# Ver logs del backend PHP
docker-compose exec backend tail -f /var/log/nginx/error.log
```

---

## Desarrollo

### Agregar un nuevo módulo

1. **Backend**: Crear modelo, migración y controlador en `backend/src/`
2. **Registrar ruta**: Agregar en `backend/src/routes/api.php`
3. **Frontend**: Crear la página en `frontend/app/dashboard/[modulo]/page.tsx`
4. **Sidebar**: Cambiar `available: false` a `available: true` en `components/Sidebar.tsx`

---

## Variables de Entorno

| Variable | Default | Descripción |
|----------|---------|-------------|
| `FRONTEND_PORT` | `3000` | Puerto del frontend |
| `BACKEND_PORT` | `8000` | Puerto del backend |
| `DB_PORT` | `5432` | Puerto de PostgreSQL |
| `DB_DATABASE` | `factory_db` | Nombre de la base de datos |
| `DB_USERNAME` | `factory_user` | Usuario de PostgreSQL |
| `DB_PASSWORD` | `factory_secret` | Contraseña de PostgreSQL |

---

## Licencia

MIT — Proyecto de gestión industrial interno.
