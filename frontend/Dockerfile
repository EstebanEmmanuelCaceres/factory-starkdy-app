# ═══════════════════════════════════════════════════════════════════
# 1. DEPENDENCIAS
# ═══════════════════════════════════════════════════════════════════
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps

# ═══════════════════════════════════════════════════════════════════
# 2. DESARROLLO (hot-reload)
#    Uso: docker build --target dev
# ═══════════════════════════════════════════════════════════════════
FROM node:20-alpine AS dev
WORKDIR /app
ENV NODE_ENV=development
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# ═══════════════════════════════════════════════════════════════════
# 3. BUILD DE PRODUCCIÓN
#    NEXT_PUBLIC_* se incrusta en el bundle del navegador ACÁ, en el
#    build. Pasarla como variable de entorno en runtime no sirve.
# ═══════════════════════════════════════════════════════════════════
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_API_URL=http://localhost:8000/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build

# ═══════════════════════════════════════════════════════════════════
# 4. RUNTIME DE PRODUCCIÓN
# ═══════════════════════════════════════════════════════════════════
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
