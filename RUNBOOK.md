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
| **08/11/2026** | Dashboard para Rol Diseñadora (ID 7 / slug `disenadora`) y Panel de Pedidos sin Imagen. | Se aisló el rol diseñadora de la lógica previa de vendedor; se ocultaron todas las cajas y métricas financieras de cobros/saldos/comisiones; se creó el componente `PedidosSinImagenPanel` con filtrado por vendedor, buscador y acción rápida para cargar planos/imágenes directo a la galería del pedido. |
| **09/11/2026** | Remoción de la feature de "Diseños Pendientes" del Dashboard. | Se eliminó la caja `PendingDesignsCard` y modal `CompleteDesignModal`, sus endpoints en Laravel (`GET /disenos-pendientes`, `POST /pedidos/{id}/completar-disenos`) y métodos asociados en `ResponsableEtapaController` y `responsable_etapas.ts`. |
| **10/11/2026** | Integración Tiendanube: ventas online → pedidos (webhook `POST /api/webhooks/tiendanube`). | Migraciones nuevas ejecutadas: `pedidos.tiendanube_order_id` (único, evita duplicados) + `pedidos.origen`, y `productos.sku` (relaciona cada producto con su par en Tiendanube; si no hay SKU se intenta por nombre exacto). Nuevas variables `TIENDANUBE_*` en `backend/laravel/.env` (se requiere `TIENDANUBE_CLIENT_SECRET` para validar la firma HMAC). El webhook procesa con bloque `try/catch` devolviendo HTTP 500 en fallo para que Tiendanube reintente. Búsqueda de clientes por email case-insensitive (`LOWER(TRIM(email))`). Detalle completo de compra volcado al campo descripción del pedido para carga manual. Soporte completo de SKU en backend (`ProductoController::store/update/index`) y frontend (`lib/products.ts` y vista/modales de productos). Comandos: `php artisan tiendanube:webhooks listar\|registrar\|borrar` y `tiendanube:importar {orden}`. Tests: `tests/Feature/TiendanubeWebhookTest.php` (15 tests passing). |
| **10/11/2026** | Descarga de Remito Proforma (PDF) en Paso 3 de creación de pedidos (`CreatePedidoModal`). | Se incorporaron `jspdf` y `jspdf-autotable` en el frontend. Se implementó `lib/remitoProformaPdf.ts` replicando con precisión el diseño corporativo de COMATE SRL / STARK DY: barra superior negra con logo, razón social, CUIT e Industria Argentina; título "REMITO PROFORMA" con nota de validez; tabla dinámica de productos con precio unitario, cantidad, total y saldo total; bloque de datos bancarios con credenciales Galicia (cuenta, CUIT, Razón Social, CBU, Alias STARKDY); y footer negro institucional. Disponible tanto en el resumen del Paso 3 (`OrderSummary`) como tras confirmar el pedido (`OrderCreated`). |
| **10/11/2026** | Desbloqueo y combinación de filtros con el buscador en el panel de pedidos. | Se eliminó el bloqueo (`disabled`) sobre los selectores de prioridad y estado al ingresar texto en el buscador de pedidos. Al comenzar a escribir en el buscador, el selector de estado se cambia automáticamente a 'Todos los estados' (`todos`) para reflejar la búsqueda global, permitiendo al usuario volver a seleccionar 'Estados Activos' o cualquier estado puntual para acotar los resultados. Se implementó soporte en el backend (`estado=activos`) y en el filtrado de frontend (`INACTIVE_ESTADOS`) para excluir completados, cancelados y enviados al buscar pedidos activos. |
| **10/11/2026** | Rediseño de sección de pedidos en Dashboard Admin: Caja de Pedidos Activos y Cargados Hoy. | Para el rol Admin en el dashboard (`/dashboard`), se reemplazó la tabla de pedidos actuales por una tarjeta/caja resumen de KPIs que expone el total de pedidos activos y pendientes (con desglose de pendientes y en fabricación) y destaca la cantidad de pedidos cargados en el día de la fecha (`created_at` hoy), con enlace directo a la vista de Pedidos. Se reacomodó el ancho de la tabla adyacente de "Completados por Cobrar" a 8 columnas. |
| **10/11/2026** | Caja contraíble de "Completados por Cobrar" (exclusiva para rol Admin). | Se implementó el estado `isUnpaidCollapsed` en el panel de Completados por Cobrar en el dashboard. Para el rol Admin la caja inicia contraída de forma compacta, mostrando el resumen de pedidos terminados con deuda y el saldo total pendiente acumulado (`totalCompletedUnpaidBalance`), permitiendo desplegar la tabla completa con un clic en la cabecera o mediante el botón de toggle con chevron animado. Para los demás roles se mantiene desplegada y fija sin alterar su flujo de trabajo. |
| **10/11/2026** | Gráfico interactivo de líneas de rendimiento diario por vendedor (Dashboard Admin). | Se creó el endpoint `GET /api/metricas/vendedores-diario` en `MetricaController` (con soporte para rango de fechas y filtro por vendedor) y la relación `pedidos()` en el modelo `User`. En el frontend se desarrolló el componente `VendedoresLineChart` con renderizado SVG interactivo, tooltip hover por día, conmutador de métrica (Plata Cobrada vs Ventas en pedidos), selectores de fecha desde/hasta, selector de vendedor, botón de mes actual y leyenda interactiva para ocultar/mostrar líneas por vendedor. Posicionado al pie del dashboard de Admin debajo de las cajas de pedidos activos y completados por cobrar. |
