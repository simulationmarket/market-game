// utils/security.js
const rateLimit = require('express-rate-limit');

// Limita ráfagas de POST (p.ej. formularios/decisiones)
const submitLimiter = rateLimit({
  windowMs: 15 * 1000,   // ventana de 15s
  max: 20,               // máximo 20 peticiones/ventana por IP
  standardHeaders: true, // X-RateLimit-* response headers
  legacyHeaders: false
});

// (Si más tarde quieres otro perfil para lectura:)
// const readLimiter = rateLimit({ windowMs: 5 * 1000, max: 60 });

module.exports = { submitLimiter /*, readLimiter*/ };