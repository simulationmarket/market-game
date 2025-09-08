// prisma/index.js — Koyeb/multipartida ready
const { PrismaClient } = require('@prisma/client');

const isProd = process.env.NODE_ENV === 'production';

// Logs: en prod solo warn/error; en dev añade 'query' si quieres
const log =
  (process.env.PRISMA_LOG && process.env.PRISMA_LOG.split(',').map(s => s.trim())) ||
  (isProd ? ['warn', 'error'] : ['warn', 'error']);

// Singleton para evitar múltiples conexiones en hot-reload / importaciones múltiples
const prisma =
  globalThis.__prismaClient ||
  new PrismaClient({ log });

if (!isProd) {
  globalThis.__prismaClient = prisma;
}

// Conexión temprana en producción (arranque más estable)
if (isProd) {
  prisma.$connect().catch((e) => {
    console.error('[Prisma] Error al conectar:', e);
  });
}


// Desconexión limpia si el proceso termina sin pasar por tu shutdown
process.on('beforeExit', async () => {
  try { await prisma.$disconnect(); } catch {}
});

module.exports = { prisma };
