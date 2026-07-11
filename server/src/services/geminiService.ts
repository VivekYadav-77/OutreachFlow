import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../config.js";

export async function generateCoverLetter(params: {
  resumeText: string;
  role?: string;
  company?: string;
  tone: string;
  jobDescription?: string;
  focusSkills?: string[];
}): Promise<{ subject: string; html: string }> {
  if (!config.GEMINI_API_KEY || config.GEMINI_API_KEY === "your_gemini_api_key_here" || config.GEMINI_API_KEY.trim() === "") {
    throw new Error("GEMINI_API_KEY is not configured. Please add a valid Gemini API Key to your 'server/.env' file and restart the backend server process.");
  }

  const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: config.GEMINI_MODEL_NAME || "gemini-3.1-flash-lite" });

  const isGeneral = !params.role || !params.company;

  const modeInstructions = isGeneral
    ? `
- You are generating a reusable cover letter email template instead of targeting a specific company and role.
- You MUST insert Handlebars placeholders in the subject and HTML body where specific recruiter/job details belong:
  - Use \`{{company}}\` for the company name.
  - Use \`{{designation}}\` for the target job title/role.
  - Use \`{{fullName}}\` for the recruiter's name. Example: "Hi {{fullName}}," or "Dear {{fullName}},".
- Do NOT output any actual company or recruiter names. Strictly use these Handlebars template placeholders.
`
    : `
- Analyze the provided resume text and generate a cover letter tailored specifically to the target role "${params.role}" and company "${params.company}".
- If you don't know the recruiter's name, start directly with a professional greeting like "Hi," or "Dear Hiring Team,".
`;

  const systemPrompt = `
You are an elite career coach and expert copywriter. Your goal is to write a highly professional, engaging, and personalized email cover letter.
Analyze the provided resume text.

Follow these strict tone/style instructions:
- **Style/Tone**: ${params.tone}
${modeInstructions}
- Maintain professional credibility. Translate experience to match requirements.
- Structure the cover letter cleanly. Return your output strictly as a JSON object with the following JSON schema:
{
  "subject": "The subject line of the email cover letter",
  "html": "The HTML formatted body of the email cover letter. Use clean paragraphs, list items if appropriate, and spacing suitable for a professional email. Do not wrap the output in markdown code blocks like \\\`\\\`\\\`json."
}
`;

  const userContent = `
Resume Content:
---
${params.resumeText}
---

Target Role: ${params.role}
Target Company: ${params.company}
${params.jobDescription ? `Job Description / Context:\n${params.jobDescription}` : ""}
${params.focusSkills?.length ? `Focus specifically on these skills/experiences: ${params.focusSkills.join(", ")}` : ""}
`;

  const response = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: systemPrompt + "\n" + userContent }] }],
    generationConfig: {
      responseMimeType: "application/json"
    }
  });

  const text = response.response.text();
  // Strip any markdown wrappers if present
  const jsonStr = text.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
  return JSON.parse(jsonStr);
}
