# Reglas de Comportamiento del Asistente (Antigravity Rules)

## 1. Levantamiento y Operación del Proyecto
- Cuando el usuario solicite "levantar el proyecto", "iniciar la aplicación", "arrancar los servicios", "levantar docker" o cualquier variante similar:
  1. Consultar y seguir estrictamente los pasos detallados en [`RUNBOOK.md`](file:///c:/Users/hp/Desktop/factory-starkdy-app/RUNBOOK.md).
  2. Verificar previamente el estado de Docker y de los contenedores con `docker compose ps` o `docker ps`.
  3. Para tareas de desarrollo local, priorizar el modo de desarrollo con recarga automática:
     ```bash
     docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
     ```
  4. Realizar una verificación automática de conectividad (ej. `http://localhost:8000/up` y `http://localhost:3000`) antes de confirmar que está levantado.
  5. Entregar al usuario un resumen claro con el estado de los servicios, URLs accesibles y credenciales demo.

## 2. Documentación Continua de Cambios Clave
- Cada vez que se realicen cambios técnicos o estructurales en el proyecto (por ejemplo: agregar nuevas variables de entorno en `.env`, agregar servicios en Docker, modificar migraciones, alterar rutas críticas de API o dependencias):
  1. Actualizar la sección **"6. Bitácora de Cambios Clave y Optimizaciones Operativas"** en [`RUNBOOK.md`](file:///c:/Users/hp/Desktop/factory-starkdy-app/RUNBOOK.md).
  2. Indicar fecha, descripción del cambio y su impacto operativo para mantener siempre óptima la ejecución.
