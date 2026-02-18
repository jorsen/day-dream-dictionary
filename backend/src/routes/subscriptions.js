/**
 * Subscription routes
 *
 * POST /api/subscriptions/create  — create a Stripe subscription
 * POST /api/subscriptions/cancel  — cancel at period end
 * GET  /api/subscriptions/status  — current subscription state for the user
 */

import { Router } from 'express';
import Stripe from 'stripe';
import { getDB } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { createSubscriptionSchema } from '../validation/schemas.js';

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Per-plan monthly deep-interpretation limits
const PLAN_LIMITS = {
  basic: 20,
  pro:  100,
};

function priceIdForPlan(plan) {
  return plan === 'basic'
    ? process.env.STRIPE_PRICE_BASIC
    : process.env.STRIPE_PRICE_PRO;
}

// ── POST /api/subscriptions/create ───────────────────────────────────────────
router.post('/create', authenticate, async (req, res) => {
  const parsed = createSubscriptionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0].message });
  }

  const { plan, paymentMethodId } = parsed.data;
  const priceId = priceIdForPlan(plan);

  if (!priceId) {
    return res.status(500).json({ error: `Stripe price not configured for plan: ${plan}` });
  }

  const db = getDB();

  try {
    // Reject if there is already an active/past-due subscription
    const existing = await db.collection('subscriptions').findOne({
      userId: req.user._id,
      status: { $in: ['active', 'past_due'] },
    });
    if (existing) {
      return res.status(409).json({ error: 'You already have an active subscription' });
    }

    // Reuse an existing Stripe customer ID if we created one previously
    const anySub = await db.collection('subscriptions').findOne({ userId: req.user._id });
    let customerId = anySub?.stripeCustomerId ?? null;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: req.user.email,
        name: req.user.displayName,
        metadata: { userId: req.user._id.toString() },
      });
      customerId = customer.id;
    }

    // Attach payment method and set as default
    await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });

    // Create the subscription
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      payment_settings: {
        payment_method_types: ['card'],
        save_default_payment_method: 'on_subscription',
      },
      expand: ['latest_invoice.payment_intent'],
    });

    const now = new Date();

    await db.collection('subscriptions').updateOne(
      { userId: req.user._id },
      {
        $set: {
          userId: req.user._id,
          stripeCustomerId: customerId,
          stripeSubId: subscription.id,
          plan,
          status: subscription.status,
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          monthlyFreeLimit: 3,
          monthlyDeepLimit: PLAN_LIMITS[plan],
          monthlyDeepUsed: 0,
          cancelAtPeriodEnd: false,
          updatedAt: now,
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    );

    return res.status(201).json({
      subscriptionId: subscription.id,
      status: subscription.status,
      plan,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      // Client secret needed if payment requires 3-D Secure confirmation
      clientSecret: subscription.latest_invoice?.payment_intent?.client_secret ?? null,
    });
  } catch (err) {
    if (err.type === 'StripeCardError') {
      return res.status(402).json({ error: err.message });
    }
    if (err.type?.startsWith('Stripe')) {
      console.error('[subscriptions/create] Stripe error:', err.message);
      return res.status(502).json({ error: 'Payment provider error — please try again' });
    }
    console.error('[subscriptions/create]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/subscriptions/cancel ───────────────────────────────────────────
router.post('/cancel', authenticate, async (req, res) => {
  const db = getDB();

  try {
    const sub = await db.collection('subscriptions').findOne({
      userId: req.user._id,
      status: { $in: ['active', 'past_due'] },
    });

    if (!sub) {
      return res.status(404).json({ error: 'No active subscription found' });
    }

    if (sub.cancelAtPeriodEnd) {
      return res.status(409).json({
        error: 'Subscription is already scheduled to cancel',
        currentPeriodEnd: sub.currentPeriodEnd,
      });
    }

    // Cancel gracefully at the end of the current billing period
    await stripe.subscriptions.update(sub.stripeSubId, { cancel_at_period_end: true });

    await db.collection('subscriptions').updateOne(
      { _id: sub._id },
      { $set: { cancelAtPeriodEnd: true, updatedAt: new Date() } },
    );

    return res.json({
      message: 'Subscription will cancel at the end of the current billing period',
      currentPeriodEnd: sub.currentPeriodEnd,
    });
  } catch (err) {
    if (err.type?.startsWith('Stripe')) {
      console.error('[subscriptions/cancel] Stripe error:', err.message);
      return res.status(502).json({ error: 'Payment provider error — please try again' });
    }
    console.error('[subscriptions/cancel]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/subscriptions/status ─────────────────────────────────────────────
router.get('/status', authenticate, async (req, res) => {
  const db = getDB();

  try {
    const sub = await db.collection('subscriptions').findOne(
      { userId: req.user._id },
      {
        projection: {
          stripeCustomerId: 0,
          stripeSubId: 0,
          _id: 0,
          userId: 0,
        },
      },
    );

    if (!sub) {
      // Return synthetic free-tier state
      const user = await db.collection('users').findOne(
        { _id: req.user._id },
        { projection: { freeUsedThisMonth: 1, freeMonthStart: 1 } },
      );
      return res.json({
        plan: 'free',
        status: 'none',
        monthlyFreeLimit: FREE_MONTHLY_QUOTA,
        freeUsedThisMonth: user?.freeUsedThisMonth ?? 0,
        freeMonthStart: user?.freeMonthStart ?? null,
      });
    }

    return res.json(sub);
  } catch (err) {
    console.error('[subscriptions/status]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/subscriptions/details ────────────────────────────────────────────
// Returns subscription info + payment method card details from Stripe.
router.get('/details', authenticate, async (req, res) => {
  const db = getDB();

  try {
    const sub = await db.collection('subscriptions').findOne({ userId: req.user._id });

    if (!sub) {
      return res.json({ subscription: null, paymentMethod: null });
    }

    let paymentMethod = null;
    if (sub.stripeSubId) {
      try {
        const stripeSub = await stripe.subscriptions.retrieve(sub.stripeSubId, {
          expand: ['default_payment_method'],
        });
        const pm = stripeSub.default_payment_method;
        if (pm?.card) {
          paymentMethod = {
            brand:    pm.card.brand,
            last4:    pm.card.last4,
            expMonth: pm.card.exp_month,
            expYear:  pm.card.exp_year,
          };
        }
      } catch (stripeErr) {
        console.warn('[subscriptions/details] Stripe fetch failed:', stripeErr.message);
      }
    }

    return res.json({
      subscription: {
        plan:             sub.plan,
        status:           sub.status,
        currentPeriodEnd: sub.currentPeriodEnd,
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd ?? false,
        monthlyDeepLimit: sub.monthlyDeepLimit,
        monthlyDeepUsed:  sub.monthlyDeepUsed ?? 0,
      },
      paymentMethod,
    });
  } catch (err) {
    console.error('[subscriptions/details]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

const FREE_MONTHLY_QUOTA = 3;

export default router;
