# Day Dream Dictionary - Setup Guide

## 📋 Prerequisites

- Node.js 18+ and npm/yarn
- MongoDB (local or Atlas account)
- Supabase account
- Stripe account
- OpenRouter API account
- SendGrid or Postmark account (for emails)

## 🚀 Quick Start

### 1. Clone and Install Dependencies

```bash
# Clone the repository (if using git)
git clone <repository-url>
cd day-dream-dictionary

# Install backend dependencies
cd backend
npm install

# Create frontend (if not exists)
cd ..
npx create-next-app@latest frontend --typescript --tailwind --app --no-src-dir --import-alias "@/*"
cd frontend
npm install @supabase/supabase-js axios react-hook-form zustand @stripe/stripe-js
```

### 2. Environment Configuration

#### Backend Configuration
Copy the `.env.example` to `.env` in the backend folder:

```bash
cd backend
cp .env.example .env
```

Edit `.env` with your actual values:

```env
# REQUIRED - Must be configured for MVP
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# Supabase (REQUIRED)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key

# MongoDB (REQUIRED)
MONGODB_URI=mongodb://localhost:27017/daydreamdictionary
# Or for Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/daydreamdictionary

# Authentication (REQUIRED)
JWT_SECRET=generate-a-long-random-string-here
JWT_EXPIRES_IN=7d
REFRESH_TOKEN_SECRET=another-long-random-string
REFRESH_TOKEN_EXPIRES_IN=30d

# OpenRouter API (REQUIRED)
OPENROUTER_API_KEY=your-openrouter-api-key

# Stripe (REQUIRED)
STRIPE_SECRET_KEY=sk_test_your-key
STRIPE_PUBLISHABLE_KEY=pk_test_your-key
STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret

# Email Service (Choose one)
SENDGRID_API_KEY=your-sendgrid-key
# OR
# POSTMARK_API_KEY=your-postmark-key
EMAIL_FROM=noreply@yourdomain.com
```

#### Frontend Configuration
Create `.env.local` in the frontend folder:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your-key
```

### 3. Database Setup

#### Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com)

2. Run these SQL commands in the Supabase SQL editor:

```sql
-- Create profiles table
CREATE TABLE profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name VARCHAR(100),
  locale VARCHAR(5) DEFAULT 'en',
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create subscriptions table
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id VARCHAR(255) UNIQUE,
  stripe_subscription_id VARCHAR(255) UNIQUE,
  plan VARCHAR(50),
  status VARCHAR(50),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create payments_history table
CREATE TABLE payments_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  currency VARCHAR(3) DEFAULT 'usd',
  status VARCHAR(50),
  type VARCHAR(50),
  provider_charge_id VARCHAR(255),
  invoice_id VARCHAR(255),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create credits table
CREATE TABLE credits (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create roles table
CREATE TABLE roles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR(50) DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_payments_user_id ON payments_history(user_id);
CREATE INDEX idx_payments_created_at ON payments_history(created_at DESC);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own subscription" ON subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own payments" ON payments_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own credits" ON credits
  FOR SELECT USING (auth.uid() = user_id);
```

#### MongoDB Setup

MongoDB collections will be created automatically when you first run the application. No manual setup required.

### 4. Stripe Configuration

1. Log in to your [Stripe Dashboard](https://dashboard.stripe.com)

2. Create Products and Prices:
   - Basic Plan: $7.99/month
   - Pro Plan: $19.99/month

3. Set up webhook endpoint:
   - URL: `https://your-domain.com/api/v1/webhooks/stripe`
   - Events to listen for:
     - `checkout.session.completed`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`
     - `charge.refunded`

4. Copy the webhook signing secret to your `.env`

### 5. Running the Application

#### Start Backend Server

```bash
cd backend
npm run dev
# Server will run on http://localhost:5000
```

#### Start Frontend Development Server

```bash
cd frontend
npm run dev
# Frontend will run on http://localhost:3000
```

### 6. Create Admin User

Once the backend is running, create an admin user:

1. Sign up normally through the API or frontend
2. Use MongoDB Compass or Atlas to find your user ID
3. Update the user's role in Supabase:

```sql
INSERT INTO roles (user_id, role) 
VALUES ('your-user-id', 'admin')
ON CONFLICT (user_id) 
DO UPDATE SET role = 'admin';
```

## 🧪 Testing the Setup

### Test Backend API

```bash
# Health check
curl http://localhost:5000/health

# Should return:
# {"status":"OK","message":"Day Dream Dictionary API is running","version":"v1"}
```

### Test Database Connections

1. Check MongoDB connection in backend logs
2. Check Supabase connection in backend logs
3. Both should show "✅ Connected successfully"

### Test Authentication

```bash
# Sign up
curl -X POST http://localhost:5000/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "sample1@gmail.com",
    "password": "sample",
    "displayName": "Test User"
  }'
```

### Test Dream Interpretation (requires auth token)

```bash
# First login to get token
TOKEN=$(curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"sample1@gmail.com","password":"sample"}' \
  | jq -r '.accessToken')

# Submit dream
curl -X POST http://localhost:5000/api/v1/dreams/interpret \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "dreamText": "I was flying over a beautiful ocean",
    "interpretationType": "basic"
  }'
```

## 🐛 Troubleshooting

### Common Issues

1. **MongoDB Connection Failed**
   - Ensure MongoDB is running locally or Atlas connection string is correct
   - Check firewall/network settings

2. **Supabase Auth Error**
   - Verify Supabase URL and keys are correct
   - Check if Supabase project is active

3. **Stripe Webhook Errors**
   - Ensure webhook secret is correct
   - Use Stripe CLI for local testing: `stripe listen --forward-to localhost:5000/api/v1/webhooks/stripe`

4. **OpenRouter API Errors**
   - Check API key is valid
   - Ensure you have credits in your OpenRouter account

5. **CORS Issues**
   - Verify FRONTEND_URL in backend .env matches your frontend URL
   - Check CORS_ORIGIN includes your frontend URL

## 📚 Additional Resources

- [Backend API Documentation](./docs/API.md)
- [Frontend Component Guide](./frontend/README.md)
- [Deployment Guide](./DEPLOYMENT.md)
- [Contributing Guidelines](./CONTRIBUTING.md)

## 🆘 Getting Help

- Check the [PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md) for architecture overview
- Review the [PRD.md](./PRD.md) for product requirements
- Open an issue in the repository
- Contact the development team

---

*Last Updated: 2025-09-03*
