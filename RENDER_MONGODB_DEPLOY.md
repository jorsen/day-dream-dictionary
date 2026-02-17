# 🚀 Deploy to Render (MongoDB Edition)

## Issue: MongoDB TLS Connection Error

The logs show:
```
MongoDB connection failed: ...ssl3_read_bytes:tlsv1 alert internal error...
```

This means Render can't connect to MongoDB Atlas. **Root causes:**

1. **Environment variables not set in Render** — `.env` files aren't pushed to git, so Render doesn't see them
2. **MongoDB Atlas IP whitelist** — Render's IP might be blocked
3. **Connection string issues** — Quotes or special characters in the string

## ✅ Step-by-Step Fix

### 1. Set Environment Variables in Render Dashboard

1. Go to your Render service dashboard
2. Click **Environment** on the left
3. Add/update these variables **exactly** (no quotes around values):

```
MONGODB_URI=mongodb+srv://jorsenmejia_db_user:3FpvXNyPmTL6k2ug@daydream.7riem3f.mongodb.net/daydreamdictionary?retryWrites=true&w=majority&appName=daydream
MONGODB_DB=daydreamdictionary
PORT=5000
NODE_ENV=production
CORS_ORIGIN=*
```

4. Click **Save**

### 2. Fix MongoDB Atlas IP Whitelist

Your Render service IP may be blocked. Add it to Atlas:

1. Go to [MongoDB Atlas Dashboard](https://cloud.mongodb.com/v2/dashboard)
2. Select your cluster (daydream)
3. Go to **Network Access** → **IP Whitelist**
4. Click **Add IP Address**
5. Either:
   - Enter `0.0.0.0/0` (allow all — **for testing only**, then restrict later)
   - Or add Render's IPs manually (harder to maintain, but more secure)

6. Click **Confirm**

### 3. Verify Connection String

Your MONGODB_URI should be:
- **NOT quoted** (no `"` or `'` around it)
- **Includes password** (3FpvXNyPmTL6k2ug)
- **Includes database** (/daydreamdictionary)
- **Has query params** (?retryWrites=true&w=majority&appName=daydream)

Example (correct):
```
mongodb+srv://jorsenmejia_db_user:3FpvXNyPmTL6k2ug@daydream.7riem3f.mongodb.net/daydreamdictionary?retryWrites=true&w=majority&appName=daydream
```

### 4. Update Start Command (if needed)

In Render dashboard → Service Settings → **Start Command**:

```
node server-mongo.js
```

### 5. Redeploy

1. Go to **Deployments** tab
2. Click **Redeploy Latest Commit** or push new code to GitHub
3. Watch the logs — you should see:
   ```
   ✅ MongoDB connected
   🌙 Day Dream Dictionary API
   📍 Listening on port 5000
   ```

### 6. Test the API

Once deployed, test:

```bash
curl https://day-dream-dictionary-api.onrender.com/health

# Should return:
# {"status":"ok"}
```

Then test signup from your frontend at:
```
https://day-dream-dictionary-api.onrender.com/api/v1
```

## 🧪 Test Locally First (Optional)

Before redeploying, test locally with correct env:

```bash
export MONGODB_URI="mongodb+srv://jorsenmejia_db_user:3FpvXNyPmTL6k2ug@daydream.7riem3f.mongodb.net/daydreamdictionary?retryWrites=true&w=majority&appName=daydream"
export NODE_ENV=production
node server-mongo.js
```

(On Windows PowerShell):
```powershell
$env:MONGODB_URI="mongodb+srv://jorsenmejia_db_user:3FpvXNyPmTL6k2ug@daydream.7riem3f.mongodb.net/daydreamdictionary?retryWrites=true&w=majority&appName=daydream"
$env:NODE_ENV="production"
node server-mongo.js
```

## ⚠️ Security Notes

- **Never commit `.env` to git** — it's in `.gitignore` for a reason
- **IP whitelist `0.0.0.0/0`** is temporary for testing — restrict to Render IPs when public
- **Change the MongoDB password** after you get this working
- **Use strong JWT secrets** (generate fresh ones if deployed to production)

## 🆘 Troubleshooting

**Still getting TLS error?**
- Check MongoDB Atlas status (might be maintenance)
- Verify username/password are correct in the URI
- Try a different MongoDB connection type (standard vs SRV)

**API returns 404?**
- Make sure start command is `node server-mongo.js`
- Check that PORT environment variable is set (or defaults to 5000)
- Verify CORS_ORIGIN env var is set

**Can't log in from frontend?**
- Verify API_BASE_URL in `config.js` points to your Render domain
- Check CORS_ORIGIN includes your frontend domain

## ✅ Success!

Once MongoDB connects and the API responds to `/health`, you're ready to test:

1. **Sign up** at your frontend login page
2. **Submit a dream**
3. **View history**

All data is now stored in MongoDB! 🎉
