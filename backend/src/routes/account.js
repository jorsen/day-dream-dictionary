/**
 * Account management routes
 *
 * DELETE /api/account               — delete account + all data (GDPR)
 * PATCH  /api/account/preferences   — update language, email opt-ins
 * GET    /api/account/me            — current user profile + preferences
 */

import { Router } from 'express';
import Stripe from 'stripe';
import { getDB } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { preferencesSchema } from '../validation/schemas.js';

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ── GET /api/account/me ───────────────────────────────────────────────────────
router.get('/me', authenticate, async (req, res) => {
  const db = getDB();
  try {
    const user = await db.collection('users').findOne(
      { _id: req.user._id },
      { projection: { passwordHash: 0 } },
    );
    if (!user) return res.status(404).json({ error: 'User not found' });

    return res.json({
      user: {
        id:                  user._id,
        email:               user.email,
        displayName:         user.displayName,
        role:                user.role,
        preferredLanguage:   user.preferredLanguage   ?? 'en',
        emailResultsOptIn:   user.emailResultsOptIn   ?? false,
        creditBalance:       user.creditBalance        ?? 0,
      },
    });
  } catch (err) {
    console.error('[account/me]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PATCH /api/account/preferences ───────────────────────────────────────────
router.patch('/preferences', authenticate, async (req, res) => {
  const parsed = preferencesSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0].message });
  }

  const $set = { updatedAt: new Date() };
  if (parsed.data.language !== undefined)          $set.preferredLanguage = parsed.data.language;
  if (parsed.data.emailResultsOptIn !== undefined) $set.emailResultsOptIn = parsed.data.emailResultsOptIn;

  if (Object.keys($set).length === 1) {
    return res.status(400).json({ error: 'No valid preference fields provided' });
  }

  const db = getDB();
  try {
    await db.collection('users').updateOne({ _id: req.user._id }, { $set });
    return res.json({ message: 'Preferences updated' });
  } catch (err) {
    console.error('[account/preferences]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PATCH /api/account/profile ────────────────────────────────────────────────
router.patch('/profile', authenticate, async (req, res) => {
  const { displayName, email } = req.body;
  if (!displayName && !email) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  const db = getDB();
  const $set = { updatedAt: new Date() };
  if (displayName?.trim()) $set.displayName = displayName.trim();
  if (email?.trim())       $set.email       = email.trim().toLowerCase();

  try {
    await db.collection('users').updateOne({ _id: req.user._id }, { $set });
    const updated = await db.collection('users').findOne(
      { _id: req.user._id },
      { projection: { passwordHash: 0 } },
    );
    return res.json({ user: updated });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'That email is already in use' });
    }
    console.error('[account/profile]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── DELETE /api/account ───────────────────────────────────────────────────────
router.delete('/', authenticate, async (req, res) => {
  const db = getDB();
  const userId = req.user._id;

  try {
    // 1. Cancel active Stripe subscription
    const sub = await db.collection('subscriptions').findOne({
      userId,
      status: { $in: ['active', 'past_due'] },
    });

    if (sub?.stripeSubId) {
      try {
        await stripe.subscriptions.cancel(sub.stripeSubId);
      } catch (stripeErr) {
        console.error('[account/delete] Stripe cancel failed:', stripeErr.message);
      }
    }

    // 2. Delete all user data
    await Promise.all([
      db.collection('dreams').deleteMany({ userId }),
      db.collection('subscriptions').deleteOne({ userId }),
      db.collection('user_addons').deleteMany({ userId }),
      db.collection('creditTransactions').deleteMany({ userId }),
    ]);

    // 3. Delete user last
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
