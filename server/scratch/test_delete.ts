import { db } from "../src/database/db.js";
import { recruiters, emailTemplates, emailQueue, emailDrafts } from "../src/database/schema.js";
import { deleteRecruiter } from "../src/services/recruiterService.js";
import { setWorkerStatus } from "../src/services/settingsService.js";
import { eq } from "drizzle-orm";

async function main() {
  console.log("Starting test...");
  try {
    // 1. Create a dummy template if not exists
    let [template] = await db.select().from(emailTemplates).limit(1);
    if (!template) {
      [template] = await db.insert(emailTemplates).values({
        name: "Test Template",
        subjectTemplate: "Hello {{fullName}}",
        htmlTemplate: "<p>Hi</p>",
        textTemplate: "Hi",
        isDefault: true
      }).returning();
      console.log("Created template:", template.id);
    }

    // 2. Set worker to stopped
    await setWorkerStatus("stopped");
    console.log("Worker status set to stopped");

    // 3. Create a pending recruiter
    const [recruiter] = await db.insert(recruiters).values({
      fullName: "Test Recruiter",
      company: "Test Company",
      email: `test-${Date.now()}@example.com`,
      status: "Pending",
      templateId: template.id
    }).returning();
    console.log("Created recruiter:", recruiter.id);

    // 4. Create a draft
    const [draft] = await db.insert(emailDrafts).values({
      to: [recruiter.email],
      subject: "Test Subject",
      html: "<p>Test html</p>",
      text: "Test text",
      status: "Queued"
    }).returning();
    console.log("Created draft:", draft.id);

    // 5. Create a queue job
    const [job] = await db.insert(emailQueue).values({
      recruiterId: recruiter.id,
      draftId: draft.id,
      state: "Pending"
    }).returning();
    console.log("Created queue job:", job.id);

    // 6. Try to delete the recruiter
    console.log("Attempting to delete recruiter...");
    await deleteRecruiter(recruiter.id);
    console.log("Recruiter deleted successfully!");

  } catch (error) {
    console.error("Test failed with error:", error);
  } finally {
    process.exit(0);
  }
}

main();
