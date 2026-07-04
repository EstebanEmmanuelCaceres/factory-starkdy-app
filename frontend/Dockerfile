FROM node:20-alpine

WORKDIR /app

# Instalar dependencias primero (mejor caché de capas)
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copiar fuentes (en desarrollo se sobreescribe con volumen)
COPY . .

EXPOSE 3000

# Desarrollo con hot-reload
CMD ["npm", "run", "dev"]
