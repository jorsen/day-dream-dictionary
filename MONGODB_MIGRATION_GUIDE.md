# MongoDB Migration Guide

## Migration Complete! ✅

The database has been successfully migrated from Supabase to MongoDB. Here's a summary of what was changed:

## Changes Made

### 1. New MongoDB Models Created
- `backend/src/models/User.js` - User model with authentication, credits, subscription
- `backend/src/models/Dream.js` - Dream model with interpretations and metadata
- `backend/src/models/Payment.js` - Payment history model
- `backend/src/models/Event.js` - Event tracking model for analytics
- `backend/src/models/index.js` - Model exports

### 2. Updated Configuration
- `backend/src/config/mongodb.js` - MongoDB connection configuration
- `backend/.env` - Environment variables with MongoDB URI
- `backend/.env.example` - Updated example env file

### 3. Updated Routes (Supabase → MongoDB)
- `backend/src/routes/auth.js` - Authentication routes
- `backend/src/routes/dreams.js` - Dream interpretation routes
- `backend/src/routes/profile.js` - User profile routes
- `backend/src/routes/payments.js` - Payment routes
- `backend/src/routes/admin.js` - Admin routes

### 4. Updated Middleware
- `backend/src/middleware/auth.js` - JWT authentication
- `backend/src/middleware/quota.js` - Usage quota checking

### 5. Updated Server
- `backend/src/server.js` - Main server with MongoDB initialization

## Important: Complete Setup Steps

### Step 1: Set Your MongoDB Password

Edit `backend/.env` and replace `<db_password>` with your actual MongoDB password:

```env
MONGODB_URI=mongodb+srv://jorsenmejia_db_user:YOUR_ACTUAL_PASSWORD@daydream.7riem3f.mongodb.net/daydreamdictionary?retryWrites=true&w=majority&appName=daydream
```

### Step 2: Set Secure JWT Secrets

Update the JWT secrets in `backend/.env` with secure random values:

```env
JWT_SECRET=your_very_secure_random_string_here
REFRESH_TOKEN_SECRET=another_very_secure_random_string_here
```

### Step 3: Install/Update Dependencies

Make sure mongoose is installed:

```bash
cd backend
npm install mongoose
```

### Step 4: Start the Server

```bash
cd backend
npm start
```

Or for development with auto-reload:

```bash
npm run dev
```

## MongoDB Collections

The following collections will be created automatically when you start using the app:

| Collection | Description |
|------------|-------------|
| `users` | User accounts with auth, credits, subscription |
| `dreams` | Dream entries with interpretations |
| `payments` | Payment history |
| `events` | Analytics and event tracking |

## API Endpoints

All existing API endpoints remain the same:

- `POST /api/v1/auth/signup` - Register new user
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/dreams/interpret` - Interpret a dream
- `GET /api/v1/dreams` - Get dream history
- `GET /api/v1/profile` - Get user profile
- And more...

## Key Differences from Supabase

1. **User IDs**: MongoDB uses ObjectId instead of UUIDs
2. **Authentication**: JWT-based auth (no Supabase Auth)
3. **Real-time**: No built-in real-time (use WebSockets if needed)
4. **RLS**: No row-level security (handled in application code)

## Troubleshooting

### Connection Failed
- Check your MongoDB password is correct
- Ensure your IP is whitelisted in MongoDB Atlas
- Check network connectivity

### Authentication Issues
- Make sure JWT_SECRET is set
- Check that tokens are being passed correctly

### Data Not Saving
- Check MongoDB connection status at `/health` endpoint
- Review server logs for errors

## MongoDB Atlas Dashboard

Your MongoDB Atlas dashboard: https://cloud.mongodb.com/

From there you can:
- View collections and documents
- Monitor performance
- Set up backups
- Manage indexes

## Need Help?

If you encounter any issues, check:
1. Server logs for error messages
2. MongoDB Atlas dashboard for connection issues
3. Browser console for frontend errors
