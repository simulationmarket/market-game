// utils/validate.js
const { z } = require('zod');

const decisionSchema = z.object({
  requestId: z.string().uuid(),
  partidaCodigo: z.string().min(1).max(40),
  rondaNumero: z.number().int().positive(),
  jugador: z.object({
    nombre: z.string().min(1).max(60)
  }),
  data: z.object({
    presupuesto: z.object({
      marketing: z.number().min(0).max(1_000_000).optional(),
      iD: z.number().min(0).max(1_000_000).optional(),
      produccion: z.number().min(0).max(1_000_000).optional()
    }).optional(),
    banca: z.object({
      pedirPrestamo: z.number().min(0).max(1_000_000).optional()
    }).optional(),
    dividendos: z.object({
      porAccion: z.number().min(0).max(100_000).optional()
    }).optional()
  }).passthrough()
});

module.exports = { decisionSchema };
