/**
 * PDF report routes
 *
 * GET /api/v1/reports/pdf/:dreamId           — standard PDF (Basic/Pro)
 * GET /api/v1/reports/pdf/:dreamId?mode=therapist — therapist PDF (requires therapist_pdf add-on)
 */

import { Router } from 'express';
import { getDB, ObjectId } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { generateDreamPdf } from '../services/pdf.js';

const router = Router();

// ── Middleware: require active subscription ────────────────────────────────────
async function requirePremium(req, res, next) {
  const db = getDB();
  const sub = await db.collection('subscriptions').findOne({
    userId: req.user._id,
    status: 'active',
    currentPeriodEnd: { $gt: new Date() },
  });
  if (!sub) {
    return res.status(403).json({
      error: 'PDF export requires an active Basic or Pro subscription.',
      upgradeUrl: '/payment.html',
    });
  }
  req.userSub = sub;
  next();
}

// ── Middleware: require a specific add-on ─────────────────────────────────────
function requireAddon(addonKey) {
  return async (req, res, next) => {
    const db = getDB();
    const addon = await db.collection('user_addons').findOne({
      userId:   req.user._id,
      addonKey,
      active:   true,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
    });
    if (!addon) {
      return res.status(403).json({
        error: `This PDF format requires the Therapist Export add-on.`,
        addonKey,
        upgradeUrl: '/payment.html#addons',
      });
    }
    next();
  };
}

// ── GET /api/v1/reports/pdf/:dreamId ─────────────────────────────────────────
router.get('/pdf/:dreamId', authenticate, async (req, res) => {
  if (!ObjectId.isValid(req.params.dreamId)) {
    return res.status(400).json({ error: 'Invalid dream ID' });
  }

  const therapistMode = req.query.mode === 'therapist';

  // Therapist mode requires add-on; standard PDF requires subscription
  const middlewares = therapistMode
    ? [requireAddon('therapist_pdf')]
    : [requirePremium];

  // Run middleware chain
  let middlewareError = null;
  for (const mw of middlewares) {
    await new Promise((resolve) => {
      mw(req, res, (err) => {
        if (err) middlewareError = err;
        resolve();
      });
    });
    if (middlewareError || res.headersSent) return;
  }

  const db = getDB();

  try {
    const dream = await db.collection('dreams').findOne({
      _id:    new ObjectId(req.params.dreamId),
      userId: req.user._id,
    });

    if (!dream) return res.status(404).json({ error: 'Dream not found' });

    const pdfBuffer = await generateDreamPdf(dream, req.user, { therapistMode });

    const filename = therapistMode
      ? `ddd-therapist-${req.params.dreamId}.pdf`
      : `dream-${req.params.dreamId}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    return res.end(pdfBuffer);
  } catch (err) {
    if (err.message?.includes('pdfkit is not installed')) {
      return res.status(503).json({ error: 'PDF generation not available — server configuration issue' });
    }
    console.error('[reports/pdf]', err);
    return res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

export default router;
