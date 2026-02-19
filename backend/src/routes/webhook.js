/**
 * Stripe webhook handler
 *
 * Handled events:
 *   invoice.payment_succeeded       → reset monthlyDeepUsed, extend period + send receipt
 *   customer.subscription.updated   → sync plan, limits, status, period
 *   customer.subscription.deleted   → mark canceled
 *   invoice.payment_failed          → mark past_due
 *   payment_intent.succeeded        → grant credits OR activate add-on (idempotent)
 */

import { Router } from 'express';
import Stripe from 'stripe';
import { getDB, ObjectId } from '../db.js';
import {
  sendPurchaseReceipt,
  sendCreditReceipt,
  sendCancellationConfirmation,
} from '../services/email.js';

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const PLAN_LIMITS = { basic: 20, pro: 100 };

function planFromPriceId(priceId) {
  if (priceId === process.env.STRIPE_PRICE_BASIC) return 'basic';
  if (priceId === process.env.STRIPE_PRICE_PRO)   return 'pro';
  return null;
}

router.post('/', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  if (!sig) return res.status(400).json({ error: 'Missing stripe-signature header' });

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[webhook] Signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook signature invalid: ${err.message}` });
  }

  const db = getDB();

  try {
    switch (event.type) {

      // ── Successful subscription payment ────────────────────────────────────
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        if (!invoice.subscription) break;

        const stripeSub = await stripe.subscriptions.retrieve(invoice.subscription);
        const priceId   = stripeSub.items.data[0]?.price?.id;
        const plan      = planFromPriceId(priceId);

        const $set = {
          status:            'active',
          monthlyDeepUsed:   0,
          currentPeriodEnd:  new Date(stripeSub.current_period_end * 1000),
          cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
          updatedAt:         new Date(),
        };
        if (plan) {
          $set.plan             = plan;
          $set.monthlyDeepLimit = PLAN_LIMITS[plan];
        }

        await db.collection('subscriptions').updateOne(
          { stripeSubId: invoice.subscription }, { $set },
        );

        // Receipt email (best-effort)
        if (invoice.customer_email && plan) {
          const planLabels = { basic: 'Basic Plan — $4.99/mo', pro: 'Pro Plan — $12.99/mo' };
          const amount     = (invoice.amount_paid / 100).toFixed(2);
          const nextDate   = new Date(stripeSub.current_period_end * 1000)
            .toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
          sendPurchaseReceipt({
            to:             invoice.customer_email,
            planName:       planLabels[plan] ?? 'Plan',
            amount,
            nextBillingDate: nextDate,
          }).catch(() => {});
        }
        break;
      }

      // ── Subscription updated ───────────────────────────────────────────────
      case 'customer.subscription.updated': {
        const stripeSub = event.data.object;
        const priceId   = stripeSub.items.data[0]?.price?.id;
        const plan      = planFromPriceId(priceId);

        const $set = {
          status:            stripeSub.status,
          currentPeriodEnd:  new Date(stripeSub.current_period_end * 1000),
          cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
          updatedAt:         new Date(),
        };
        if (plan) {
          $set.plan             = plan;
          $set.monthlyDeepLimit = PLAN_LIMITS[plan];
        }

        await db.collection('subscriptions').updateOne(
          { stripeSubId: stripeSub.id }, { $set },
        );

        // Cancellation email when cancel_at_period_end flips to true
        if (stripeSub.cancel_at_period_end) {
          try {
            const customer = await stripe.customers.retrieve(stripeSub.customer);
            if (customer.email) {
              const until = new Date(stripeSub.current_period_end * 1000)
                .toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
              sendCancellationConfirmation({ to: customer.email, accessUntil: until }).catch(() => {});
            }
          } catch { /* ignore */ }
        }
        break;
      }

      // ── Subscription deleted (fully canceled) ──────────────────────────────
      case 'customer.subscription.deleted': {
        const stripeSub = event.data.object;
        await db.collection('subscriptions').updateOne(
          { stripeSubId: stripeSub.id },
          { $set: { status: 'canceled', cancelAtPeriodEnd: false, updatedAt: new Date() } },
        );
        break;
      }

      // ── Invoice payment failed → past_due ─────────────────────────────────
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        if (!invoice.subscription) break;
        await db.collection('subscriptions').updateOne(
          { stripeSubId: invoice.subscription },
          { $set: { status: 'past_due', updatedAt: new Date() } },
        );
        break;
      }

      // ── One-time payment: credit pack OR add-on ────────────────────────────
      case 'payment_intent.succeeded': {
        const pi  = event.data.object;
        const meta = pi.metadata ?? {};
        const { type, userId, pack, credits, addonKey, email } = meta;

        if (!type || !userId) break;

        const userOid = ObjectId.isValid(userId) ? new ObjectId(userId) : userId;

        // ── Idempotency guard ──────────────────────────────────────────────
        const alreadyDone = await db.collection('creditTransactions').findOne({
          stripePaymentIntentId: pi.id,
        });
        if (alreadyDone) break;

        if (type === 'credits' && credits) {
          const creditCount = parseInt(credits, 10);
          if (isNaN(creditCount) || creditCount <= 0) break;

          await db.collection('users').updateOne(
            { _id: userOid },
            { $inc: { creditBalance: creditCount, totalCreditsEarned: creditCount } },
          );

          await db.collection('creditTransactions').insertOne({
            userId:                userOid,
            delta:                 creditCount,
            reason:                'purchase',
            pack:                  pack ?? null,
            stripePaymentIntentId: pi.id,
            createdAt:             new Date(),
          });

          // Receipt email
          if (email) {
            const packAmounts = { '10': '9.99', '25': '19.99', '60': '39.99' };
            const user = await db.collection('users').findOne(
              { _id: userOid },
              { projection: { creditBalance: 1 } },
            );
            sendCreditReceipt({
              to:         email,
              credits:    creditCount,
              amount:     packAmounts[pack] ?? '?',
              newBalance: user?.creditBalance ?? creditCount,
            }).catch(() => {});
          }
        }

        if (type === 'addon' && addonKey) {
          await db.collection('user_addons').updateOne(
            { userId: userOid, addonKey },
            {
              $set: {
                userId:                userOid,
                addonKey,
                active:                true,
                stripePaymentIntentId: pi.id,
                expiresAt:             null,
                updatedAt:             new Date(),
              },
              $setOnInsert: { purchasedAt: new Date() },
            },
            { upsert: true },
          );

          // Audit log entry (used for idempotency check)
          await db.collection('creditTransactions').insertOne({
            userId:                userOid,
            delta:                 0,
            reason:                'addon_purchase',
            addonKey,
            stripePaymentIntentId: pi.id,
            createdAt:             new Date(),
          });
        }

        break;
      }

      default:
        break;
    }

    return res.json({ received: true });
  } catch (err) {
    console.error('[webhook] Handler error:', err);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
});

export default router;
