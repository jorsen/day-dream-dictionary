/**
 * Credit pack routes
 *
 * GET  /api/v1/credits          — get current credit balance
 * POST /api/v1/credits/purchase — initiate a one-time Stripe payment for credits
 *
 * Credits are stored on the users document:
 *   creditBalance, totalCreditsEarned, totalCreditsSpent
 *
 * Stripe webhook (payment_intent.succeeded) finalises the credit grant —
 * credits are NEVER added here, only after webhook confirmation.
 *
 * Pack pricing (configure env vars in Render):
 *   STRIPE_PRICE_CREDITS_10  ($9.99)
 *   STRIPE_PRICE_CREDITS_25  ($19.99)
 *   STRIPE_PRICE_CREDITS_60  ($39.99)
 */

import { Router } from 'express';
import Stripe from 'stripe';
import { getDB } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { creditPurchaseSchema } from '../validation/schemas.js';

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const PACKS = {
  '10': { credits: 10, amountCents: 999,  label: '10 Credits — $9.99'  },
  '25': { credits: 25, amountCents: 1999, label: '25 Credits — $19.99' },
  '60': { credits: 60, amountCents: 3999, label: '60 Credits — $39.99' },
};

// ── GET /api/v1/credits ────────────────────────────────────────────────────────
router.get('/', authenticate, async (req, res) => {
  const db = getDB();
  try {
    const user = await db.collection('users').findOne(
      { _id: req.user._id },
      { projection: { creditBalance: 1, totalCreditsEarned: 1, totalCreditsSpent: 1 } },
    );
    return res.json({
      creditBalance:      user?.creditBalance      ?? 0,
      totalCreditsEarned: user?.totalCreditsEarned ?? 0,
      totalCreditsSpent:  user?.totalCreditsSpent  ?? 0,
    });
  } catch (err) {
    console.error('[credits/get]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/v1/credits/purchase ─────────────────────────────────────────────
router.post('/purchase', authenticate, async (req, res) => {
  const parsed = creditPurchaseSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0].message });
  }

  const { pack, paymentMethodId } = parsed.data;
  const packInfo = PACKS[pack];

  const db = getDB();

  try {
    // Reuse or create Stripe customer
    const sub = await db.collection('subscriptions').findOne({ userId: req.user._id });
    let customerId = sub?.stripeCustomerId ?? null;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: req.user.email,
        name:  req.user.displayName,
        metadata: { userId: req.user._id.toString() },
      });
      customerId = customer.id;
    }

    // Attach payment method
    try {
      await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
    } catch {
      // Already attached — ignore
    }

    // Create one-time PaymentIntent
    const pi = await stripe.paymentIntents.create({
      amount:   packInfo.amountCents,
      currency: 'usd',
      customer: customerId,
      payment_method: paymentMethodId,
      confirm: true,
      automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
      metadata: {
        type:    'credits',
        pack,
        credits: String(packInfo.credits),
        userId:  req.user._id.toString(),
        email:   req.user.email,
      },
    });

    // Credits are granted via webhook (payment_intent.succeeded)
    return res.json({
      paymentIntentId: pi.id,
      status:          pi.status,
      clientSecret:    pi.status === 'requires_action' ? pi.client_secret : null,
      pack:            packInfo.label,
      credits:         packInfo.credits,
    });
  } catch (err) {
    if (err.type === 'StripeCardError') {
      return res.status(402).json({ error: err.message });
    }
    if (err.type?.startsWith('Stripe')) {
      console.error('[credits/purchase] Stripe error:', err.message);
      return res.status(502).json({ error: 'Payment provider error — please try again' });
    }
    console.error('[credits/purchase]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
