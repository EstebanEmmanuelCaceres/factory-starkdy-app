#!/usr/bin/env bash
# =============================================================================
# Script de actualización automática para el servidor
# Sistema de Gestión Industrial - factory-starkdy-app
# =============================================================================
set -e

# Colores para la salida
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "\n${BLUE}====================================================${NC}"
echo -e "${BLUE}  🚀 Actualizando Sistema de Gestión Industrial     ${NC}"
echo -e "${BLUE}====================================================${NC}\n"

# Determinar directorio base del repositorio
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_DIR"

# Determinar rama actual de git
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")

echo -e "${YELLOW}📥 1. Descargando últimos cambios desde Git (rama: ${CURRENT_BRANCH})...${NC}"
git fetch origin "$CURRENT_BRANCH"
git pull origin "$CURRENT_BRANCH"

echo -e "\n${YELLOW}🐳 2. Reconstruyendo y levantando contenedores...${NC}"
docker compose up -d --build --remove-orphans

echo -e "\n${YELLOW}⏳ 3. Esperando inicialización de servicios...${NC}"
sleep 5

echo -e "\n${YELLOW}🧹 4. Limpiando cachés de Laravel...${NC}"
docker compose exec -T backend php artisan optimize:clear || true

echo -e "\n${YELLOW}🗄️  5. Verificando migraciones de base de datos...${NC}"
docker compose exec -T backend php artisan migrate --force || true

echo -e "\n${YELLOW}🧼 6. Liberando imágenes residuales de Docker...${NC}"
docker image prune -f || true

echo -e "\n${GREEN}====================================================${NC}"
echo -e "${GREEN}  ✅ ¡Proyecto actualizado y servicios activos!     ${NC}"
echo -e "${GREEN}====================================================${NC}\n"

docker compose ps
