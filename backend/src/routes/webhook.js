/**
 * Stripe webhook handler
 *
 * Mounted at POST /api/stripe/webhook
 * Receives raw body (Buffer) — registered in index.js before express.json().
 *
 * Handled events:
 *   invoice.payment_succeeded     → reset monthlyDeepUsed, extend period
 *   customer.subscription.updated → sync plan, limits, status, period
 *   customer.subscription.deleted → mark canceled
 *   invoice.payment_failed        → mark past_due
 */

import { Router } from 'express';
import Stripe from 'stripe';
import { getDB } from '../db.js';

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const PLAN_LIMITS = {
  basic: 20,
  pro:  100,
};

function planFromPriceId(priceId) {
  if (priceId === process.env.STRIPE_PRICE_BASIC) return 'basic';
  if (priceId === process.env.STRIPE_PRICE_PRO)   return 'pro';
  return null;
}

router.post('/', async (req, res) => {
  const sig = req.headers['stripe-signature'];

  if (!sig) {
    return res.status(400).json({ error: 'Missing stripe-signature header' });
  }

  let event;
  try {
    // req.body is a Buffer here (express.raw applied in index.js)
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    console.error('[webhook] Signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook signature invalid: ${err.message}` });
  }

  const db = getDB();

  try {
    switch (event.type) {
      // ── Successful payment: new billing cycle has started ──────────────────
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        if (!invoice.subscription) break;

        // Retrieve fresh subscription data from Stripe
        const stripeSub = await stripe.subscriptions.retrieve(invoice.subscription);
        const priceId   = stripeSub.items.data[0]?.price?.id;
        const plan      = planFromPriceId(priceId);

        const $set = {
          status: 'active',
          monthlyDeepUsed: 0, // ← reset counter on every successful renewal
          currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
          cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
          updatedAt: new Date(),
        };
        if (plan) {
          $set.plan = plan;
          $set.monthlyDeepLimit = PLAN_LIMITS[plan];
        }

        await db
          .collection('subscriptions')
          .updateOne({ stripeSubId: invoice.subscription }, { $set });

        break;
      }

      // ── Subscription updated (plan change, period renewal, etc.) ──────────
      case 'customer.subscription.updated': {
        const stripeSub = event.data.object;
        const priceId   = stripeSub.items.data[0]?.price?.id;
        const plan      = planFromPriceId(priceId);

        const $set = {
          status: stripeSub.status,
          currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
          cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
          updatedAt: new Date(),
        };
        if (plan) {
          $set.plan = plan;
          $set.monthlyDeepLimit = PLAN_LIMITS[plan];
        }

        await db
          .collection('subscriptions')
          .updateOne({ stripeSubId: stripeSub.id }, { $set });

        break;
      }

      // ── Subscription fully canceled (period ended or immediate cancel) ─────
      case 'customer.subscription.deleted': {
        const stripeSub = event.data.object;

        await db.collection('subscriptions').updateOne(
          { stripeSubId: stripeSub.id },
          { $set: { status: 'canceled', cancelAtPeriodEnd: false, updatedAt: new Date() } },
        );

        break;
      }

      // ── Payment failed → subscription becomes past_due ────────────────────
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        if (!invoice.subscription) break;

        await db.collection('subscriptions').updateOne(
          { stripeSubId: invoice.subscription },
          { $set: { status: 'past_due', updatedAt: new Date() } },
        );

        break;
      }

      default:
        // Unhandled event — acknowledge to prevent Stripe retries
        break;
    }

    return res.json({ received: true });
  } catch (err) {
    console.error('[webhook] Handler error:', err);
    // Return 500 so Stripe will retry delivery
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
});

export default router;
