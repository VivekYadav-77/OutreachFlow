import { describe, expect, it } from "vitest";
import { renderTemplate } from "./templateService.js";

describe("renderTemplate", () => {
  it("replaces supported recruiter placeholders", () => {
    const rendered = renderTemplate(
      {
        subjectTemplate: "Hello {{fullName}} at {{company}}",
        htmlTemplate: "<p>{{designation}} at {{company}}</p>",
        textTemplate: "{{fullName}} - {{designation}}"
      },
      { fullName: "Alex Morgan", company: "Acme", designation: "Talent Partner" }
    );

    expect(rendered.subject).toBe("Hello Alex Morgan at Acme");
    expect(rendered.html).toBe("<p>Talent Partner at Acme</p>");
    expect(rendered.text).toBe("Alex Morgan - Talent Partner");
  });

  it("uses Recruiter as the designation fallback and leaves unsupported placeholders untouched", () => {
    const rendered = renderTemplate(
      {
        subjectTemplate: "{{designation}} {{unknown}}",
        htmlTemplate: "<p>{{designation}} {{unknown}}</p>",
        textTemplate: "{{designation}} {{unknown}}"
      },
      { fullName: "Alex", company: "Acme", designation: "" }
    );

    expect(rendered.subject).toBe("Recruiter {{unknown}}");
    expect(rendered.html).toBe("<p>Recruiter {{unknown}}</p>");
    expect(rendered.text).toBe("Recruiter {{unknown}}");
  });

  it("escapes recruiter values in HTML output", () => {
    const rendered = renderTemplate(
      {
        subjectTemplate: "{{company}}",
        htmlTemplate: "<p>{{company}}</p>",
        textTemplate: "{{company}}"
      },
      { fullName: "Alex", company: "<Acme & Co>", designation: null }
    );

    expect(rendered.subject).toBe("<Acme & Co>");
    expect(rendered.html).toBe("<p>&lt;Acme &amp; Co&gt;</p>");
    expect(rendered.text).toBe("<Acme & Co>");
  });
});
