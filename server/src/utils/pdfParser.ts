import fs from "node:fs/promises";
// @ts-ignore
import pdf from "pdf-parse";

export async function parsePdf(filePath: string): Promise<string> {
  const dataBuffer = await fs.readFile(filePath);
  const parsed = await pdf(dataBuffer);
  return parsed.text;
}
