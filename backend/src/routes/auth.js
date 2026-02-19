/**
 * Authentication routes
 *
 * POST /api/v1/auth/signup  — register new user
 * POST /api/v1/auth/login   — authenticate and receive JWT
 * GET  /api/v1/auth/me      — return current user (requires auth)
 */

import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { getDB, ObjectId } from '../db.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { authenticate } from '../middleware/auth.js';
import { signupSchema, loginSchema } from '../validation/schemas.js';

const router = Router();

// 5 requests per minute on auth endpoints
const authLimiter = rateLimit({ windowMs: 60_000, max: 5 });

const BCRYPT_ROUNDS = 12;
const JWT_EXPIRY = '7d';

function signToken(userId) {
  return jwt.sign({ sub: userId.toString() }, process.env.JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

function safeUser(user) {
  const { passwordHash: _, ...rest } = user;
  return rest;
}

// ── POST /api/auth/signup ─────────────────────────────────────────────────────
router.post('/signup', authLimiter, async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0].message });
  }

  const { email, password, displayName } = parsed.data;
  const db = getDB();

  try {
    // Check for existing account without leaking timing info
    const existing = await db.collection('users').findOne({ email });
    if (existing) {
      // Constant-time response: don't short-circuit before hashing
      await bcrypt.hash(password, BCRYPT_ROUNDS);
      return res.status(409).json({ error: 'An account with that email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const result = await db.collection('users').insertOne({
      email,
      passwordHash,
      displayName: displayName || email.split('@')[0],
      role: 'user',
      // Free-tier monthly quota tracking
      freeUsedThisMonth: 0,
      freeMonthStart: monthStart,
      createdAt: now,
    });

    const token = signToken(result.insertedId);

    return res.status(201).json({
      accessToken: token,
      token,
      user: {
        id: result.insertedId,
        email,
        displayName: displayName || email.split('@')[0],
        role: 'user',
      },
    });
  } catch (err) {
    // MongoDB duplicate-key race condition fallback
    if (err.code === 11000) {
      return res.status(409).json({ error: 'An account with that email already exists' });
    }
    console.error('[auth/signup]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login', authLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0].message });
  }

  const { email, password } = parsed.data;
  const db = getDB();

  try {
    const user = await db.collection('users').findOne({ email });

    // Always run bcrypt.compare to prevent timing attacks
    const hashToCompare = user?.passwordHash || '$2b$12$invalidhashpadding000000000000000000000000000000000000000';
    const valid = await bcrypt.compare(password, hashToCompare);

    if (!user || !valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = signToken(user._id);

    return res.json({
      accessToken: token,
      token,
      user: {
        id: user._id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('[auth/login]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/auth/change-password ───────────────────────────────────────────
router.post('/change-password', authenticate, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'currentPassword and newPassword are required' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  }

  const db = getDB();
  try {
    const user = await db.collection('users').findOne({ _id: req.user._id });
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await db.collection('users').updateOne(
      { _id: req.user._id },
      { $set: { passwordHash, updatedAt: new Date() } },
    );
    return res.json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error('[auth/change-password]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get('/me', authenticate, (req, res) => {
  res.json({ user: safeUser(req.user) });
});

export default router;
