/**
 * Add-on routes
 *
 * GET  /api/v1/addons          — list user's active add-ons
 * POST /api/v1/addons/purchase — purchase an add-on via Stripe one-time payment
 *
 * Add-ons are stored in the `user_addons` collection:
 *   { userId, addonKey, stripePaymentIntentId, active, purchasedAt, expiresAt }
 *
 * Credits are confirmed via webhook (payment_intent.succeeded).
 *
 * Env vars (set in Render — all optional, add-on purchase fails gracefully):
 *   STRIPE_PRICE_ADDON_LIFE_SEASON
 *   STRIPE_PRICE_ADDON_RECURRING
 *   STRIPE_PRICE_ADDON_COUPLES
 *   STRIPE_PRICE_ADDON_THERAPIST_PDF
 *   STRIPE_PRICE_ADDON_AD_REMOVAL
 */

import { Router } from 'express';
import Stripe from 'stripe';
import { getDB } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { addonPurchaseSchema } from '../validation/schemas.js';

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const ADDON_CATALOG = {
  life_season:   { label: 'Life Season',     amountCents: 499,  envKey: 'STRIPE_PRICE_ADDON_LIFE_SEASON',   type: 'one_time' },
  recurring:     { label: 'Recurring Dreams', amountCents: 299,  envKey: 'STRIPE_PRICE_ADDON_RECURRING',     type: 'one_time' },
  couples:       { label: 'Couples',          amountCents: 699,  envKey: 'STRIPE_PRICE_ADDON_COUPLES',       type: 'one_time' },
  therapist_pdf: { label: 'Therapist Export', amountCents: 999,  envKey: 'STRIPE_PRICE_ADDON_THERAPIST_PDF', type: 'one_time' },
  ad_removal:    { label: 'Ad Removal',       amountCents: 299,  envKey: 'STRIPE_PRICE_ADDON_AD_REMOVAL',    type: 'one_time' },
};

// ── GET /api/v1/addons ────────────────────────────────────────────────────────
router.get('/', authenticate, async (req, res) => {
  const db = getDB();
  try {
    const addons = await db.collection('user_addons').find({
      userId: req.user._id,
      active: true,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
    }, { projection: { addonKey: 1, purchasedAt: 1, expiresAt: 1 } }).toArray();

    return res.json({
      addons: addons.map((a) => ({
        key:         a.addonKey,
        label:       ADDON_CATALOG[a.addonKey]?.label ?? a.addonKey,
        purchasedAt: a.purchasedAt,
        expiresAt:   a.expiresAt ?? null,
      })),
    });
  } catch (err) {
    console.error('[addons/list]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/v1/addons/purchase ──────────────────────────────────────────────
router.post('/purchase', authenticate, async (req, res) => {
  const parsed = addonPurchaseSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0].message });
  }

  const { addonKey, paymentMethodId } = parsed.data;
  const addon = ADDON_CATALOG[addonKey];

  if (!addon) {
    return res.status(400).json({ error: 'Unknown add-on' });
  }

  const db = getDB();

  try {
    // Check if already owned
    const existing = await db.collection('user_addons').findOne({
      userId:   req.user._id,
      addonKey,
      active:   true,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
    });
    if (existing) {
      return res.status(409).json({ error: `You already own the ${addon.label} add-on` });
    }

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

    // Create PaymentIntent
    const pi = await stripe.paymentIntents.create({
      amount:   addon.amountCents,
      currency: 'usd',
      customer: customerId,
      payment_method: paymentMethodId,
      confirm: true,
      automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
      metadata: {
        type:     'addon',
        addonKey,
        userId:   req.user._id.toString(),
        email:    req.user.email,
      },
    });

    return res.json({
      paymentIntentId: pi.id,
      status:          pi.status,
      clientSecret:    pi.status === 'requires_action' ? pi.client_secret : null,
      addon: { key: addonKey, label: addon.label },
    });
  } catch (err) {
    if (err.type === 'StripeCardError') {
      return res.status(402).json({ error: err.message });
    }
    if (err.type?.startsWith('Stripe')) {
      console.error('[addons/purchase] Stripe error:', err.message);
      return res.status(502).json({ error: 'Payment provider error — please try again' });
    }
    console.error('[addons/purchase]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
