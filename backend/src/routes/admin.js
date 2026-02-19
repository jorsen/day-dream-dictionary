/**
 * Superadmin routes — all require role === 'superadmin'
 *
 * GET    /api/v1/admin/stats          — platform overview
 * GET    /api/v1/admin/users          — paginated user list
 * GET    /api/v1/admin/users/:id      — single user detail
 * PATCH  /api/v1/admin/users/:id/role — change role
 * DELETE /api/v1/admin/users/:id      — delete user + all data
 */

import { Router } from 'express';
import Stripe from 'stripe';
import { getDB, ObjectId } from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ── Middleware: superadmin only ───────────────────────────────────────────────
function requireSuperAdmin(req, res, next) {
  if (req.user?.role !== 'superadmin') {
    return res.status(403).json({ error: 'Superadmin access required' });
  }
  next();
}

const guard = [authenticate, requireSuperAdmin];

// ── GET /api/v1/admin/stats ───────────────────────────────────────────────────
router.get('/stats', ...guard, async (req, res) => {
  const db = getDB();
  try {
    const [totalUsers, totalDreams, activeSubs, freeUsers] = await Promise.all([
      db.collection('users').countDocuments(),
      db.collection('dreams').countDocuments(),
      db.collection('subscriptions').countDocuments({ status: 'active' }),
      db.collection('users').countDocuments({ role: 'user' }),
    ]);

    const recentUsers = await db.collection('users')
      .countDocuments({ createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } });

    const recentDreams = await db.collection('dreams')
      .countDocuments({ createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } });

    return res.json({
      stats: { totalUsers, totalDreams, activeSubs, freeUsers, recentUsers, recentDreams },
    });
  } catch (err) {
    console.error('[admin/stats]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/v1/admin/users ───────────────────────────────────────────────────
router.get('/users', ...guard, async (req, res) => {
  const db = getDB();
  try {
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(100, parseInt(req.query.limit) || 20);
    const search = req.query.search?.trim() || '';
    const skip   = (page - 1) * limit;

    const filter = search
      ? { email: { $regex: search, $options: 'i' } }
      : {};

    const [users, total] = await Promise.all([
      db.collection('users')
        .find(filter, { projection: { passwordHash: 0 } })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      db.collection('users').countDocuments(filter),
    ]);

    // Attach subscription + dream count per user
    const userIds = users.map((u) => u._id);
    const [subs, dreamCounts] = await Promise.all([
      db.collection('subscriptions').find({ userId: { $in: userIds } }).toArray(),
      db.collection('dreams').aggregate([
        { $match: { userId: { $in: userIds } } },
        { $group: { _id: '$userId', count: { $sum: 1 } } },
      ]).toArray(),
    ]);

    const subMap   = Object.fromEntries(subs.map((s) => [s.userId.toString(), s]));
    const dreamMap = Object.fromEntries(dreamCounts.map((d) => [d._id.toString(), d.count]));

    const enriched = users.map((u) => {
      const sub = subMap[u._id.toString()];
      return {
        id:            u._id,
        email:         u.email,
        displayName:   u.displayName,
        role:          u.role,
        creditBalance: u.creditBalance ?? 0,
        dreamCount:    dreamMap[u._id.toString()] ?? 0,
        plan:          sub?.status === 'active' ? sub.plan : 'free',
        subStatus:     sub?.status ?? 'none',
        createdAt:     u.createdAt,
      };
    });

    return res.json({
      users: enriched,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('[admin/users]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/v1/admin/users/:id ───────────────────────────────────────────────
router.get('/users/:id', ...guard, async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }
  const db  = getDB();
  const uid = new ObjectId(req.params.id);

  try {
    const [user, sub, dreams, addons, credits] = await Promise.all([
      db.collection('users').findOne({ _id: uid }, { projection: { passwordHash: 0 } }),
      db.collection('subscriptions').findOne({ userId: uid }),
      db.collection('dreams').find({ userId: uid }).sort({ createdAt: -1 }).limit(5)
        .project({ dreamText: 1, createdAt: 1, type: 1 }).toArray(),
      db.collection('user_addons').find({ userId: uid, active: true }).toArray(),
      db.collection('creditTransactions').find({ userId: uid }).sort({ createdAt: -1 }).limit(10).toArray(),
    ]);

    if (!user) return res.status(404).json({ error: 'User not found' });

    return res.json({ user, subscription: sub, recentDreams: dreams, addons, creditHistory: credits });
  } catch (err) {
    console.error('[admin/users/:id]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PATCH /api/v1/admin/users/:id/role ───────────────────────────────────────
router.patch('/users/:id/role', ...guard, async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }
  const { role } = req.body;
  if (!['user', 'admin', 'superadmin'].includes(role)) {
    return res.status(400).json({ error: 'role must be user, admin, or superadmin' });
  }

  const db = getDB();
  try {
    await db.collection('users').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { role, updatedAt: new Date() } },
    );
    return res.json({ message: 'Role updated' });
  } catch (err) {
    console.error('[admin/users/:id/role]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── DELETE /api/v1/admin/users/:id ───────────────────────────────────────────
router.delete('/users/:id', ...guard, async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  // Prevent self-deletion
  if (req.params.id === req.user._id.toString()) {
    return res.status(400).json({ error: 'Cannot delete your own account from admin panel' });
  }

  const db  = getDB();
  const uid = new ObjectId(req.params.id);

  try {
    const sub = await db.collection('subscriptions').findOne({
      userId: uid,
      status: { $in: ['active', 'past_due'] },
    });
    if (sub?.stripeSubId) {
      try {
        await stripe.subscriptions.cancel(sub.stripeSubId);
      } catch (e) {
        console.error('[admin/delete] Stripe cancel:', e.message);
      }
    }

    await Promise.all([
      db.collection('dreams').deleteMany({ userId: uid }),
      db.collection('subscriptions').deleteOne({ userId: uid }),
      db.collection('user_addons').deleteMany({ userId: uid }),
      db.collection('creditTransactions').deleteMany({ userId: uid }),
    ]);
    await db.collection('users').deleteOne({ _id: uid });

    return res.json({ message: 'User deleted' });
  } catch (err) {
    console.error('[admin/users/:id delete]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
