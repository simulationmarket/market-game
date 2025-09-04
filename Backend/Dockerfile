# Imagen base
FROM node:20-alpine

# Carpeta de trabajo
WORKDIR /app

# 1) Copiar manifests + prisma antes de instalar dependencias
COPY Backend/package*.json ./Backend/
COPY Backend/prisma ./Backend/prisma

# 2) Instalar dependencias (ejecuta postinstall: prisma generate)
RUN cd Backend && npm ci --omit=dev

# 3) Copiar el resto del proyecto
COPY Backend ./Backend
COPY Frontend ./Frontend

# 4) Variables de entorno
ENV NODE_ENV=production

# 5) Exponer puerto (Koyeb usará $PORT)
EXPOSE 3000

# 6) Entrar en Backend y arrancar
WORKDIR /app/Backend
CMD ["npm", "start"]
