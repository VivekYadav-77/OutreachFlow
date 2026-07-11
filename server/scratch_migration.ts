import { db } from './src/database/db.js';
import { sql } from 'drizzle-orm';

async function run() {
  try {
    console.log('Creating email_template_attachments table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "email_template_attachments" (
        "template_id" integer NOT NULL,
        "file_id" integer NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "email_template_attachments_pk" PRIMARY KEY("template_id","file_id")
      );
    `);
    console.log('Table created or already exists.');

    console.log('Adding template_id foreign key constraint...');
    await db.execute(sql`
      DO $$ BEGIN
        ALTER TABLE "email_template_attachments" 
        ADD CONSTRAINT "email_template_attachments_template_id_email_templates_id_fk" 
        FOREIGN KEY ("template_id") REFERENCES "public"."email_templates"("id") ON DELETE cascade ON UPDATE no action;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    console.log('Adding file_id foreign key constraint...');
    await db.execute(sql`
      DO $$ BEGIN
        ALTER TABLE "email_template_attachments" 
        ADD CONSTRAINT "email_template_attachments_file_id_uploaded_files_id_fk" 
        FOREIGN KEY ("file_id") REFERENCES "public"."uploaded_files"("id") ON DELETE cascade ON UPDATE no action;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    console.log('Migration completed successfully.');
  } catch(e) {
    console.error('Migration failed:', e);
  }
  process.exit(0);
}
run();
