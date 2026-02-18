import 'dotenv/config';
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { connectDB, getDB } from './db.js';
import { authenticate } from './middleware/auth.js';
import authRouter from './routes/auth.js';
import dreamsRouter from './routes/dreams.js';
import subscriptionsRouter from './routes/subscriptions.js';
import accountRouter from './routes/account.js';
import webhookRouter from './routes/webhook.js';

// ── Static file root (two levels up from backend/src/) ────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const STATIC_DIR = join(__dirname, '..', '..');

// ── Validate required env vars ────────────────────────────────────────────────
const REQUIRED_ENV = [
  'MONGO_URI',
  'JWT_SECRET',
  'CLAUDE_API_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRICE_BASIC',
  'STRIPE_PRICE_PRO',
];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`[startup] Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

const app = express();
const PORT = process.env.PORT || 3001;

// ── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ── Stripe webhook — raw body, registered BEFORE express.json() ───────────────
// Note: also register the legacy path so existing Stripe configs keep working
app.use(
  '/api/v1/stripe/webhook',
  express.raw({ type: 'application/json' }),
  webhookRouter,
);
app.use(
  '/api/stripe/webhook',
  express.raw({ type: 'application/json' }),
  webhookRouter,
);

// ── Standard middleware ───────────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));

// ── Hardened security headers ─────────────────────────────────────────────────
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// ── API v1 routes — matches frontend config.js API_BASE_URL (/api/v1) ─────────
const v1 = '/api/v1';

app.use(`${v1}/auth`,          authRouter);
app.use(`${v1}/dreams`,        dreamsRouter);
app.use(`${v1}/subscriptions`, subscriptionsRouter);
app.use(`${v1}/account`,       accountRouter);

// ── GET /api/v1/profile ───────────────────────────────────────────────────────
// Consumed by dream-interpretation.html and other pages to get user + plan data.
// Returns the shape those pages already expect.
app.get(`${v1}/profile`, authenticate, async (req, res) => {
  try {
    const db = getDB();

    const [sub, user] = await Promise.all([
      db.collection('subscriptions').findOne(
        { userId: req.user._id },
        { projection: { stripeCustomerId: 0, stripeSubId: 0 } },
      ),
      db.collection('users').findOne(
        { _id: req.user._id },
        { projection: { freeUsedThisMonth: 1, freeMonthStart: 1, displayName: 1 } },
      ),
    ]);

    const isActiveSub = sub && sub.status === 'active' && sub.currentPeriodEnd > new Date();
    const plan = isActiveSub ? sub.plan : 'free';

    const planLabels = { free: 'Free Plan', basic: 'Basic Plan', pro: 'Pro Plan' };

    return res.json({
      profile: {
        display_name:  req.user.displayName,
        locale:        'en',
        preferences:   {},
        credits:       plan === 'free' ? null : 'unlimited',
        dream_count:   0, // populated from dreams collection if needed later
        subscription: {
          plan,
          planName:         planLabels[plan] ?? 'Free Plan',
          planType:         plan,
          status:           sub?.status ?? 'none',
          currentPeriodEnd: sub?.currentPeriodEnd ?? null,
          monthlyDeepLimit: sub?.monthlyDeepLimit ?? null,
          monthlyDeepUsed:  sub?.monthlyDeepUsed  ?? 0,
          // Free-tier quota fields
          monthlyFreeLimit: 3,
          freeUsedThisMonth: user?.freeUsedThisMonth ?? 0,
        },
      },
    });
  } catch (err) {
    console.error('[profile]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/v1/config/stripe-key ─────────────────────────────────────────────
// Returns the Stripe publishable key so the frontend can init Stripe.js safely.
app.get(`${v1}/config/stripe-key`, (_req, res) => {
  const key = process.env.STRIPE_PUBLISHABLE_KEY;
  if (!key) return res.status(503).json({ error: 'Stripe not configured' });
  res.json({ publishableKey: key });
});

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) =>
  res.json({ status: 'ok', timestamp: new Date().toISOString() }),
);

// ── Static files (HTML pages, CSS, JS, images) ────────────────────────────────
app.use(express.static(STATIC_DIR));

// ── 404 ───────────────────────────────────────────────────────────────────────
// API paths return JSON; everything else falls back to index.html
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(join(STATIC_DIR, 'index.html'));
});

// ── Global error handler ──────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[unhandled]', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Bootstrap ─────────────────────────────────────────────────────────────────
async function start() {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`[server] Listening on port ${PORT} (${process.env.NODE_ENV})`);
    });
  } catch (err) {
    console.error('[startup] Fatal error:', err);
    process.exit(1);
  }
}

start();
