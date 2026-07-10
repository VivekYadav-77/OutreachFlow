import { db } from './src/database/db.js';
import { sql } from 'drizzle-orm';

async function run() {
  try {
    await db.execute(sql`ALTER TABLE settings ADD COLUMN gemini_api_key text;`);
    console.log('Added gemini_api_key');
  } catch(e) {
    console.error('Error adding column, might already exist:', e);
  }
  process.exit(0);
}
run();
