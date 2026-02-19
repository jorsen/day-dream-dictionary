import { z } from 'zod';

// ── Auth ──────────────────────────────────────────────────────────────────────

export const signupSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .email('Invalid email format')
    .max(254, 'Email too long')
    .transform((v) => v.toLowerCase().trim()),
  password: z
    .string({ required_error: 'Password is required' })
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password too long'),
  displayName: z.string().min(1, 'Display name too short').max(50, 'Display name too long').optional(),
});

export const loginSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .email('Invalid email format')
    .transform((v) => v.toLowerCase().trim()),
  password: z.string({ required_error: 'Password is required' }).min(1, 'Password is required'),
});

// ── Dreams ────────────────────────────────────────────────────────────────────

export const dreamTextSchema = z.object({
  dreamText: z
    .string({ required_error: 'dreamText is required' })
    .min(10, 'Dream text must be at least 10 characters')
    .max(5000, 'Dream text must be 5000 characters or fewer')
    .transform((v) => v.trim()),
  language: z.enum(['en', 'es', 'fr', 'pt', 'de', 'it', 'zh', 'ja', 'ko', 'ar', 'tl', 'th']).default('en'),
  // Core fields (free for all users)
  isRecurring: z.boolean().default(false),
  tags: z.array(z.string().min(1).max(50)).max(10).default([]),
  // Add-on fields (ignored unless user has the add-on unlocked)
  lifeSeason: z.string().max(100).optional(),
  enableRecurringAnalysis: z.boolean().default(false),
  partnerDreamText: z.string().min(10).max(5000).optional(), // couples add-on
  pdfMode: z.enum(['standard', 'therapist']).default('standard'),
});

// ── Claude AI response ────────────────────────────────────────────────────────

export const interpretationSchema = z.object({
  mainThemes: z
    .array(z.string().min(1).max(200))
    .min(1, 'At least one theme required')
    .max(10),
  emotionalTone: z.string().min(1).max(500),
  symbols: z
    .array(
      z.object({
        symbol: z.string().min(1).max(200),
        meaning: z.string().min(1).max(500),
      }),
    )
    .min(1, 'At least one symbol required')
    .max(10),
  personalInsight: z.string().min(1).max(2000),
  guidance: z.string().min(1).max(2000),
  // Optional add-on fields
  lifeSeason: z.string().max(1000).optional(),
  recurringPatterns: z.string().max(1000).optional(),
  relationshipInsight: z.string().max(1000).optional(),
  therapeuticFocalPoints: z.array(z.string().max(500)).max(10).optional(),
});

// ── Subscriptions ─────────────────────────────────────────────────────────────

export const createSubscriptionSchema = z.object({
  plan: z.enum(['basic', 'pro'], {
    required_error: 'plan is required',
    invalid_type_error: "plan must be 'basic' or 'pro'",
  }),
  paymentMethodId: z
    .string({ required_error: 'paymentMethodId is required' })
    .min(1, 'paymentMethodId is required'),
});

// ── Credit Packs ──────────────────────────────────────────────────────────────

export const creditPurchaseSchema = z.object({
  pack: z.enum(['10', '25', '60'], {
    required_error: 'pack is required',
    invalid_type_error: "pack must be '10', '25', or '60'",
  }),
  paymentMethodId: z
    .string({ required_error: 'paymentMethodId is required' })
    .min(1, 'paymentMethodId is required'),
});

// ── Add-Ons ───────────────────────────────────────────────────────────────────

export const ADDON_KEYS = [
  'life_season',
  'recurring',
  'couples',
  'therapist_pdf',
  'ad_removal',
];

export const addonPurchaseSchema = z.object({
  addonKey: z.enum(ADDON_KEYS, {
    required_error: 'addonKey is required',
  }),
  paymentMethodId: z
    .string({ required_error: 'paymentMethodId is required' })
    .min(1, 'paymentMethodId is required'),
});

// ── Account preferences ───────────────────────────────────────────────────────

export const preferencesSchema = z.object({
  language: z.enum(['en', 'es', 'fr', 'pt', 'de', 'it', 'zh', 'ja', 'ko', 'ar', 'tl', 'th']).optional(),
  emailResultsOptIn: z.boolean().optional(),
});
