# Notas de operación — Stark Dy

Bitácora y contexto operativo del proyecto. No es documentación del código: acá va lo que no se deduce leyendo el repo.

Última actualización: 2026-09-06.

---

## 1. Contexto

**Repos.** El proyecto activo es `EstebanEmmanuelCaceres/factory-starkdy-app`. El repo viejo `gosh19/app-starkdy` está abandonado y no comparte historia con este — si alguien clona ese, está mirando otra cosa.

**Producción.** VPS Hostinger `srv1875010` (72.61.27.14), en `~/factory-starkdy-app`, con docker compose. Dominio `https://app.starkdy.com.ar`, activo desde el 5/9/2026.

**Cadena de request:**

```
navegador → Caddy (:80/:443, contenedor factory-starkdy-app-proxy-1)
              ├── /api/*  → factory-backend  (nginx + php-fpm dentro de la misma imagen) → Laravel
              └── resto   → factory-frontend (:3000, Next.js)
```

El `Server: nginx` de las respuestas sale del nginx que vive **dentro** de la imagen del backend, no de un contenedor aparte: por eso expone 9000/tcp (php-fpm) y :80. El único proxy externo es Caddy.

Solo `/api/*` llega a Laravel. Cualquier ruta de Laravel fuera de ese prefijo la termina atendiendo Next.js y devuelve 404 o 405.

**Contenedores** (verificado 6/9/2026, un solo stack desde `/root/factory-starkdy-app`): `factory-frontend`, `factory-backend`, `factory-db`, `factory-redis`, más `factory-starkdy-app-proxy-1` (caddy:2-alpine) y `factory-starkdy-app-adminer-1` (adminer:4). Los dos últimos llevan el prefijo del proyecto porque no tienen `container_name` fijado; por eso el compose los reporta como huérfanos.

**Estado de despliegue.** Al 6/9/2026 el server estaba en `c0ebf68` (PR #4), 22 commits atrás de `origin/main` (`5d0daa9`, PR #9). Le faltan pedidos, imágenes con Cloudinary, dashboard de tareas y ajustes mobile. No asumir que lo desplegado es lo que dice el repo: verificar con `git log --oneline -1` en el server.

**Base de datos.** Postgres `factory_db`, usuario `factory_user`. Se administra por Adminer en `http://72.61.27.14:8080`.

---

## 2. Bitácora

### 2026-09-06 — Login roto desde que se puso el dominio

**Síntoma.** Después de apuntar `app.starkdy.com.ar` al VPS (5/9), nadie podía loguearse. El formulario no devolvía error del server: simplemente no pasaba nada.

**Causa.** `NEXT_PUBLIC_API_URL` es un **build arg** (`frontend/Dockerfile`, `docker-compose.yml`): se incrusta en el bundle durante `npm run build`, no se lee en runtime. El bundle desplegado tenía quemado:

```
baseURL: "http://srv1875010.hstgr.cloud:8000/api"
```

Con la página servida por HTTPS, el navegador bloqueaba esa request por **mixed content** antes de emitirla. Encima ese `:8000` ya no respondía desde afuera.

**Diagnóstico.** El backend estaba sano todo el tiempo:

```
POST https://app.starkdy.com.ar/api/auth/login  →  422 + errores de validación
Access-Control-Allow-Origin: https://app.starkdy.com.ar
```

**Fix.** En el `.env` del server:

```
NEXT_PUBLIC_API_URL=https://app.starkdy.com.ar/api
CORS_ALLOWED_ORIGINS=https://app.starkdy.com.ar
```

y **rebuild** (reiniciar el contenedor no alcanza):

```bash
docker compose up -d --build frontend
```

**Verificación.** El chunk del login cambió de hash y quedó con `baseURL:"https://app.starkdy.com.ar/api"`. Al apuntar al mismo origen desaparecen mixed content y CORS de una.

> **Regla para el futuro:** cada vez que cambie el dominio o la URL de la API hay que rebuildear el frontend, no reiniciarlo.

### 2026-09-06 — Carga de 31 clientes de Bruno

Se cargaron los clientes de "VENTAS BRUNO 2026", hoja SEPTIEMBRE, filas 6 a 36 (del 2/9 al 4/9). Ejecutado en Adminer dentro de una transacción: `INSERT` → 31 registros afectados, `SELECT count(*)` → 31, `COMMIT` sin error.

Correcciones de tipeo aplicadas al pasar: `PARABRISAS URUGUAR` → `URUGUAY`, `OBRERO AUTOMOTRES` → `AUTOMOTORES`. Quedó sin corregir `BOTELLLAS`, que está en la columna PEDIDO (no entra en `clientes`).

De los 31, solo SIMSPIRIT trae datos de contacto completos; el resto entró con nombre y montos nada más.

Después se ejecutó el UPDATE que invierte C/D en SIMSPIRIT, quedando `nombre_cliente = 'nehuen flores'` y `nombre_empresa = 'SIMSPIRIT'`. Con eso quedó fijado el criterio: persona en `nombre_cliente`.

### 2026-09-06 — Carga de 11 clientes de Agustina

Hoja SEPTIEMBRE2, filas 9 a 19 (2/9 al 4/9). Mapeo literal, que ya cumple el criterio. Con esto la tabla llega a 42 clientes cargados desde las planillas.

Se insertaron con los valores crudos de la planilla y después se corrigieron por UPDATE:

- `Lorenzo y repetto`: la planilla trae ingreso 1.157.000 / total 1.007.000 / saldo -150.000. Quedó con ingreso = total = 1.007.000 y saldo 0.
- `Brian Torres`: DNI `40-185-576` → `40185576`.
- `Enrique Rohringer.` → `Enrique Rohringer`.

Estas correcciones se hicieron **sólo en la base, no en la planilla**: regenerar la fórmula sobre esas filas vuelve a producir los valores viejos.

### 2026-09-06 — Producción pasa a la rama `ajuste_mobile_emma`

Para recuperar la creación automática de etapas, el server se cambió de `main` (`c0ebf68`) a `ajuste_mobile_emma` (`b9def38`), que es la única rama con el observer más el backfill.

Pasos: backup de la base (`/root/backup_factory_20260906_1809.sql`, 179K) → stash del `frontend/Dockerfile` modificado → stash de artefactos de `storage/` y `bootstrap/cache` (bloqueaban el checkout con "local changes would be overwritten") → checkout.

**No hizo falta correr `migrate`:** todas las migraciones figuraban ya aplicadas, incluida `2026_09_01_..._assign_default_etapas_to_existing_productos` en el batch 5. Por eso el backfill no vuelve a correr y el producto 160 hay que arreglarlo aparte.

Como el backend monta `./backend/laravel` por bind mount, el código PHP cambia con el checkout, sin rebuild. El frontend sí necesita rebuild, porque va en la imagen.

Después del checkout: `php artisan optimize:clear` (por el `AppServiceProvider` cacheado), que dejó `ProductoObserver.php` visible en `app/Observers/`, y `docker compose up -d --build frontend` para traer los dashboards de la rama.

**Verificado:** un producto nuevo creado desde el admin (`cubrepatente`) nace con sus 3 etapas. Problema resuelto.

### 2026-09-06 — `ajuste_mobile_emma` mergeada a main, prod vuelve a main

El merge fue **fast-forward** (`main` no tenía nada que la rama no tuviera), así que `origin/main` pasó de `5d0daa9` a `b9def38` sin conflictos. En el server alcanzó con `git checkout main && git pull --ff-only`: como el commit era el mismo que ya corría, no hizo falta rebuild ni migrate.

Estado final: `main`, `origin/main` y el server, todos en `b9def38`. La rama `ajuste_mobile_emma` queda como histórico.

**En el server hay dos stashes.** El de `frontend/Dockerfile` guarda la URL vieja hardcodeada — **no restaurarlo nunca**; se identifica por su texto en `git stash list`. El de `storage/` es descartable.

### 2026-09-06 — Carga de los 42 pedidos (ejecutada)

Resultado: **42 pedidos, 42 historiales de estado, 35 pagos** (7 pedidos venían con ingreso 0) y **45 líneas de producto sobre 38 pedidos**. Clientes 17 a 47 de Bruno, 48 a 58 de Agustina.

Saldos verificados uno por uno contra las planillas: **los 42 coinciden**.

Las tareas de producción tampoco se disparan por SQL. Se generaron después con tinker (`generarTareas()`, que es idempotente): **154 tareas sobre 38 pedidos**. Antes hubo que asignarle etapas al `160 Starter Pack`, que estaba en 0 y aparece en 7 pedidos — un producto sin etapas no genera ninguna tarea.

**Cuidado al verificar con SQL:** una consulta que hace `LEFT JOIN pagos` y `LEFT JOIN pedido_productos` a la vez multiplica los pagos por la cantidad de productos y muestra saldos negativos falsos. Usar subconsultas para cada agregado, no joins.

Al cerrar la carga se puso `clientes.saldo` en 0 en los 42 (ids 17 a 58): la deuda ya vive en los pedidos, y ese campo sólo servía para que el controlador la leyera como límite de crédito y rechazara pedidos nuevos con 422.

**Las fechas hubo que corregirlas después.** La carga puso `created_at = NOW()` en todo, así que los 42 figuraban como del 6/9 en vez de sus fechas reales. Se recuperaron de `fecha_entrega - 15 días` y se alinearon las cuatro tablas (pedido, historial, pagos con sus `fecha_pago`/`pagado_at`, y líneas de producto), con hora 12:00 para que ningún corrimiento de zona horaria moviera el día. Quedaron 14 pedidos el 2/9, 15 el 3/9 y 13 el 4/9. **Para la próxima carga histórica: poner la fecha real en `created_at` desde el principio.**


Cada fila de las planillas es un pedido. Mapeo: `precio` = VALOR TOTAL, `monto_pago_inicial` = Ingreso, y el saldo lo calcula el sistema (`precio − pagos`), coincidiendo con la columna SALDO.

Un INSERT no dispara los hooks del modelo, así que hay que replicar tres tablas: `pedidos`, `pedido_historial_estado` (el estado **no es columna**: lo escribe `booted::saved`) y `pagos`. Más `pedido_productos` aparte.

Convenciones: código `BRU-`/`AGU-202609-NNN`, prioridad `normal`, `fecha_entrega` = venta + 15 días, y el texto original de la planilla guardado en `comentario`.

**Vendedores:** `user_id` 7 = Bruno, 8 = Agustina. Se aplicó a `pedidos.user_id` y, heredado del pedido, a `pagos.vendedor_id` y `pagos.registrado_por` — este último importa porque la rama desplegada calcula comisiones. Las tareas (`responsables_etapas.user_id`) quedaron en el admin: ese campo es el operario que ejecuta, no el vendedor.

**Diccionario planilla → producto:** DTF→158, PREMIUMS→4, PREMIUMS LARGOS→163, PATENTES→71, LLAVEROS FLEXIBLES→162, STARTER→160, gross→159, LAPICERAS→98, BOTELLAS→114, DOME→164, mates a secas→84, tazas sensor→5, llaveros con dome→82. No se cargan termos, bolsas, promocionales, envío, grabados ni los compuestos de mate.

Quedan 4 pedidos sin productos: ELITE, CRAVERO, PATAGONIA y el `set matero` de Daniel Carretero.

**Cuidado con el catálogo:** los nombres se renombran seguido (`Lavero flexible`→`Llavero flexible`, `Llaveros Plasticos con Cuero y Dome`→`Llaveros Plasticos con Dome`, `Cubre Patente Personalizados`→`Cubrepatente Personalizados`, y el `161 Cubrepatente` fue borrado). Verificar los nombres exactos antes de mapear, no confiar en una consulta previa.

---

## 3. Procedimiento: cargar clientes desde las planillas

Las ventas se registran en Google Sheets, una planilla por vendedor y una pestaña por mes:

- **VENTAS BRUNO 2026** — vendedor: Bruno
- **VENTAS AGUSTINA M 2026** — vendedora: Agustina

Misma plantilla en las dos: `A FECHA · B Trello · C CLIENTE · D EMPRESA · E DNI · F MAIL · G DIRECCION · H PROVINCIA · I CP · J LOCALIDAD · K TELEFONO · L PEDIDO · M Ingreso · N VALOR TOTAL · O SALDO · P OBSERVACIONES`.

### Mapeo a la tabla `clientes`

| Sheet | Columna |
|---|---|
| C CLIENTE | `nombre_cliente` |
| D EMPRESA | `nombre_empresa` |
| K TELEFONO | `telefono` |
| F MAIL | `email` |
| E DNI | `dni` |
| G DIRECCION | `direccion` |
| H PROVINCIA | `provincia` |
| I CP | `cp` |
| J LOCALIDAD | `localidad` |
| M / N / O | `ingreso` / `valor_total` / `saldo` |
| P OBSERVACIONES | `observaciones` |

`L PEDIDO` no tiene destino en `clientes` — eso es la tabla `pedidos`.

### La fórmula

Pegar en una celda vacía de la hoja (ej. R2). Genera un `INSERT` por fila desde la fecha de corte en adelante:

```
=TEXTJOIN(CHAR(10);1;FILTER("INSERT INTO clientes (nombre_cliente,nombre_empresa,telefono,email,dni,direccion,provincia,cp,localidad,ingreso,valor_total,saldo,observaciones,created_at,updated_at) VALUES ('"&SUBSTITUTE(TRIM(C3:C&"");"'";"''")&"','"&SUBSTITUTE(TRIM(D3:D&"");"'";"''")&"','"&SUBSTITUTE(TRIM(K3:K&"");"'";"''")&"',"&IF(TRIM(F3:F&"")="";"NULL";"'"&SUBSTITUTE(TRIM(F3:F&"");"'";"''")&"'")&","&IF(TRIM(E3:E&"")="";"NULL";"'"&SUBSTITUTE(TRIM(E3:E&"");"'";"''")&"'")&","&IF(TRIM(G3:G&"")="";"NULL";"'"&SUBSTITUTE(TRIM(G3:G&"");"'";"''")&"'")&","&IF(TRIM(H3:H&"")="";"NULL";"'"&SUBSTITUTE(TRIM(H3:H&"");"'";"''")&"'")&","&IF(TRIM(I3:I&"")="";"NULL";"'"&TRIM(I3:I&"")&"'")&","&IF(TRIM(J3:J&"")="";"NULL";"'"&SUBSTITUTE(TRIM(J3:J&"");"'";"''")&"'")&","&SUBSTITUTE(TEXT(IFERROR(M3:M*1;0);"0.00");",";".")&","&SUBSTITUTE(TEXT(IFERROR(N3:N*1;0);"0.00");",";".")&","&SUBSTITUTE(TEXT(IFERROR(O3:O*1;0);"0.00");",";".")&","&IF(TRIM(P3:P&"")="";"NULL";"'"&SUBSTITUTE(TRIM(P3:P&"");"'";"''")&"'")&",NOW(),NOW());";(A3:A>=DATE(2026;9;2))*(TRIM(C3:C&D3:D)<>"")))
```

Cambiar la fecha en `DATE(2026;9;2)` según el corte. Si Sheets rechaza la fórmula, cambiar los `;` por `,`.

### Por qué una fórmula y no leer la planilla a ojo

El fetch programático a Sheets está bloqueado, y en pantalla los mails y direcciones se ven truncados por el ancho de columna. Transcribir a mano termina inventando datos. La fórmula los saca de la celda.

### Detalles que rompen

- La planilla usa **coma decimal**, así que hay que forzar punto en el SQL (`SUBSTITUTE(TEXT(...;"0.00");",";".")`).
- `nombre_cliente`, `nombre_empresa` y `telefono` son NOT NULL con default `''` — mandar `''`, nunca `NULL`.
- Escapar comillas simples duplicándolas (`O'Brien` → `O''Brien`).

### Ejecución

Siempre en transacción, y chequear duplicados antes:

```sql
BEGIN;
-- INSERT …
SELECT count(*) FROM clientes WHERE created_at >= NOW() - INTERVAL '1 minute';
COMMIT;   -- o ROLLBACK si el número no cierra
```

Duplicados ya cargados:

```sql
SELECT upper(trim(nombre_cliente)) AS nombre, count(*) AS veces, array_agg(id ORDER BY id) AS ids
FROM clientes WHERE deleted_at IS NULL
GROUP BY 1 HAVING count(*) > 1 ORDER BY 2 DESC, 1;
```

---

## 4. Productos: cómo se crean

En el repo, crear un producto dispara `ProductoObserver::created` → `Producto::asignarEtapasPorDefecto()`, que además de la fila en `productos` crea 3 filas en `etapas_productos` (diseño → produccion → finalizado) y 2 en `etapa_producto_dependencias`. Un producto sano son **6 filas en 3 tablas**.

**Esto funcionaba y se rompió por un rollback de código.** La historia, leída de los timestamps de la base el 6/9/2026:

| Producto | Creado | Etapas | Primera etapa |
|---|---|---|---|
| 160 Starter Pack | 6/9 18:02:48 | **0** | — |
| 159 Llavero Gross | 1/9 17:45:56 | 3 | 1/9 17:45:56 (mismo segundo) |
| 158 Sticker DTF UV | 20/8 12:36 | 4 | 20/8 12:37 (cargadas a mano) |
| varios | 8/8 00:51 | 3 | 2/9 14:19 (backfill masivo) |

El 1/9 el observer estaba activo. El 2/9 corrió el backfill sobre los productos viejos. Entre esa fecha y el 6/9 el server volvió a `c0ebf68`, que no tiene el observer, y desde entonces los productos nuevos nacían sin etapas.

**Lección:** para saber si una función está viva no alcanza con leer el código desplegado — los datos cuentan la historia real. Mirar timestamps antes de concluir.

Para comprobar qué tiene cada producto:

```sql
SELECT p.id, p.nombre, count(ep.id) AS etapas
FROM productos p LEFT JOIN etapas_productos ep ON ep.producto_id = p.id
GROUP BY p.id, p.nombre ORDER BY p.id;
```

Si el observer no estuviera activo, habría que armar las etapas a mano con los endpoints (que existen en las dos versiones):

1. `POST /api/etapas` — crear `diseño`, `produccion`, `finalizado` si el catálogo está vacío (la migración que las siembra tampoco está desplegada).
2. `POST /api/productos/{id}/etapas/sync` — asignarlas al producto con su orden.
3. `POST /api/etapa-dependencias` — encadenarlas.

Todo bajo `auth:sanctum`: hace falta token.

---

## 5. Problemas conocidos

**Las dos planillas usan CLIENTE y EMPRESA al revés.** Bruno pone el nombre comercial en CLIENTE y la persona en EMPRESA (`SIMSPIRIT` / `nehuen flores`); Agustina hace lo contrario (`Alejandro Tiche` / `Alunik`).

**Criterio adoptado (6/9/2026): la persona va en `nombre_cliente` y la empresa en `nombre_empresa`.** Es como ya vienen los datos de Agustina, así que su carga usa el mapeo literal. Para Bruno hay que invertir C/D al generar el SQL. El único registro ya cargado que estaba al revés era SIMSPIRIT, corregido con UPDATE.

**Saldos negativos en la planilla.** Aparecen cuando el ingreso supera al valor total. Cada caso hay que mirarlo: puede ser cobro de más o las dos columnas invertidas.

**Los montos son de la venta, no del cliente.** `ingreso`, `valor_total` y `saldo` viven en `clientes`, pero la planilla tiene una fila por venta: un cliente con dos ventas entra dos veces con montos distintos. **Sin resolver.**

**No hay constraint de unicidad en `clientes`.** Nada impide cargar el mismo cliente dos veces. Hoy se controla a mano con la query de duplicados.

**Filas sin nombre de cliente.** Varias de Agustina traen solo EMPRESA (`EF evolution`, `L' auxiliatriche`, `Lorenzo y repetto`, `Velez automotores`) y entran con `nombre_cliente` vacío.

**El `frontend/Dockerfile` tenía la URL vieja hardcodeada.** Alguien editó en producción, sin commitear, el default del build arg:

```diff
-ARG NEXT_PUBLIC_API_URL=http://localhost:8000/api
+ARG NEXT_PUBLIC_API_URL=http://srv1875010.hstgr.cloud:8000/api
```

Es el origen del bug de login. No molestaba porque el `.env` pisa ese valor vía compose, pero un build sin esa variable lo resucita. Quedó guardado en `stash@{1}` ("URL vieja hardcodeada... NO restaurar") — **no hacerle `pop`**.

**No correr `docker compose up --remove-orphans` en el server.** El compose avisa que `factory-starkdy-app-proxy-1` y `factory-starkdy-app-adminer-1` son huérfanos, pero están en uso: ese proxy es el nginx que sirve `/api` y ese adminer es el que se usa para la base. Ya no están definidos en el compose actual, así que la bandera los borraría.

**`frontend/Dockerfile` está modificado en el server sin commitear.** El archivo es idéntico entre `c0ebf68` y `origin/main`, así que ese cambio es una edición local hecha directo en producción que no existe en ningún commit. Un `git checkout` o un pull con conflicto lo pierde. Hay que ver qué cambia (`git diff frontend/Dockerfile`) y commitearlo.

**`precio` no se valida al crear un producto.** `ProductoController::store()` valida sólo `nombre` y `descripcion`, pero hace `Producto::create($request->all())` y `precio` está en `$fillable`: entra sin control.

**El pivot de materias primas está mal nombrado.** El modelo `Producto` declara `->withPivot('cantidad_necesaria')` pero la columna real es `cantidad_requerida`, así que la cantidad de la receta se lee siempre en null.

**La columna Q tiene notas que no se migran.** En la planilla de Agustina aparecen anotaciones sueltas fuera de OBSERVACIONES (ej. Q6: "A FAVOR CASA ZAPPALA $238.500"). El mapeo solo toma P, así que eso se pierde.

---

## 6. Pendientes

- [ ] Corregir en la planilla de Agustina lo que se arregló sólo en la base: el ingreso de `Lorenzo y repetto`, el DNI de `Brian Torres` y el punto de `Enrique Rohringer`. Si no, la próxima regeneración los trae mal de nuevo.
- [ ] Correr la query de duplicados sobre lo ya cargado de Bruno.
- [ ] Arreglar el doble espacio en el nombre del producto 82 (`Llaveros Plasticos con  Dome`).
- [ ] Actualizar el server a `origin/main` (22 commits atrás). Hacerlo aparte del fix de login, para no mezclar causas si algo falla.
- [ ] Corregir `BOTELLLAS` en la planilla de Bruno (columna PEDIDO).
