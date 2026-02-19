import jwt from 'jsonwebtoken';
import { getDB, ObjectId } from '../db.js';

/**
 * Verifies the Bearer JWT and attaches req.user (without passwordHash).
 * Returns 401 on any failure.
 */
export async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization header missing or malformed' });
  }

  const token = authHeader.slice(7);

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    const message = err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token';
    return res.status(401).json({ error: message });
  }

  if (!payload.sub) {
    console.error('[auth] JWT missing sub claim. Payload keys:', Object.keys(payload));
    return res.status(401).json({ error: 'Invalid token subject' });
  }

  let user;
  try {
    const db = getDB();
    // Try ObjectId lookup first (standard auto-generated _id)
    if (ObjectId.isValid(payload.sub)) {
      user = await db
        .collection('users')
        .findOne({ _id: new ObjectId(payload.sub) }, { projection: { passwordHash: 0 } });
    }
    // Fall back to plain string _id (manually-inserted documents, UUID-based ids, etc.)
    if (!user) {
      user = await db
        .collection('users')
        .findOne({ _id: payload.sub }, { projection: { passwordHash: 0 } });
    }
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }

  if (!user) {
    return res.status(401).json({ error: 'User not found' });
  }

  req.user = user;
  next();
}

/**
 * Must be used after authenticate(). Rejects non-admin callers.
 */
export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}
