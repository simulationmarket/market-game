FROM node:20-alpine
WORKDIR /app

# Instala dependencias de producción
COPY package*.json ./
RUN npm ci --omit=dev

# Copia el resto del proyecto
COPY . .

ENV NODE_ENV=production
EXPOSE 3000

# Genera Prisma Client y sincroniza esquema en Neon, luego arranca
# OJO: ruta al schema de producción (está en backend/prisma/)
CMD sh -c "npx prisma generate --schema=backend/prisma/schema.pg.prisma && npx prisma db push --schema=backend/prisma/schema.pg.prisma && node backend/server.js"
