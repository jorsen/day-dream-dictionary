import 'dotenv/config';
import express from 'express';
import { connectDB } from './db.js';
import authRouter from './routes/auth.js';
import dreamsRouter from './routes/dreams.js';
import subscriptionsRouter from './routes/subscriptions.js';
import accountRouter from './routes/account.js';
import webhookRouter from './routes/webhook.js';

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

// ── Stripe webhook needs raw body — register BEFORE express.json() ────────────
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

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/dreams', dreamsRouter);
app.use('/api/subscriptions', subscriptionsRouter);
app.use('/api/account', accountRouter);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) =>
  res.json({ status: 'ok', timestamp: new Date().toISOString() }),
);

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

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
