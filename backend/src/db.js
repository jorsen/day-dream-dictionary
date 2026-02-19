import { MongoClient, ObjectId } from 'mongodb';

let client;
let db;

export async function connectDB() {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI environment variable is required');
  }

  client = new MongoClient(process.env.MONGO_URI, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  });

  await client.connect();
  db = client.db('daydreamdictionary');

  // Indexes — idempotent, safe to run on every startup
  await Promise.all([
    db.collection('users').createIndex({ email: 1 }, { unique: true }),
    db.collection('dreams').createIndex({ userId: 1, createdAt: -1 }),
    db.collection('subscriptions').createIndex({ userId: 1 }, { unique: true }),
    db.collection('subscriptions').createIndex({ stripeCustomerId: 1 }),
    db.collection('subscriptions').createIndex({ stripeSubId: 1 }),
    // Credit transactions audit log
    db.collection('creditTransactions').createIndex({ userId: 1, createdAt: -1 }),
    db.collection('creditTransactions').createIndex({ stripePaymentIntentId: 1 }, { sparse: true }),
    // User add-ons
    db.collection('user_addons').createIndex({ userId: 1, addonKey: 1 }),
    db.collection('user_addons').createIndex({ userId: 1, active: 1 }),
  ]);

  console.log('[db] Connected to MongoDB Atlas');
  return db;
}

export function getDB() {
  if (!db) throw new Error('Database not initialised — call connectDB() first');
  return db;
}

export function getClient() {
  if (!client) throw new Error('MongoClient not initialised — call connectDB() first');
  return client;
}

export { ObjectId };
