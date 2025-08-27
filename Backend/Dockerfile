FROM node:20-alpine
WORKDIR /app

# 1) Instalar dependencias del backend
COPY Backend/package*.json ./Backend/
RUN cd Backend && npm ci --omit=dev

# 2) Copiar todo el proyecto
COPY . .

ENV NODE_ENV=production
EXPOSE 3000

# 3) Generar Prisma Client con el schema de Postgres y crear tablas en Neon
# 4) Arrancar el servidor
CMD sh -c "cd Backend \
  && npx prisma generate --schema=prisma/schema.pg.prisma \
  && npx prisma db push --schema=prisma/schema.pg.prisma \
  && node server.js"
