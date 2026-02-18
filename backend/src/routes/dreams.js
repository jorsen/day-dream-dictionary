/**
 * Dream routes
 *
 * POST   /api/dreams/interpret  — submit dream, enforce quota, call Claude
 * GET    /api/dreams             — last 20 dreams for the current user
 * GET    /api/dreams/:id         — single dream (owned by current user)
 * DELETE /api/dreams/:id         — delete a dream (owned by current user)
 *
 * Quota rules:
 *   • Free user       → 3 deep interpretations per calendar month
 *   • Basic/Pro user  → monthlyDeepLimit per billing cycle (reset by webhook)
 *
 * The quota claim is fully atomic via a MongoDB aggregation-pipeline update so
 * that concurrent requests cannot exceed the limit (no transactions needed).
 */

import { Router } from 'express';
import { getDB, ObjectId } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { dreamTextSchema } from '../validation/schemas.js';
import { interpretDream } from '../services/claude.js';
import { cacheKey, getFromCache, setInCache } from '../services/cache.js';

const router = Router();
const FREE_MONTHLY_QUOTA = 3;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Current calendar month boundary (midnight UTC, 1st of month). */
function currentMonthStart() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

/**
 * Atomically claim one quota slot for the given user.
 *
 * For subscribed users  → increments subscriptions.monthlyDeepUsed.
 * For free users        → increments users.freeUsedThisMonth (with auto-reset
 *                         when a new calendar month is detected).
 *
 * Uses MongoDB aggregation-pipeline updates (4.2+) for race-condition safety.
 *
 * @returns {{ plan: string, type: 'deep'|'free' }}
 * @throws  {{ status: number, message: string, upgradeRequired: boolean }}
 */
async function claimQuota(db, userId) {
  // ── 1. Check for an active subscription first ──
  const sub = await db.collection('subscriptions').findOne({
    userId,
    status: 'active',
    currentPeriodEnd: { $gt: new Date() },
  });

  if (sub) {
    // Atomic: only succeeds if monthlyDeepUsed < monthlyDeepLimit
    const updated = await db.collection('subscriptions').findOneAndUpdate(
      {
        _id: sub._id,
        status: 'active',
        $expr: { $lt: ['$monthlyDeepUsed', '$monthlyDeepLimit'] },
      },
      { $inc: { monthlyDeepUsed: 1 } },
      { returnDocument: 'after' },
    );

    if (!updated) {
      const err = new Error(
        `Monthly limit of ${sub.monthlyDeepLimit} interpretations reached. ` +
          'Upgrade your plan or wait for your next billing cycle.',
      );
      err.status = 402;
      err.upgradeRequired = true;
      throw err;
    }

    return {
      plan: sub.plan,
      type: 'deep',
      used: updated.monthlyDeepUsed,
      limit: updated.monthlyDeepLimit,
    };
  }

  // ── 2. Free user — atomic claim with calendar-month reset ──
  const monthStart = currentMonthStart();

  /**
   * Aggregation-pipeline update logic:
   *
   * FILTER: effective used count (0 if new month, else freeUsedThisMonth) < FREE_MONTHLY_QUOTA
   * UPDATE: if freeMonthStart < monthStart → reset to 0 and increment to 1
   *         else                           → just increment by 1
   *
   * Because the filter and update happen in a single atomic write, there is no
   * window for a race condition between the reset and the increment.
   */
  const updated = await db.collection('users').findOneAndUpdate(
    {
      _id: userId,
      $expr: {
        $lt: [
          // Effective used count this month
          {
            $cond: [
              { $lt: [{ $ifNull: ['$freeMonthStart', new Date(0)] }, monthStart] },
              0,
              { $ifNull: ['$freeUsedThisMonth', 0] },
            ],
          },
          FREE_MONTHLY_QUOTA,
        ],
      },
    },
    // Aggregation pipeline update (MongoDB 4.2+)
    [
      {
        $set: {
          freeMonthStart: {
            $cond: [
              { $lt: [{ $ifNull: ['$freeMonthStart', new Date(0)] }, monthStart] },
              monthStart,
              '$freeMonthStart',
            ],
          },
          freeUsedThisMonth: {
            $add: [
              {
                $cond: [
                  { $lt: [{ $ifNull: ['$freeMonthStart', new Date(0)] }, monthStart] },
                  0,
                  { $ifNull: ['$freeUsedThisMonth', 0] },
                ],
              },
              1,
            ],
          },
        },
      },
    ],
    { returnDocument: 'after' },
  );

  if (!updated) {
    const err = new Error(
      `Free quota of ${FREE_MONTHLY_QUOTA} interpretations per month reached. ` +
        'Subscribe to continue.',
    );
    err.status = 402;
    err.upgradeRequired = true;
    throw err;
  }

  return {
    plan: 'free',
    type: 'free',
    used: updated.freeUsedThisMonth,
    limit: FREE_MONTHLY_QUOTA,
  };
}

/**
 * Roll back a quota increment if the AI call subsequently fails.
 * Best-effort — logs but does not throw.
 */
async function rollbackQuota(db, userId, quotaInfo) {
  try {
    if (quotaInfo.plan === 'free') {
      await db.collection('users').updateOne(
        { _id: userId, freeUsedThisMonth: { $gt: 0 } },
        { $inc: { freeUsedThisMonth: -1 } },
      );
    } else {
      await db.collection('subscriptions').updateOne(
        { userId, monthlyDeepUsed: { $gt: 0 } },
        { $inc: { monthlyDeepUsed: -1 } },
      );
    }
  } catch (err) {
    console.error('[dreams] quota rollback failed:', err.message);
  }
}

// ── POST /api/dreams/interpret ────────────────────────────────────────────────
router.post('/interpret', authenticate, async (req, res) => {
  const parsed = dreamTextSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0].message });
  }

  const { dreamText } = parsed.data;
  const db = getDB();

  // 1. Claim quota slot (atomic)
  let quotaInfo;
  try {
    quotaInfo = await claimQuota(db, req.user._id);
  } catch (err) {
    return res.status(err.status || 500).json({
      error: err.message,
      upgradeRequired: err.upgradeRequired ?? false,
    });
  }

  // 2. Check interpretation cache
  const key = cacheKey(dreamText);
  let interpretation = getFromCache(key);
  let fromCache = interpretation !== null;

  // 3. Call Claude if not cached
  if (!fromCache) {
    try {
      interpretation = await interpretDream(dreamText);
      setInCache(key, interpretation);
    } catch (err) {
      // Roll back quota so the user doesn't lose a slot on an AI error
      await rollbackQuota(db, req.user._id, quotaInfo);
      console.error('[dreams/interpret] Claude error:', err.message);
      return res.status(502).json({
        error: 'Dream interpretation service is temporarily unavailable. Please try again.',
      });
    }
  }

  // 4. Persist dream record
  const dream = {
    userId: req.user._id,
    dreamText,
    interpretation,
    type: quotaInfo.type,
    fromCache,
    createdAt: new Date(),
  };

  let insertedId;
  try {
    const result = await db.collection('dreams').insertOne(dream);
    insertedId = result.insertedId;
  } catch (err) {
    console.error('[dreams/interpret] DB insert error:', err.message);
    // Return the interpretation anyway — don't punish the user for a write failure
    return res.status(201).json({ interpretation, dreamId: null, warning: 'Dream not saved' });
  }

  return res.status(201).json({
    dreamId: insertedId,
    interpretation,
    quotaUsage: {
      plan: quotaInfo.plan,
      used: quotaInfo.used,
      limit: quotaInfo.limit,
      remaining: Math.max(0, quotaInfo.limit - quotaInfo.used),
    },
  });
});

// ── GET /api/dreams ───────────────────────────────────────────────────────────
router.get('/', authenticate, async (req, res) => {
  const db = getDB();

  try {
    const dreams = await db
      .collection('dreams')
      .find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(20)
      .project({ dreamText: 1, interpretation: 1, type: 1, createdAt: 1 })
      .toArray();

    return res.json({ dreams });
  } catch (err) {
    console.error('[dreams/list]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/dreams/:id ───────────────────────────────────────────────────────
router.get('/:id', authenticate, async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ error: 'Invalid dream ID' });
  }

  const db = getDB();

  try {
    const dream = await db.collection('dreams').findOne({
      _id: new ObjectId(req.params.id),
      userId: req.user._id, // ownership check
    });

    if (!dream) return res.status(404).json({ error: 'Dream not found' });

    return res.json({ dream });
  } catch (err) {
    console.error('[dreams/get]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── DELETE /api/dreams/:id ────────────────────────────────────────────────────
router.delete('/:id', authenticate, async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ error: 'Invalid dream ID' });
  }

  const db = getDB();

  try {
    const result = await db.collection('dreams').deleteOne({
      _id: new ObjectId(req.params.id),
      userId: req.user._id, // ownership check
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Dream not found' });
    }

    return res.json({ message: 'Dream deleted' });
  } catch (err) {
    console.error('[dreams/delete]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
