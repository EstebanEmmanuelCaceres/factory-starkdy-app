# 🚀 Guía de Ejecución Rápida y Mantenimiento (Runbook)

Este documento contiene los pasos estandarizados y más eficientes para levantar y operar el proyecto **Sistema de Gestión Industrial (factory-starkdy-app)**, junto con el registro histórico de optimizaciones técnicas.

---

## 📋 1. Checklist Previo

Antes de ejecutar los comandos, verificar:
1. **Docker Desktop** iniciado y corriendo en Windows.
2. Archivo [`.env`](file:///c:/Users/hp/Desktop/factory-starkdy-app/.env) configurado en la raíz (si no existe, copiar desde `.env.example`).
3. Puertos libres en tu máquina:
   - Frontend: `3000`
   - Backend API: `8000`
   - Adminer: `8080`

---

## ⚡ 2. Pasos para Levantar el Proyecto

### Opción A: Modo Desarrollo con Hot-Reload (Recomendado para programar)
Permite que los cambios en el frontend (`./frontend`) se reflejen automáticamente en el navegador usando polling optimizado para Windows:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

### Opción B: Modo Producción / Standalone
Construye el bundle optimizado de Next.js (`next build` + `next start`):

```bash
docker compose up -d --build
```

---

## 🔍 3. Verificación de Servicios Activos

Una vez ejecutado el comando, comprobar que los contenedores estén saludables:

```bash
# Ver estado de los contenedores
docker compose ps
```

### Endpoints y Accesos Locales:
| Servicio | URL Local | Estado esperado |
|---|---|---|
| **Frontend** | [http://localhost:3000](http://localhost:3000) | Pantalla de Login / Dashboard |
| **Backend Health** | [http://localhost:8000/up](http://localhost:8000/up) | HTTP 200 OK |
| **API Base** | [http://localhost:8000/api](http://localhost:8000/api) | Respuesta API / Rutas activas |
| **Adminer (DB UI)** | [http://localhost:8080](http://localhost:8080) | Login DB (Server: `db`, DB/User: `.env`) |

### Credenciales de Prueba:
- **Admin**: `admin@fabrica.com` | Contraseña: `password`
- **Supervisor**: `supervisor@fabrica.com` | Contraseña: `password`
- **Operador**: `operador@fabrica.com` | Contraseña: `password`

---

## 🛠️ 4. Comandos Frecuentes y Operación Diaria

### Actualización rápida en el Servidor (Script Automatizado)
Para actualizar el proyecto en el servidor con un solo comando (descarga cambios de Git, recompila imágenes, corre migraciones y limpia caché):
```bash
./update.sh
```

### Otros comandos útiles:
```bash
# Ver logs en tiempo real
docker compose logs -f frontend
docker compose logs -f backend

# Detener los servicios sin borrar datos
docker compose stop

# Bajar servicios manteniendo volúmenes de base de datos
docker compose down

# Reiniciar backend o frontend puntualmente tras un cambio
docker compose restart backend
docker compose restart frontend

# Ejecutar migraciones o seeders de Laravel
docker compose exec backend php artisan migrate
docker compose exec backend php artisan db:seed

# Reinicio completo desde cero (¡Atención: borra volumen de base de datos!)
docker compose down -v
docker compose up -d --build
```

---

## ⚠️ 5. Resolución de Problemas Comunes

1. **Error de variables o CORS en Frontend (`NEXT_PUBLIC_API_URL`)**:
   - `NEXT_PUBLIC_API_URL` se incrusta durante la compilación.
   - Si se cambia en `.env`, es obligatorio recompilar:
     ```bash
     docker compose up -d --build frontend
     ```

2. **Puerto ocupado (3000, 8000 u 8080)**:
   - Cambiar los puertos en `.env` (`FRONTEND_PORT`, `BACKEND_PORT`, `ADMINER_PORT`) o liberar el proceso que los use con:
     ```powershell
     Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process
     ```

3. **Laravel no conecta a Postgres en el arranque inicial**:
   - El script `backend/docker-entrypoint.sh` incluye reintentos automáticos (hasta 40 intentos).
   - Verificar con `docker compose logs -f backend`.

---

## 📝 6. Bitácora de Cambios Clave y Optimizaciones Operativas

> **Instrucción para el Asistente:** Documentar en esta sección cada cambio técnico relevante (nuevos servicios, variables requeridas, cambios en scripts de build o dependencias críticas) para mantener la ejecución siempre optimizada.

| Fecha | Cambio / Optimización | Impacto en la Ejecución |
|---|---|---|
| **05/11/2026** | Creación de `RUNBOOK.md` y regla en `AGENTS.md`. | Protocolo estandarizado de levantamiento del entorno y persistencia de memoria para el asistente. |
| **05/11/2026** | Hot-Reload de desarrollo con `docker-compose.dev.yml`. | Activa `WATCHPACK_POLLING=true` para sincronización en caliente de Next.js sobre Windows/Docker sin rebuild manual. |
| **05/11/2026** | Configuración de persistencia y healthcheck en PostgreSQL 16. | Evita arranques prematuros de Laravel esperando condición `service_healthy`. |
| **05/11/2026** | Corrección de persistencia y visibilidad de `comentario` / `descripcion` en Pedidos. | Se removió `comentario` y `fecha_entrega` de `makeHidden` en `PedidoController::index`, se añadieron a la selección SQL, se creó accesor/mutador bidireccional `descripcion` en `Pedido` y sincronización en formularios y modales (`EditPedidoModal`, `PedidoDetailModal` y wizard de creación). |
| **06/11/2026** | Corrección de tipo TypeScript en `EditPedidoModal.tsx` (`current.precio`). | Resuelve fallo en Docker build (`next build`) por posible valor `null` no controlado en `pedido.precio.toString()`. |
| **06/11/2026** | Creación del script de despliegue `update.sh` y `.gitattributes`. | Automatiza pull, build docker, migraciones, optimización de Laravel y limpieza de imágenes residuales en el servidor en un solo paso. |
| **08/11/2026** | Migración `2026_11_08_000000_add_soft_deletes_e_imagenes_a_comentarios_pedido`: `deleted_at` en `comentarios_pedido` y `comentario_id` (FK nullable) en `pedido_imagenes`. Rutas nuevas: `PATCH/DELETE /api/pedidos/{id}/comentarios/{comentarioId}` (autor o admin) y `PATCH /api/pedidos/estado` (cambio de estado en lote, solo admin). `POST /api/pedidos/{id}/comentarios` acepta `imagenes[]` (multipart). | Requiere `php artisan migrate` al desplegar (lo hace `update.sh`). Las imágenes de comentarios se suben a `storage/app/public/pedidos` igual que las de la galería, y aparecen en ambos lados. |
