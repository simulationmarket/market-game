// routes/decisions.routes.js
const express = require('express');
const router = express.Router();
const { submitLimiter } = require('../utils/security');
const { decisionSchema } = require('../utils/validate');

router.post('/submit', submitLimiter, async (req, res) => {
  try {
    const parsed = decisionSchema.parse(req.body);
    console.log('[decision.submit] payload OK:', JSON.stringify(parsed));
    return res.json({
      ok: true,
      idempotent: false,
      receivedAt: new Date().toISOString()
    });
  } catch (e) {
    // Errores detallados de Zod
    const details = e?.issues?.map(i => `${i.path.join('.')}: ${i.message}`) || [];
    return res.status(400).json({ ok: false, error: 'payload inválido', details });
  }
});

module.exports = { router };
