require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { MongoClient } = require('mongodb');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gwgjckczyscpaozlevpe.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || '';
const MONGODB_URI = process.env.MONGODB_URI || '';
const MONGODB_DB = process.env.MONGODB_DB || 'daydream';

if (!SUPABASE_KEY) {
  console.error('Missing Supabase key. Set SUPABASE_SERVICE_KEY or SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

if (!MONGODB_URI) {
  console.error('Missing MongoDB URI. Set MONGODB_URI in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const TABLES_TO_MIGRATE = ['dreams', 'profiles', 'events', 'credits', 'subscriptions', 'roles'];
const PAGE_SIZE = 1000;

async function fetchAllFromSupabase(table) {
  let all = [];
  let from = 0;
  while (true) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .range(from, to);

    if (error) {
      console.error(`Error fetching ${table} from Supabase:`, error.message || error);
      throw error;
    }

    if (!data || data.length === 0) break;

    all = all.concat(data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}

function transformRow(row) {
  const doc = { ...row };
  if (doc.id !== undefined && doc.id !== null) {
    // Keep original id as string _id for MongoDB
    doc._id = String(doc.id);
    delete doc.id;
  }
  return doc;
}

async function migrate() {
  let client = new MongoClient(MONGODB_URI);
  try {
    console.log('Connecting to MongoDB...');
    try {
      await client.connect();
    } catch (connErr) {
      console.warn('Initial MongoDB SRV connect failed, attempting SRV-resolve fallback:', connErr && connErr.message);
      // If the URI is mongodb+srv:// try to resolve hosts via nslookup and build a mongodb:// seedlist
      if (MONGODB_URI.startsWith('mongodb+srv://')) {
        const { execSync } = require('child_process');
        try {
          const srvHost = MONGODB_URI.split('@')[1].split('/')[0];
          const srvQuery = `_mongodb._tcp.${srvHost}`;
          const out = execSync(`nslookup -type=SRV ${srvQuery}`, { timeout: 5000 }).toString();
          const hosts = [];
          const lines = out.split(/\r?\n/);
          for (const line of lines) {
            const m = line.match(/svr hostname\s+=\s+(.+)$/i) || line.match(/svr hostname\s+=\s+(.+)$/i);
            if (m) hosts.push(m[1].trim());
          }
          // Fallback regex parsing when output differs
          if (hosts.length === 0) {
            for (const line of lines) {
              const mx = line.match(/\s+svr hostname\s+=\s+(.+)$/i);
              if (mx) hosts.push(mx[1].trim());
            }
          }

          if (hosts.length === 0) throw new Error('No SRV hosts found from nslookup');

          // Resolve each host to its canonical name (nslookup)
          const resolved = hosts.map((h) => {
            try {
              const r = execSync(`nslookup ${h}`, { timeout: 3000 }).toString();
              const m = r.match(/Name:\s+(.+)\r?\nAddress:\s+([0-9.]+)/i) || r.match(/Name:\s+(.+)\r?\nAddress:\s+([0-9.]+)/i);
              return m ? m[1].trim() : h;
            } catch (_) {
              return h;
            }
          });

          // Parse user/pass and db and options from original URI
          const credPart = MONGODB_URI.split('mongodb+srv://')[1].split('@')[0];
          const afterAt = MONGODB_URI.split('@')[1];
          const dbPart = afterAt.split('/')[1] || '';
          const dbName = dbPart.split('?')[0] || MONGODB_DB;

          const seedHosts = resolved.map((h) => `${h}:27017`).join(',');
          const newUri = `mongodb://${credPart}@${seedHosts}/${dbName}?retryWrites=true&w=majority&authSource=admin&tls=true`;
          console.log('Retrying with fallback URI:', newUri.replace(/(:)[^:@]+@/, ':*****@'));

          client = new MongoClient(newUri, { serverSelectionTimeoutMS: 10000 });
          await client.connect();
        } catch (srvErr) {
          console.error('SRV fallback failed:', srvErr && srvErr.message);
          throw connErr;
        }
      } else {
        throw connErr;
      }
    }
    console.log('Connected to MongoDB');
    const db = client.db(MONGODB_DB);

    for (const table of TABLES_TO_MIGRATE) {
      console.log(`Fetching ${table} from Supabase...`);
      const rows = await fetchAllFromSupabase(table);
      console.log(`Fetched ${rows.length} rows from ${table}`);

      if (rows.length === 0) {
        console.log(`No rows to migrate for ${table}, skipping.`);
        continue;
      }

      const collection = db.collection(table);

      // Prepare bulk upsert operations to avoid duplicates
      const ops = rows.map((r) => {
        const doc = transformRow(r);
        if (doc._id) {
          return {
            updateOne: {
              filter: { _id: doc._id },
              update: { $set: doc },
              upsert: true
            }
          };
        } else {
          return {
            insertOne: { document: doc }
          };
        }
      });

      console.log(`Upserting ${ops.length} documents into MongoDB collection '${table}'...`);
      const result = await collection.bulkWrite(ops, { ordered: false });
      console.log(`Collection '${table}' migration result:`, { inserted: result.insertedCount, upserted: result.upsertedCount, modified: result.modifiedCount });
    }

    console.log('Migration completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exitCode = 1;
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  migrate();
}
