/**
 * Account management routes
 *
 * DELETE /api/account  — delete current user + all dreams + cancel Stripe sub
 *
 * Satisfies GDPR "right to erasure" / "delete my data" requirement from PRD §11.
 */

import { Router } from 'express';
import Stripe from 'stripe';
import { getDB } from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ── DELETE /api/account ───────────────────────────────────────────────────────
router.delete('/', authenticate, async (req, res) => {
  const db = getDB();
  const userId = req.user._id;

  try {
    // 1. Cancel active Stripe subscription (best-effort — don't block deletion on failure)
    const sub = await db.collection('subscriptions').findOne({
      userId,
      status: { $in: ['active', 'past_due'] },
    });

    if (sub?.stripeSubId) {
      try {
        // Immediate cancellation — user is deleting their account
        await stripe.subscriptions.cancel(sub.stripeSubId);
      } catch (stripeErr) {
        // Log but continue — we still delete the local data
        console.error('[account/delete] Stripe cancel failed:', stripeErr.message);
      }
    }

    // 2. Delete all dreams
    await db.collection('dreams').deleteMany({ userId });

    // 3. Delete subscription record
    await db.collection('subscriptions').deleteOne({ userId });

    // 4. Delete user (last — so other steps can find related data)
    await db.collection('users').deleteOne({ _id: userId });

    return res.json({
      message: 'Your account and all associated data have been permanently deleted.',
    });
  } catch (err) {
    console.error('[account/delete]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
