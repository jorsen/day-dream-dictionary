# Product Requirements Document (PRD): Day Dream Dictionary

1) Overview
- Product: Day Dream Dictionary (DDD)
- URL: daydreamdictionary.com
- Purpose: Users submit dreams and receive structured interpretations with themes, emotional tone, symbols, personal insights, and guidance.
- Primary value: Insightful, repeatable, privacy-conscious dream interpretation with premium depth and journaling/analytics.
- Audience: Curious consumers, wellness seekers, journaling/lucid dreaming enthusiasts; later therapists/coaches (B2B).

2) Goals and Non-Goals
- Goals
  - Provide accurate, structured interpretations with a mystical but supportive tone.
  - Build habit loops (journaling, reminders, timelines) to increase retention.
  - Monetize via hybrid model: freemium + subscriptions + credit packs + add-ons.
  - Enable admin oversight: users, payments, dreams, analytics.
- Non-Goals (V1)
  - Clinical diagnosis/medical advice.
  - Real-time chat with human experts (marketplace is post-MVP).
  - Native mobile apps (web-first; mobile-responsive UI).

3) Personas
- Seeker Sarah (Core): 22–38, wellness-focused; 3–6 dreams/month; likely Basic tier.
- Power User Priya (Pro): Journals nightly; values analytics/timelines; likely Pro tier.
- Curious Chris (Free): Occasional dreams; converts via credits/add-ons.
- Coach Casey (B2B later): Wants client-facing tool and admin summaries.

4) Key User Stories (MVP)
- As a user, I can submit a dream and receive a structured report: themes, emotional tone, symbols (meaning), personal insight, guidance.
- As a user, I can see recent history (optional for MVP if storage on) and delete data.
- As a user, I can get 3 free deep interpretations (configurable); then see paywall/credit flows.
- As a user, I can export a single report as PDF (premium).
- As a user, I can switch language to English/Spanish.
- As an admin, I can view users, payments, and optionally dream submissions; refund/credit users; manage roles; view revenue metrics.

5) Feature Scope
MVP
- Dream submission → AI interpretation (OpenRouter)
- Structured sections: Main Themes, Emotional Tone, Dream Symbols, Personal Insight, Guidance
- Free quota + paywall triggers (server-enforced)
- Authentication (Supabase Auth)
- Billing: Stripe subscriptions and credit packs
- Basic history (opt-in; user can delete)
- Email receipts and optional results email
- Admin dashboard: users, payments, metrics; basic RBAC

V1+ Premium
- Timeline analytics (recurring symbols/themes; triggers)
- Voice journaling, reminders
- Advanced symbol encyclopedia (free basics, gated advanced)
- PDF export (therapist-ready summary template)
- Add-ons: Life Season report; Recurring-dream deep dives; Couples reports
- Community: premium dream circles; workshops
- Expert marketplace (rev-share), async second-opinion
- B2B: white-label and API; corporate wellness dashboards
- Sponsorships/affiliates; tasteful free-tier ads; remove-ads add-on
- Courses: sleep hygiene, lucid dreaming; ebooks/workbooks

6) Monetization and Pricing
Model
- Freemium core + paid depth
  - Free: 3 deep interpretations/month + basic, or 5 basic + 1 deep trial (A/B)
  - Paid: deeper analysis, unlimited/higher quotas, analytics, exports, voice features
- Subscription tiers
  - Basic: $4.99–$7.99/mo (20–50 interpretations, deeper report, save history, PDF export)
  - Pro: $12.99–$19.99/mo (unlimited, analytics, voice journaling, reminders, symbol encyclopedia)
  - Annual discounts; family/student pricing
- Credits
  - Deep analysis = 3 credits
  - Packs: 10/$9.99, 25/$19.99, 60/$39.99
- Add-ons
  - Life Season report; Recurring-dream map; Couples report; Lucid kit; Therapist-ready export
- Ads & affiliates (free tier)
  - Contextual, capped impressions; remove-ads add-on ($1.99–$3.99/mo)

Paywall Triggers
- After 3 deep reports → subscribe or buy credits
- Lock advanced analytics/encyclopedia/exports behind Basic/Pro
- Gentle upsells: remove ads; unlock voice journaling

Fast Experiments
- A/B: 3 vs 7-day trials; price anchors; credit pack pricing
- Gate symbol encyclopedia depth behind Basic; measure conversion
- PDF upsell at end of free report
- Streak rewards bonus credits for retention

KPIs
- Free→Paid conversion 2–5%/mo; trial keep-rate; churn; ARPPU; LTV
- Attach rates: PDF/add-ons; paywall view→purchase
- Ads eCPM; referral efficacy

7) Architecture
Frontend
- React + Next.js, Tailwind; responsive; i18n (EN/ES)
- Client talks to backend; no API keys in client

Backend
- Node.js (Express/Fastify), hosted on Render
- Integrations: OpenRouter (Claude 3.5 Sonnet 20241022), Stripe, Supabase Auth, Supabase Postgres, MongoDB (dream docs)
- Admin protected routes; RBAC

Hosting/Infra
- Frontend: Vercel/Netlify (or Render)
- Backend: Render
- Datastores: Supabase (auth/relational); MongoDB (dream docs)
- Object storage (optional): Supabase Storage/S3

8) Data Model
Supabase (Postgres)
- users (Supabase Auth): id, email, created_at
- profiles: user_id, display_name, locale, preferences
- subscriptions: id, user_id, stripe_customer_id, plan, status, current_period_end
- payments_history: id, user_id, amount, currency, status, provider_charge_id, created_at
- credits: user_id, balance, updated_at
- roles: user_id, role ('user','admin')

MongoDB (Atlas)
- dreams: _id, userId, dreamText, interpretation JSON, createdAt, locale, source
- events: _id, userId, type, metadata, createdAt

Privacy
- Opt-out of cloud storage (Pro differentiator); minimal/no storage when disabled; easy deletion

9) API Endpoints (high-level)
- POST /api/dreams/interpret
- GET /api/dreams
- GET /api/dreams/:id
- POST /api/credits/purchase
- POST /api/subscriptions/create|update|cancel
- POST /api/stripe/webhook
- GET/PUT /api/profile
- GET /api/admin/users|payments|dreams (admin)
- GET /api/reports/pdf/:id (premium)

10) Interpretation Prompt (baseline)
- Model: anthropic/claude-3.5-sonnet:20241022; temperature 0.7; max_tokens 2000
- Returns strict JSON: mainThemes[], emotionalTone, symbols[], personalInsight, guidance
- Enforce schema server-side; repair/retry if invalid

11) Security, Privacy, Compliance
- Not medical advice; show disclaimer
- Server-side quota; secrets not exposed
- Delete-my-data + account deletion
- Aggregation/anonymization requires explicit opt-in
- PCI via Stripe only
- Rate limiting; abuse detection
- Admin RBAC; audit log

12) Accessibility & Localization
- WCAG AA; keyboard; semantic roles
- English/Spanish at launch; extensible i18n

13) Analytics & Instrumentation
- Events: submit_dream, report_view, paywall_view, purchase, etc.
- Funnels: conversion, pricing A/B, retention, attach rates
- Server logs/metrics; SLOs for latency, availability

14) Admin Dashboard
- KPIs: DAU/WAU/MAU, conversion, MRR, churn, ARPPU
- Users table; payment history; refunds/credits
- Dreams browsing (if allowed); exports; role mgmt
- Feature flags for quotas/experiments

15) Ads, Affiliates, Sponsorships
- Contextual placements; caps; remove-ads upsell
- Affiliate marketplace (sleep tech, journals)

16) B2B & API (post-MVP)
- White-label tenant accounts; per-seat pricing
- External API for interpretations (metered)
- Corporate wellness dashboards (privacy-first)

17) Roadmap & Timeline (7–9 weeks)
- Week 1: Setup, Auth, schema, environments
- Weeks 2–3: Billing (Stripe), credits, subs
- Week 4: Interpretation API, storage, quotas
- Week 5: Admin dashboard MVP
- Week 6: UI polish, i18n
- Week 7: Testing/QA, security
- Week 8–9: Deploy, metrics, A/Bs

18) Acceptance Criteria (MVP)
- Auth works; interpretation JSON valid
- Server-enforced free quota + paywalls
- Stripe subs/credits + webhooks
- Optional history with delete
- Admin basic controls and metrics
- EN/ES support; responsive; AA contrast

19) Risks & Mitigations
- LLM JSON errors → schema validation + repair
- Cost/rate limits → caching/backoff/caps
- Privacy → explicit opt-in/out and deletion
- Payments → clear refund policy; Stripe disputes
- Scope creep → phase gating; feature flags

20) Open Questions
- Final Basic/Pro quotas? Default A/B?
- PDF template content and brand tone
- MongoDB vs only Postgres for dreams
- Email provider (Postmark/SendGrid)

21) References
- Prototypes: index.html, gohighlevel*.html, payment-page.html
- Proposal/estimate/timeline: MYSTICAL_PROPOSAL_PROMPT.md, PROJECT_ESTIMATE.md, PROJECT_PLAN.md, PROJECT_TIMELINE.md, proposalastrologydream.html, README.md

22) Next Steps
- Finalize MVP quotas/paywall copy/pricing A/B
- Lock schemas; scaffold models and endpoints
- Implement quotas, Stripe subs/credits, webhooks
- Ship MVP dream flow; instrument analytics
- Add PDF export + one add-on + one course
- Start pricing/paywall experiments
