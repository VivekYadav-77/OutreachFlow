import { db } from "./src/database/db.js";
import { recruiters, emailDrafts, emailQueue } from "./src/database/schema.js";
import { eq, like, or, sql } from "drizzle-orm";

async function main() {
  try {
    const r = await db.select().from(recruiters).where(eq(recruiters.email, "britto@xoxoday.com"));
    console.log("Recruiters:", JSON.stringify(r, null, 2));

    const d = await db.execute(sql`SELECT * FROM email_drafts WHERE "to"::text LIKE '%britto@xoxoday.com%'`);
    console.log("Email Drafts:", JSON.stringify(d.rows, null, 2));
    
    if (r.length > 0) {
        const q = await db.select().from(emailQueue).where(eq(emailQueue.recruiterId, r[0].id));
        console.log("Queue for recruiter:", JSON.stringify(q, null, 2));
    }
    
    if (d.rows.length > 0) {
        const d_ids = d.rows.map((row: any) => row.id);
        const q2 = await db.execute(sql`SELECT * FROM email_queue WHERE draft_id IN (${sql.join(d_ids, sql`, `)})`);
        console.log("Queue for drafts:", JSON.stringify(q2.rows, null, 2));
    }
    
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}

main();
