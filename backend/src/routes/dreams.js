/**
 * Dream routes
 *
 * POST   /api/dreams/interpret  — submit dream, enforce quota, call Claude
 * GET    /api/dreams             — paginated dream history for the current user
 * GET    /api/dreams/stats       — usage stats
 * GET    /api/dreams/:id         — single dream (owned by current user)
 * DELETE /api/dreams             — bulk delete (body: { ids: [...] })
 * DELETE /api/dreams/:id         — delete a single dream
 *
 * Quota priority order:
 *   1. Active subscription (monthlyDeepLimit)
 *   2. Credit balance >= 3 (deduct 3 credits atomically)
 *   3. Free monthly quota (3/month, resets on calendar month)
 *   4. → 402 with upgradeRequired flag
 *
 * History visibility:
 *   Free users → last 10 dreams
 *   Basic/Pro  → full paginated history
 */

import { Router } from 'express';
import { getDB, ObjectId } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { dreamTextSchema } from '../validation/schemas.js';
import { interpretDream } from '../services/claude.js';
import { cacheKey, getFromCache, setInCache } from '../services/cache.js';
import { sendDreamResult } from '../services/email.js';

const router = Router();
const FREE_MONTHLY_QUOTA = 3;
const CREDITS_PER_INTERPRETATION = 3;

// ── Helpers ───────────────────────────────────────────────────────────────────

function currentMonthStart() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

/**
 * Atomically claim one quota slot for the given user.
 * Priority: subscription → credits → free quota
 */
async function claimQuota(db, userId) {
  // ── 1. Active subscription ──
  const sub = await db.collection('subscriptions').findOne({
    userId,
    status: 'active',
    currentPeriodEnd: { $gt: new Date() },
  });

  if (sub) {
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

  // ── 2. Credit balance ──
  const creditResult = await db.collection('users').findOneAndUpdate(
    { _id: userId, creditBalance: { $gte: CREDITS_PER_INTERPRETATION } },
    {
      $inc: {
        creditBalance:     -CREDITS_PER_INTERPRETATION,
        totalCreditsSpent:  CREDITS_PER_INTERPRETATION,
      },
    },
    { returnDocument: 'after' },
  );

  if (creditResult) {
    // Audit log (best-effort)
    db.collection('creditTransactions').insertOne({
      userId,
      delta:     -CREDITS_PER_INTERPRETATION,
      reason:    'interpretation',
      createdAt: new Date(),
    }).catch((e) => console.error('[credits] log error:', e.message));

    return {
      plan:      'credits',
      type:      'credits',
      used:      CREDITS_PER_INTERPRETATION,
      limit:     creditResult.creditBalance + CREDITS_PER_INTERPRETATION,
      remaining: creditResult.creditBalance,
    };
  }

  // ── 3. Free monthly quota ──
  const monthStart = currentMonthStart();

  const updated = await db.collection('users').findOneAndUpdate(
    {
      _id: userId,
      $expr: {
        $lt: [
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
      `Free quota of ${FREE_MONTHLY_QUOTA} interpretations/month reached. ` +
        'Subscribe or purchase credits to continue.',
    );
    err.status = 402;
    err.upgradeRequired = true;
    throw err;
  }

  return {
    plan:  'free',
    type:  'free',
    used:  updated.freeUsedThisMonth,
    limit: FREE_MONTHLY_QUOTA,
  };
}

/** Roll back a quota increment if the AI call subsequently fails. */
async function rollbackQuota(db, userId, quotaInfo) {
  try {
    if (quotaInfo.type === 'credits') {
      await db.collection('users').updateOne(
        { _id: userId },
        { $inc: { creditBalance: CREDITS_PER_INTERPRETATION, totalCreditsSpent: -CREDITS_PER_INTERPRETATION } },
      );
    } else if (quotaInfo.plan === 'free') {
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

  const { dreamText, language, lifeSeason, enableRecurringAnalysis, partnerDreamText } = parsed.data;
  const db = getDB();

  // 1. Claim quota
  let quotaInfo;
  try {
    quotaInfo = await claimQuota(db, req.user._id);
  } catch (err) {
    return res.status(err.status || 500).json({
      error: err.message,
      upgradeRequired: err.upgradeRequired ?? false,
    });
  }

  // 2. Build add-on config (only for features the user has unlocked)
  const addonConfig = {};

  const userAddons = await db.collection('user_addons').find({
    userId: req.user._id,
    active: true,
    $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
  }).toArray();
  const activeAddonKeys = new Set(userAddons.map((a) => a.addonKey));

  if (lifeSeason && activeAddonKeys.has('life_season')) {
    addonConfig.lifeSeason = lifeSeason;
  }

  if (enableRecurringAnalysis && activeAddonKeys.has('recurring')) {
    const recentDreams = await db.collection('dreams')
      .find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(10)
      .project({ 'interpretation.mainThemes': 1 })
      .toArray();

    const themeCounts = {};
    recentDreams.forEach((d) => {
      (d.interpretation?.mainThemes || []).forEach((t) => {
        themeCounts[t] = (themeCounts[t] || 0) + 1;
      });
    });
    const recurring = Object.entries(themeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([t]) => t);
    if (recurring.length > 0) addonConfig.recurringThemes = recurring;
  }

  if (partnerDreamText && activeAddonKeys.has('couples')) {
    addonConfig.partnerDreamText = partnerDreamText;
  }

  if (activeAddonKeys.has('therapist_pdf')) {
    addonConfig.therapistMode = true;
  }

  // 3. Check cache (language+addons-aware key)
  const key = cacheKey(dreamText + language + JSON.stringify(addonConfig));
  let interpretation = getFromCache(key);
  const fromCache = interpretation !== null;

  // 4. Call Claude if not cached
  if (!fromCache) {
    try {
      interpretation = await interpretDream(dreamText, language, addonConfig);
      setInCache(key, interpretation);
    } catch (err) {
      await rollbackQuota(db, req.user._id, quotaInfo);
      console.error('[dreams/interpret] Claude error:', err.message);
      return res.status(502).json({
        error: 'Dream interpretation service is temporarily unavailable. Please try again.',
      });
    }
  }

  // 5. Persist dream record
  const dream = {
    userId: req.user._id,
    dreamText,
    interpretation,
    language,
    type:      quotaInfo.type,
    fromCache,
    createdAt: new Date(),
  };

  let insertedId;
  try {
    const result = await db.collection('dreams').insertOne(dream);
    insertedId = result.insertedId;
  } catch (err) {
    console.error('[dreams/interpret] DB insert error:', err.message);
    return res.status(201).json({ interpretation, dreamId: null, warning: 'Dream not saved' });
  }

  // 6. Optional: email dream result (non-blocking)
  const user = await db.collection('users').findOne(
    { _id: req.user._id },
    { projection: { emailResultsOptIn: 1 } },
  );
  if (user?.emailResultsOptIn) {
    console.log('[email] sending dream result to:', req.user.email);
    sendDreamResult({ to: req.user.email, dreamText, interpretation })
      .catch((e) => console.error('[email] dream result send failed:', e.message));
  }

  return res.status(201).json({
    dreamId: insertedId,
    interpretation,
    quotaUsage: {
      plan:      quotaInfo.plan,
      used:      quotaInfo.used,
      limit:     quotaInfo.limit,
      remaining: Math.max(0, (quotaInfo.limit ?? 0) - (quotaInfo.used ?? 0)),
    },
  });
});

// ── GET /api/dreams/stats ─────────────────────────────────────────────────────
router.get('/stats', authenticate, async (req, res) => {
  const db = getDB();
  try {
    const monthStart = currentMonthStart();

    const [totalDreams, thisMonth, sub, user] = await Promise.all([
      db.collection('dreams').countDocuments({ userId: req.user._id }),
      db.collection('dreams').countDocuments({ userId: req.user._id, createdAt: { $gte: monthStart } }),
      db.collection('subscriptions').findOne({
        userId: req.user._id,
        status: 'active',
        currentPeriodEnd: { $gt: new Date() },
      }),
      db.collection('users').findOne(
        { _id: req.user._id },
        { projection: { freeUsedThisMonth: 1, creditBalance: 1 } },
      ),
    ]);

    let creditsUsed, creditsRemaining, monthlyUsage, monthlyRemaining;

    if (sub) {
      const used      = sub.monthlyDeepUsed  ?? 0;
      const limit     = sub.monthlyDeepLimit ?? (sub.plan === 'pro' ? 100 : 20);
      const remaining = Math.max(0, limit - used);
      creditsUsed      = used;
      creditsRemaining = `${remaining} deep`;
      monthlyUsage     = { deep: used };
      monthlyRemaining = { deep: remaining };
    } else {
      const used      = user?.freeUsedThisMonth ?? 0;
      const remaining = Math.max(0, FREE_MONTHLY_QUOTA - used);
      creditsUsed      = used;
      creditsRemaining = `${remaining} free`;
      monthlyUsage     = { deep: used };
      monthlyRemaining = { deep: remaining };
    }

    return res.json({
      stats: {
        totalDreams,
        total_dreams:          totalDreams,
        totalInterpretations:  totalDreams,
        total_interpretations: totalDreams,
        thisMonth,
        this_month:    thisMonth,
        creditsUsed,
        credits_used:  creditsUsed,
        creditsRemaining,
        creditBalance: user?.creditBalance ?? 0,
        monthlyUsage,
        monthlyRemaining,
      },
    });
  } catch (err) {
    console.error('[dreams/stats]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/dreams ───────────────────────────────────────────────────────────
router.get('/', authenticate, async (req, res) => {
  const db = getDB();

  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);

    // Free users: last 10 dreams only; paid: full history
    const sub = await db.collection('subscriptions').findOne({
      userId: req.user._id,
      status: 'active',
      currentPeriodEnd: { $gt: new Date() },
    });
    const isPaid    = !!sub;
    const hardLimit = isPaid ? limit : Math.min(limit, 10);
    const maxSkip   = isPaid ? Infinity : 10;

    const skip = (page - 1) * hardLimit;
    if (skip >= maxSkip && !isPaid) {
      return res.json({ dreams: [], pagination: { page, limit: hardLimit, total: 10, totalPages: 1 } });
    }

    const filter = { userId: req.user._id };
    const [dreams, total] = await Promise.all([
      db.collection('dreams')
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(hardLimit)
        .project({ dreamText: 1, interpretation: 1, type: 1, language: 1, createdAt: 1 })
        .toArray(),
      isPaid
        ? db.collection('dreams').countDocuments(filter)
        : Promise.resolve(10), // free capped at 10
    ]);

    return res.json({
      dreams,
      pagination: {
        page,
        limit:      hardLimit,
        total,
        totalPages: Math.ceil(total / hardLimit),
      },
    });
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
      _id:    new ObjectId(req.params.id),
      userId: req.user._id,
    });
    if (!dream) return res.status(404).json({ error: 'Dream not found' });
    return res.json({ dream });
  } catch (err) {
    console.error('[dreams/get]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── DELETE /api/dreams (bulk) ─────────────────────────────────────────────────
router.delete('/', authenticate, async (req, res) => {
  const { ids } = req.body || {};
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids array is required' });
  }
  if (ids.length > 100) {
    return res.status(400).json({ error: 'Maximum 100 items per bulk delete' });
  }

  const validIds = ids.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));
  if (validIds.length === 0) {
    return res.status(400).json({ error: 'No valid IDs provided' });
  }

  const db = getDB();
  try {
    const result = await db.collection('dreams').deleteMany({
      _id:    { $in: validIds },
      userId: req.user._id, // ownership check
    });
    return res.json({ deleted: result.deletedCount });
  } catch (err) {
    console.error('[dreams/bulk-delete]', err);
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
      _id:    new ObjectId(req.params.id),
      userId: req.user._id,
    });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Dream not found' });
    return res.json({ message: 'Dream deleted' });
  } catch (err) {
    console.error('[dreams/delete]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
