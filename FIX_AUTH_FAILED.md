# 🔐 Fix: "bad auth : authentication failed"

## The Problem
MongoDB connection is reaching Atlas, but credentials are rejected.

## ✅ Quick Fixes (Try in order)

### 1️⃣ Verify Credentials in MongoDB Atlas

1. Go to https://cloud.mongodb.com → Select cluster `daydream`
2. Click **Database Access** (left sidebar)
3. Find user `jorsenmejia_db_user` in the list
4. Click the **⋯ (three dots)** → **Edit Password**
5. Check the password: **EXACTLY match** what you provided earlier

**Current in .env:**
```
Password: 84aFJF1jAzKyMz6O
Username: jorsenmejia_db_user
```

If password is different, update it to match, or update `.env` to match MongoDB.

### 2️⃣ Check for Special Characters

If your password has these: `@ # % : / ? $` — it needs **URL encoding** in the connection string.

For example, if password is `pass@word`, connection string must be:
```
mongodb+srv://user:pass%40word@cluster...
```

**Your password `3FpvXNyPmTL6k2ug` has no special chars, so NO encoding needed.**

### 3️⃣ Double-Check Connection String Format

Your string MUST be:
```
mongodb+srv://jorsenmejia_db_user:84aFJF1jAzKyMz6O@daydream.7riem3f.mongodb.net/daydreamdictionary?retryWrites=true&w=majority&appName=daydream
```

**Verify:**
- Username: `jorsenmejia_db_user` ✓
- Password: `84aFJF1jAzKyMz6O` ✓
- Cluster: `daydream.7riem3f.mongodb.net` ✓
- Database: `daydreamdictionary` ✓
- NO quotes around entire string ✓
- NO extra spaces ✓

### 4️⃣ Test Locally First

Run in terminal:
```powershell
cd c:\Users\jorse\OneDrive\Desktop\dev-app\day-dream-dictionary
node -e "
const { MongoClient } = require('mongodb');
const uri = 'mongodb+srv://jorsenmejia_db_user:84aFJF1jAzKyMz6O@daydream.7riem3f.mongodb.net/daydreamdictionary?retryWrites=true&w=majority&appName=daydream';
const client = new MongoClient(uri);
client.connect().then(() => {
  console.log('✅ Connected! Auth successful');
  process.exit(0);
}).catch(err => {
  console.error('❌ Auth failed:', err.message);
  process.exit(1);
});
"
```

If this fails locally, the credentials are definitely wrong.
If this succeeds, the issue is something else in Render.

---

## 📋 Common Causes

| Symptom | Cause | Fix |
|---------|-------|-----|
| "bad auth" error | Wrong password | Verify in MongoDB Atlas Database Access |
| Same error after verify | Password changed | Reset password to known value, update `.env` and Render |
| "no database" error | Wrong database name | Verify database name is `daydreamdictionary` |
| "unknown error" after auth | Connection string malformed | Copy fresh from MongoDB Atlas |

---

## 💡 Next Steps

1. Run the local test above
2. Share output (success or error message)
3. I'll help you fix it

If auth is still failing after verifying credentials, there might be an issue with the MongoDB cluster itself (check cluster status in Atlas dashboard).
