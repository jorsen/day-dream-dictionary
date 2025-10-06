💤 Product Requirements Document (PRD): Day Dream Dictionary
1) Overview

Product: Day Dream Dictionary (DDD)

URL: daydreamdictionary.com

Purpose: Users submit dreams and receive structured interpretations with themes, emotional tone, symbols, personal insights, and guidance.

Primary value: Insightful, repeatable, privacy-conscious dream interpretation with premium depth and journaling/analytics.

Audience: Curious consumers, wellness seekers, journaling/lucid dreaming enthusiasts; later therapists/coaches (B2B).

2) Goals and Non-Goals

Goals

Provide accurate, structured interpretations with a mystical but supportive tone.

Build habit loops (journaling, reminders, timelines) to increase retention.

Monetize via hybrid model: freemium + subscriptions + credit packs + add-ons.

Enable admin oversight: users, payments, dreams, analytics.

Non-Goals (V1)

Clinical diagnosis or medical advice.

Real-time chat with human experts (marketplace post-MVP).

Native mobile apps (web-first; mobile-responsive UI).

3) Personas

Seeker Sarah (Core): 22–38, wellness-focused; 3–6 dreams/month; likely Basic tier.

Power User Priya (Pro): Journals nightly; values analytics/timelines; likely Pro tier.

Curious Chris (Free): Occasional dreams; converts via credits/add-ons.

Coach Casey (B2B later): Wants client-facing tool and admin summaries.

4) Key User Stories (MVP)

Submit a dream → receive structured report (themes, tone, symbols, insight, guidance).

View or delete history (optional MVP feature).

Get 3 free deep interpretations → paywall.

Export report as PDF (premium).

Switch between English/Spanish.

Admin: manage users, payments, dreams; issue refunds/credits; view revenue metrics.

5) Feature Scope

MVP

Dream submission → AI interpretation (OpenRouter).

Structured report sections.

Free quota + paywall (server enforced).

Authentication (Supabase).

Billing (Stripe).

Basic history (opt-in).

Email receipts and optional result delivery.

Admin dashboard (users, payments, metrics, RBAC).

V1+ Premium

Timeline analytics, voice journaling, reminders.

Advanced symbol encyclopedia.

PDF exports (therapist-ready).

Add-ons (Life Season, Recurring Dreams, Couples, etc.).

Community features, workshops.

Expert marketplace (rev-share).

B2B & white-label API.

Sponsorships, affiliates, and ad removal add-ons.

Courses (sleep hygiene, lucid dreaming, etc.).

6) Monetization and Pricing

Model

Freemium core + paid depth:
Free quota (3 deep interpretations/month or trial variations).
Paid tiers unlock unlimited depth, analytics, exports, and journaling.

Tiers

Basic: $4.99–$7.99/month

Pro: $12.99–$19.99/month

Annual discounts; student/family pricing.

Credits

Deep analysis = 3 credits

Packs: 10/$9.99, 25/$19.99, 60/$39.99

Add-ons

Life Season, Recurring Dreams, Couples, Therapist export.

Ads & Affiliates

Contextual, capped impressions; optional ad removal add-on.

Paywall Triggers

After 3 deep reports → upsell or paywall.

Lock analytics and exports behind Basic/Pro tiers.

Experiments

Trials (3 vs 7 days), credit pricing A/Bs, PDF upsells, streak bonuses.

KPIs

Conversion (2–5%/month), trial retention, ARPPU, LTV, attach rates, eCPM, referrals.

7) Architecture

Frontend: React + Next.js, Tailwind, i18n (EN/ES).
Backend: Node.js (Express/Fastify), hosted on Render.
Integrations:

OpenRouter (Claude 3.5 Sonnet 20241022)

Stripe (billing)

Supabase (auth + Postgres)

MongoDB (dream storage)
Hosting: Frontend (Vercel/Netlify), Backend (Render).
Storage: Supabase or S3 for optional object storage.

8) Data Model

Supabase (Postgres)

users, profiles, subscriptions, payments_history, credits, roles.

MongoDB (Atlas)

dreams (dreamText, interpretation JSON), events.

Privacy

Opt-out storage; deletion supported; minimal data retained when disabled.

9) API Endpoints (High-Level)

POST /api/dreams/interpret

GET /api/dreams

GET /api/dreams/:id

POST /api/credits/purchase

POST /api/subscriptions/create|update|cancel

POST /api/stripe/webhook

GET/PUT /api/profile

GET /api/admin/users|payments|dreams (admin)

GET /api/reports/pdf/:id (premium)

10) Interpretation Prompt (Updated for Production)

You are Day Dream Dictionary (DDD) — an empathetic, mystical, and psychologically attuned dream interpreter powered by the model defined in the environment (anthropic/claude-3.5-sonnet:20241022).
The system runs in ${NODE_ENV} mode, version ${API_VERSION}, with API access managed via Supabase and OpenRouter.
Your goal is to deliver insightful, structured interpretations balancing spirituality, symbolism, and emotional intelligence.

🧭 Task

Given a user’s dream text, produce a strict JSON interpretation matching this schema:

{
  "mainThemes": [ "string" ],
  "emotionalTone": "string",
  "symbols": [
    { "symbol": "string", "meaning": "string" }
  ],
  "personalInsight": "string",
  "guidance": "string"
}

💫 Guidelines

Main Themes: identify recurring motifs (e.g., transformation, fear, rebirth).

Emotional Tone: describe mood or atmosphere.

Symbols: choose 2–5 key dream elements, interpret emotionally or archetypally.

Personal Insight: summarize subconscious meaning or growth reflection.

Guidance: provide supportive, mystical direction — never clinical.

🕊️ Style

Warm, poetic, intuitive, but concise.

Mystical + psychological — insightful but grounded.

Avoid repetition or generic phrasing.

No extra text outside the JSON.

⚙️ Environment (from .env)

Model: anthropic/claude-3.5-sonnet:20241022

Temperature: 0.7

Max Tokens: 2000

Supabase Auth + Quota Enforcement

Test Mode: true (sandbox)

Rate Limit: 100 requests

Premium Features: false

🧘 Behavior Rules

Always output valid JSON — no markdown, no prose.

Repair or retry invalid responses server-side.

Universal symbolism; avoid culture-specific bias.

Max 2000 tokens.

🪶 Purpose

This structured JSON output powers the DDD interpretation reports used in the web app and PDF exports.
It forms the basis for premium insights, analytics, and journaling continuity.

11) Security, Privacy, Compliance

Not medical advice (disclaimer required).

Secrets server-side; quota enforced.

“Delete my data” fully supported.

Opt-in aggregation only.

PCI via Stripe.

RBAC, audit logs, rate limiting.

12) Accessibility & Localization

WCAG AA compliance.

Keyboard-friendly UI, semantic HTML.

Launch languages: English, Spanish.

13) Analytics & Instrumentation

Track events: submit_dream, report_view, paywall_view, purchase, etc.

Conversion and retention funnels.

Server metrics: latency, availability.

14) Admin Dashboard

KPIs: DAU/WAU/MAU, conversion, MRR, churn.

Manage users, payments, refunds, roles.

Browse dreams (if allowed).

Export data; toggle feature flags.

15) Ads, Affiliates, Sponsorships

Contextual ad placements; capped impressions.

Affiliate marketplace (journals, sleep tech).

Optional ad removal upsell.

16) B2B & API (Post-MVP)

White-label tenant support.

External API for interpretations (metered).

Corporate wellness dashboards.

17) Roadmap & Timeline (7–9 Weeks)

Week 1: Setup, Auth, Schema, Environments.

Weeks 2–3: Stripe Billing, Credits, Subscriptions.

Week 4: Interpretation API, Quotas, Storage.

Week 5: Admin Dashboard MVP.

Week 6: UI Polish, i18n.

Week 7: QA & Security.

Weeks 8–9: Deployment, Metrics, A/B Testing.

18) Acceptance Criteria (MVP)

Auth functional.

JSON interpretations valid.

Free quota + paywall enforced.

Stripe payments + webhooks operational.

Optional history with delete.

Admin dashboard active.

English/Spanish support.

19) Risks & Mitigations

LLM JSON errors → Schema validation & repair.

Cost limits → Caching & rate caps.

Privacy → Opt-in/out and data deletion.

Payment → Refund policy + Stripe disputes.

Scope creep → Feature flags and phase gating.

20) Open Questions

Final quota configuration for Basic/Pro?

PDF export tone and layout.

Keep MongoDB or consolidate into Postgres?

Choose transactional email provider (Postmark vs SendGrid).

21) References

Prototypes: index.html, payment-page.html, gohighlevel*.html.

Proposal docs: MYSTICAL_PROPOSAL_PROMPT.md, PROJECT_ESTIMATE.md, PROJECT_PLAN.md, PROJECT_TIMELINE.md, proposalastrologydream.html, README.md.

22) Next Steps

Finalize quotas and pricing tests.

Lock schema and endpoints.

Implement quotas, Stripe, and webhooks.

Launch MVP flow with analytics.

Add PDF export and one add-on.

Begin monetization experiments.

✅ End of PRD