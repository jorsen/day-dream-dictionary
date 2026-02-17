# 🎯 Immediate Actions to Fix Render Deployment

## Your Issue: MongoDB TLS Connection Error on Render

The server is running but can't connect to MongoDB Atlas. Here's what to do NOW:

### ✅ Action 1: Set Environment Variables in Render (5 min)

1. Go to https://dashboard.render.com/services
2. Click your `day-dream-dictionary-api` service
3. Click **Environment** (left sidebar)
4. Add/update these variables:

| Key | Value |
|-----|-------|
| `MONGODB_URI` | `mongodb+srv://jorsenmejia_db_user:3FpvXNyPmTL6k2ug@daydream.7riem3f.mongodb.net/daydreamdictionary?retryWrites=true&w=majority&appName=daydream` |
| `MONGODB_DB` | `daydreamdictionary` |
| `NODE_ENV` | `production` |
| `CORS_ORIGIN` | `*` |
| `PORT` | `5000` |

**Critical:** No quotes around values!

5. Click **Save**

### ✅ Action 2: Whitelist Render IP in MongoDB Atlas (5 min)

1. Go to https://cloud.mongodb.com/v2/dashboard
2. Select cluster **daydream**
3. Click **Network Access** → **IP Whitelist**
4. Click **Add IP Address**
5. Enter: `0.0.0.0/0` (temporary for testing)
6. Click **Confirm**

⚠️ After you verify it works, replace with Render's actual IP for security.

### ✅ Action 3: Redeploy (2 min)

1. In Render dashboard, go to **Deployments**
2. Click **Redeploy Latest**
3. Watch logs — should see:
   ```
   ✅ MongoDB connected
   🌙 Day Dream Dictionary API
   📍 Listening on port 5000
   ```

### ✅ Action 4: Test (1 min)

Open: https://day-dream-dictionary-api.onrender.com/api/v1

Should return:
```json
{
  "status": "ok",
  "message": "Day Dream Dictionary API v1 (MongoDB)",
  "endpoints": [...]
}
```

---

## ⏱️ Total Time: ~15 minutes

If still failing, see `RENDER_MONGODB_DEPLOY.md` for troubleshooting.

## 📝 Notes

- `.env` file on your local machine is **not** pushed to Render
- Render only sees environment variables set in the dashboard
- MongoDB Atlas blocks IPs by default (whitelist needed)
