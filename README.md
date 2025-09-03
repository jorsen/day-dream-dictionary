# 🌙 Day Dream Dictionary

> AI-powered dream interpretation platform with personalized insights, symbol analysis, and psychological guidance.

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green)](https://nodejs.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-6.0-green)](https://www.mongodb.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Auth-orange)](https://supabase.com/)
[![Stripe](https://img.shields.io/badge/Stripe-Payments-blue)](https://stripe.com/)

## ✨ Features

### Core Functionality
- 🤖 **AI-Powered Interpretations** - Using Claude 3.5 Sonnet for deep, meaningful dream analysis
- 📊 **Structured Analysis** - Main themes, emotional tone, symbol meanings, personal insights, and actionable guidance
- 🌍 **Multi-Language Support** - Available in English and Spanish
- 📱 **Responsive Design** - Works seamlessly on desktop, tablet, and mobile devices

### User Features
- 📔 **Dream Journal** - Save and organize all your dream interpretations
- 🔄 **Recurring Dream Tracking** - Identify patterns in recurring dreams
- 📈 **Analytics Dashboard** - Track themes, emotions, and symbols over time
- 🏷️ **Tagging System** - Organize dreams with custom tags
- 📄 **PDF Export** - Download professional reports for therapy or personal records
- 🔍 **Search & Filter** - Find specific dreams quickly

### Monetization
- 💳 **Flexible Pricing** - Freemium model with subscription tiers and credit packs
- 🎁 **Free Tier** - 3 deep interpretations per month
- ⭐ **Basic Plan** ($7.99/mo) - 50 interpretations, PDF export, history
- 🚀 **Pro Plan** ($19.99/mo) - Unlimited interpretations, advanced analytics, voice journaling
- 💰 **Credit Packs** - One-time purchases for occasional users

### Admin Features
- 👥 **User Management** - View, edit, and moderate users
- 💵 **Revenue Analytics** - Track MRR, conversions, and growth
- 📊 **System Metrics** - Monitor usage, performance, and errors
- 💸 **Refund Management** - Process refunds and add credits
- 📝 **Audit Logs** - Track all admin actions

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)
- Supabase account
- Stripe account
- OpenRouter API key

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd day-dream-dictionary

# Install backend dependencies
cd backend
npm install
cp .env.example .env
# Edit .env with your credentials

# Start backend server
npm run dev

# In a new terminal, set up frontend
cd ../frontend
npm install
# Create .env.local with your credentials
npm run dev
```

Visit `http://localhost:3000` to see the application.

For detailed setup instructions, see [SETUP_GUIDE.md](./SETUP_GUIDE.md).

## 📁 Project Structure

```
day-dream-dictionary/
├── backend/                 # Express.js API server
│   ├── src/
│   │   ├── config/         # Database & service configs
│   │   ├── middleware/     # Auth, quota, logging
│   │   ├── models/         # MongoDB schemas
│   │   ├── routes/         # API endpoints
│   │   └── locales/        # i18n translations
│   └── package.json
├── frontend/               # Next.js React app
│   ├── app/               # App router pages
│   ├── components/        # React components
│   └── package.json
└── docs/                  # Documentation
```

## 🛠️ Tech Stack

### Backend
- **Runtime**: Node.js with Express.js
- **Databases**: MongoDB (dreams), Supabase PostgreSQL (users, payments)
- **Authentication**: Supabase Auth with JWT
- **AI**: OpenRouter API (Claude 3.5 Sonnet)
- **Payments**: Stripe (subscriptions & one-time)
- **Email**: SendGrid/Postmark
- **Logging**: Winston
- **Security**: Helmet, CORS, rate limiting

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State**: Zustand
- **Forms**: React Hook Form
- **API Client**: Axios
- **Auth**: Supabase JS Client
- **Payments**: Stripe.js

## 📚 API Documentation

### Authentication
```http
POST /api/v1/auth/signup
POST /api/v1/auth/login
POST /api/v1/auth/logout
POST /api/v1/auth/refresh
POST /api/v1/auth/forgot-password
POST /api/v1/auth/reset-password
```

### Dreams
```http
POST /api/v1/dreams/interpret
GET  /api/v1/dreams/history
GET  /api/v1/dreams/:id
PATCH /api/v1/dreams/:id
DELETE /api/v1/dreams/:id
GET  /api/v1/dreams/stats/summary
```

### Payments
```http
POST /api/v1/payments/create-subscription-checkout
POST /api/v1/payments/create-credits-checkout
GET  /api/v1/payments/subscription
POST /api/v1/payments/cancel-subscription
GET  /api/v1/payments/credits
```

### Profile
```http
GET  /api/v1/profile
PUT  /api/v1/profile
GET  /api/v1/profile/stats
GET  /api/v1/profile/export
```

For complete API documentation, see [API.md](./docs/API.md).

## 🔐 Environment Variables

### Required Backend Variables
```env
# Database
MONGODB_URI=mongodb://localhost:27017/daydreamdictionary
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_KEY=xxx

# Authentication
JWT_SECRET=xxx
REFRESH_TOKEN_SECRET=xxx

# AI
OPENROUTER_API_KEY=xxx

# Payments
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Email
SENDGRID_API_KEY=xxx
```

### Required Frontend Variables
```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
```

## 🧪 Testing

```bash
# Run backend tests
cd backend
npm test

# Run frontend tests
cd frontend
npm test

# E2E tests
npm run test:e2e
```

## 📦 Deployment

### Backend (Render)
1. Create new Web Service on Render
2. Connect GitHub repository
3. Set environment variables
4. Deploy

### Frontend (Vercel)
1. Import project to Vercel
2. Configure environment variables
3. Deploy

See [DEPLOYMENT.md](./docs/DEPLOYMENT.md) for detailed instructions.

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

### Development Workflow
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Write/update tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see [LICENSE](./LICENSE) file for details.

## 🙏 Acknowledgments

- OpenRouter for AI API access
- Supabase for authentication and database
- Stripe for payment processing
- The open-source community

## 📞 Support

- 📧 Email: support@daydreamdictionary.com
- 📖 Documentation: [docs.daydreamdictionary.com](https://docs.daydreamdictionary.com)
- 💬 Discord: [Join our community](https://discord.gg/daydreamdictionary)

## 🚦 Project Status

- ✅ Backend API: **90% Complete**
- 🚧 Frontend UI: **In Development**
- 📝 Documentation: **80% Complete**
- 🧪 Testing: **Pending**
- 🚀 Production: **Not Deployed**

See [PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md) for detailed progress.

---

<p align="center">
  Made with ❤️ by the Day Dream Dictionary Team
  <br>
  © 2024 Day Dream Dictionary. All rights reserved.
</p>