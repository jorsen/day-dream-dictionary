# 🚀 Server Setup Guide

## Two Servers Available

### 1️⃣ **Production: `server-mongo.js`** (For Render)
- ✅ Uses MongoDB Atlas for data persistence
- ✅ Requires MONGODB_URI in environment variables
- ✅ Currently deployed on Render
- ❌ Won't start locally if MongoDB unreachable

**Use when:**
- Deploying to Render
- Need persistent database
- Testing real data

**Run locally:**
```powershell
node server-mongo.js
# Requires MongoDB Atlas to be reachable
```

---

### 2️⃣ **Development: `server-dev.js`** (For Local Testing)
- ✅ Uses in-memory storage (no database needed)
- ✅ Works offline / no network required
- ✅ Perfect for testing signup/login flow
- ❌ Data lost when server restarts
- ❌ Single machine only (not for Render)

**Use when:**
- Testing locally
- Don't have MongoDB access
- Developing new features
- Demo/testing signup and login

**Run locally:**
```powershell
node server-dev.js
# Ready immediately, no network needed
```

---

## Which Server Is Running Where?

| Environment | Server | Database | Status |
|-------------|--------|----------|--------|
| **Render Production** | `server-mongo.js` | MongoDB Atlas | ✅ Running |
| **Local Dev** | `server-dev.js` | In-Memory (test) | 🟡 Optional |
| **Local MongoDB** | `server-mongo.js` | MongoDB Atlas | ❌ Network fails |

---

## 📝 API Endpoints (Same for Both Servers)

### Authentication
```
POST /api/v1/auth/signup
  Body: { email, password, displayName }
  
POST /api/v1/auth/login
  Body: { email, password }
  
GET /api/v1/auth/me
  Headers: { Authorization: "Bearer jwt-..." }
```

### Dreams
```
POST /api/v1/dreams
  Body: { dream_text, interpretation?, metadata? }
  Auth: Required
  
GET /api/v1/dreams
  Auth: Required
  
POST /api/v1/dreams/interpret
  Body: { dream_text }
  Auth: Required
```

### Health Check
```
GET /health
  Returns: { status, db: "connected"|"memory"|"disconnected" }
  
GET /api/v1
  Returns: API info and endpoints
  
GET /api/v1/debug/stats
  Returns: User and dream counts
```

---

## 🧪 Quick Test Flow (Local Dev)

```powershell
# Terminal 1: Start dev server
node server-dev.js

# Terminal 2: Test signup
curl -X POST http://localhost:5000/api/v1/auth/signup `
  -H "Content-Type: application/json" `
  -d '{"email":"test@example.com","password":"password123","displayName":"Test"}'

# Should return: { "accessToken": "jwt-...", "user": {...} }

# Terminal 2: Test login with same email/password
curl -X POST http://localhost:5000/api/v1/auth/login `
  -H "Content-Type: application/json" `
  -d '{"email":"test@example.com","password":"password123"}'

# Should return: { "accessToken": "jwt-...", "user": {...} }
```

---

## 🚨 Troubleshooting

**`Cannot read properties of undefined (reading 'collection')`**
- ❌ Problem: Using `server-mongo.js` without MongoDB access
- ✅ Solution: Use `server-dev.js` for local testing

**`querySrv ECONNREFUSED _mongodb._tcp.daydream...`**
- ❌ Problem: Network can't reach MongoDB Atlas
- ✅ Solution: Use `server-dev.js` or connect via Render

**`Database not connected. Server starting up.` (503)**
- ℹ️ Info: MongoDB connection still retrying
- ✅ Solution: Wait a few seconds or check MongoDB Atlas whitelist

**`CORS blocked origin`**
- ❌ Problem: Frontend can't reach API
- ✅ Solution: Frontend and API must be on whitelisted domains
- ✅ Or: Both servers have `origin: '*'` CORS enabled

---

## 📦 Production vs Dev

**Render Production (`server-mongo.js`):**
- Connects to MongoDB Atlas on startup
- Exits if connection fails (will restart automatically)
- Returns `503` if database goes down
- Data persists across restarts

**Local Dev (`server-dev.js`):**
- Always ready immediately
- In-memory storage (Map data structures)
- Data lost on restart
- No external dependencies needed

---

## ✅ Next Steps

1. **For local testing:** Use `node server-dev.js`
2. **For Render:** Uses `server-mongo.js` (auto-deployed via GitHub)
3. **Data migration:** After MongoDB works, run `npm run migrate`
4. **Real data:** Switch from dev server to `server-mongo.js`
