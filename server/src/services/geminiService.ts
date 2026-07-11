import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../config.js";

export async function generateCoverLetter(params: {
  resumeText: string;
  role: string;
  company: string;
  tone: string;
  jobDescription?: string;
  focusSkills?: string[];
}): Promise<{ subject: string; html: string }> {
  if (!config.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured in environment variables");
  }

  const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const systemPrompt = `
You are an elite career coach and expert copywriter. Your goal is to write a highly professional, engaging, and personalized email cover letter.
Analyze the provided resume text and generate a cover letter tailored specifically to the target role and company.

Follow these strict tone/style instructions:
- **Style/Tone**: ${params.tone}
- Do NOT use generic placeholders like "[Insert Date]", "[Recruiter Name]" or similar bracketed expressions. If you don't know the recruiter's name, start directly with a professional greeting like "Hi," or "Dear Hiring Team,".
- Maintain professional credibility. Translate experience to match target job requirements.
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
