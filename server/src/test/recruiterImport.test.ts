import { beforeEach, describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";

const mocks = vi.hoisted(() => {
  const insertedRecruiters: Array<Record<string, unknown>> = [];
  const insertedLogs: Array<Record<string, unknown>> = [];
  const defaultTemplate = {
    id: 7,
    name: "Default",
    subjectTemplate: "Hello",
    htmlTemplate: "<p>Hello</p>",
    textTemplate: "Hello",
    isDefault: true
  };

  return {
    insertedRecruiters,
    insertedLogs,
    defaultTemplate,
    reset() {
      insertedRecruiters.length = 0;
      insertedLogs.length = 0;
    },
    db: {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          innerJoin: vi.fn(() => ({
            where: vi.fn(async () => [])
          })),
          where: vi.fn(() => ({
            limit: vi.fn(async () => [defaultTemplate])
          }))
        }))
      })),
      insert: vi.fn(() => ({
        values: vi.fn(async (value: Record<string, unknown>) => {
          if ("email" in value) {
            insertedRecruiters.push(value);
          } else {
            insertedLogs.push(value);
          }
        })
      }))
    }
  };
});

vi.mock("../database/db.js", () => ({ db: mocks.db }));

const { importRecruitersFromCsv, importRecruitersFromExcel, importRecruitersFromRows, isRecruiterVisibleInContactPool } = await import("../services/recruiterService.js");

function workbookBuffer(rows: unknown[][]) {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, "Recruiters");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

describe("recruiter file imports", () => {
  beforeEach(() => {
    mocks.reset();
    vi.clearAllMocks();
  });

  it("keeps existing CSV import behavior", async () => {
    const result = await importRecruitersFromCsv("fullName,company,email,designation,linkedin,notes\nAlex Doe,Acme,alex@example.com,HR,https://example.com,Follow up");

    expect(result).toMatchObject({ imported: 1, duplicates: 0, invalid: 0, skipped: 0, errors: [] });
    expect(mocks.insertedRecruiters).toHaveLength(1);
    expect(mocks.insertedRecruiters[0]).toMatchObject({
      fullName: "Alex Doe",
      company: "Acme",
      email: "alex@example.com",
      designation: "HR",
      linkedin: "https://example.com",
      notes: "Follow up",
      templateId: 7
    });
  });

  it("imports .xlsx rows with the same headers", async () => {
    const result = await importRecruitersFromExcel(workbookBuffer([
      ["fullName", "company", "email", "designation", "linkedin", "notes"],
      ["Priya Shah", "Globex", "PRIYA@EXAMPLE.COM", "Talent", "", "Warm lead"]
    ]));

    expect(result).toMatchObject({ imported: 1, duplicates: 0, invalid: 0, skipped: 0, errors: [] });
    expect(mocks.insertedRecruiters[0]).toMatchObject({
      fullName: "Priya Shah",
      company: "Globex",
      email: "priya@example.com",
      designation: "Talent",
      notes: "Warm lead",
      templateId: 7
    });
  });

  it("imports sample-style Excel headers and skips section rows", async () => {
    const result = await importRecruitersFromExcel(workbookBuffer([
      ["S.No", "Name", "Title", "Company", "Category", "Email"],
      ["TIER 1 - MNC / PRODUCT & FUNDED COMPANIES - 209 CONTACTS", "", "", "", "", ""],
      ["1", "Reena Vijayanand", "Head HR - Data Center", "AdaniConneX", "MNC / Product & Funded Companies", "reena.v@adani.com"],
      ["2", "Puja Gupta", "Associate Director Human Resources", "Affle", "MNC / Product & Funded Companies", "puja@affle.com"]
    ]));

    expect(result.imported).toBe(2);
    expect(result.skipped).toBe(1);
    expect(result.errors[0]).toMatchObject({ row: 1, reason: "Missing required field(s): fullName, company, email" });
    expect(mocks.insertedRecruiters[0]).toMatchObject({
      fullName: "Reena Vijayanand",
      designation: "Head HR - Data Center",
      company: "AdaniConneX",
      notes: "MNC / Product & Funded Companies",
      email: "reena.v@adani.com"
    });
  });

  it("maps mixed-case and spaced headers", async () => {
    const result = await importRecruitersFromCsv("Full Name,Company Name,EMAIL ADDRESS,Job Title\nSam Lee,Initech,SAM@EXAMPLE.COM,People Partner");

    expect(result).toMatchObject({ imported: 1, duplicates: 0, invalid: 0, skipped: 0, errors: [] });
    expect(mocks.insertedRecruiters[0]).toMatchObject({
      fullName: "Sam Lee",
      company: "Initech",
      email: "sam@example.com",
      designation: "People Partner"
    });
  });

  it("detects an email column from values when the email header is uncommon", async () => {
    const result = await importRecruitersFromCsv("Name,Company,Reach Out\nNina Patel,Umbrella,nina@example.com");

    expect(result).toMatchObject({ imported: 1, duplicates: 0, invalid: 0, skipped: 0, errors: [] });
    expect(mocks.insertedRecruiters[0]).toMatchObject({
      fullName: "Nina Patel",
      company: "Umbrella",
      email: "nina@example.com"
    });
  });

  it("returns a clear validation error when no email column is detectable", async () => {
    await expect(importRecruitersFromExcel(workbookBuffer([
      ["fullName", "company"],
      ["Sam Lee", "Initech"]
    ]))).rejects.toThrow("Excel does not include a recognizable email column");
  });

  it("returns a clear validation error when no contact columns are recognizable", async () => {
    await expect(importRecruitersFromExcel(workbookBuffer([
      ["Email", "Department"],
      ["person@example.com", "People"]
    ]))).rejects.toThrow("Excel does not include recognizable contact columns");
  });

  it("handles an empty Excel sheet without crashing", async () => {
    const result = await importRecruitersFromExcel(workbookBuffer([]));

    expect(result).toMatchObject({ imported: 0, duplicates: 0, invalid: 0, skipped: 0, errors: [] });
    expect(mocks.insertedRecruiters).toHaveLength(0);
  });

  it("keeps duplicate and invalid email handling unchanged", async () => {
    const result = await importRecruitersFromRows([
      { fullName: "Alex Doe", company: "Acme", email: "alex@example.com" },
      { fullName: "Alex Duplicate", company: "Acme", email: "alex@example.com" },
      { fullName: "Bad Email", company: "Acme", email: "not-an-email" }
    ]);

    expect(result.imported).toBe(1);
    expect(result.duplicates).toBe(1);
    expect(result.invalid).toBe(1);
    expect(result.errors).toEqual([{ row: 3, reason: "Invalid email address" }]);
    expect(mocks.insertedRecruiters).toHaveLength(1);
  });
});

describe("recruiter contact pool visibility", () => {
  it("keeps manually added and CSV or Excel imported recruiters visible before successful worker execution", () => {
    expect(isRecruiterVisibleInContactPool({ importedFromGmail: false, status: "Pending" })).toBe(true);
    expect(isRecruiterVisibleInContactPool({ importedFromGmail: false, status: "NEW" })).toBe(true);
    expect(isRecruiterVisibleInContactPool({ importedFromGmail: false, status: "QUEUED" })).toBe(true);
  });

  it("hides Gmail sent-history imports from the Recruiters contact pool", () => {
    expect(isRecruiterVisibleInContactPool({ importedFromGmail: true, status: "Pending" })).toBe(false);
  });

  it("hides recruiters successfully executed by the email worker", () => {
    expect(isRecruiterVisibleInContactPool({ importedFromGmail: false, status: "Sent" })).toBe(false);
    expect(isRecruiterVisibleInContactPool({ importedFromGmail: false, status: "ACCEPTED_BY_GMAIL" })).toBe(false);
    expect(isRecruiterVisibleInContactPool({ importedFromGmail: false, status: "COMPLETED" })).toBe(false);
    expect(isRecruiterVisibleInContactPool({ importedFromGmail: false, status: "Pending", hasSentQueueJob: true })).toBe(false);
    expect(isRecruiterVisibleInContactPool({ importedFromGmail: false, status: "Pending", hasQueueSentAt: true })).toBe(false);
  });

  it("keeps failed recruiters visible so they can be reviewed or fixed", () => {
    expect(isRecruiterVisibleInContactPool({ importedFromGmail: false, status: "Failed" })).toBe(true);
    expect(isRecruiterVisibleInContactPool({ importedFromGmail: false, status: "TEMPORARY_FAILURE" })).toBe(true);
    expect(isRecruiterVisibleInContactPool({ importedFromGmail: false, status: "INVALID_ADDRESS" })).toBe(true);
  });
});
