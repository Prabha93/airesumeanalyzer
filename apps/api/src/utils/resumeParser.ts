import mammoth from "mammoth";
import pdfParse from "pdf-parse";
import { ResumeProfile } from "@airesume/shared";
import { roleKeywordStopwords, skillTaxonomy } from "./skillTaxonomy";

function normalize(input: string): string {
  return input.toLowerCase().replace(/\s+/g, " ").trim();
}

function extractSkills(text: string): string[] {
  const normalized = normalize(text);

  return [...skillTaxonomy].filter((skill) => {
    const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const matcher = new RegExp(`\\b${escaped}\\b`, "i");
    return matcher.test(normalized);
  });
}

function extractYearsOfExperience(text: string): number | undefined {
  const matches = [...text.matchAll(/(\d{1,2})\+?\s+years?\s+(?:of\s+)?experience/gi)];
  if (matches.length === 0) {
    return undefined;
  }

  const allYears = matches
    .map((m) => Number(m[1]))
    .filter((value) => Number.isFinite(value));

  return allYears.length > 0 ? Math.max(...allYears) : undefined;
}

function extractRoleKeywords(text: string): string[] {
  const tokens = normalize(text)
    .split(/[^a-z0-9+#./-]+/)
    .filter((token) => token.length >= 4)
    .filter((token) => !roleKeywordStopwords.has(token));

  const counts = new Map<string, number>();
  for (const token of tokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([token]) => token);
}

function extractEducationKeywords(text: string): string[] {
  const educationTerms = [
    "bachelor",
    "master",
    "phd",
    "b.tech",
    "m.tech",
    "degree",
    "computer science",
    "information technology"
  ];

  const normalized = normalize(text);
  return educationTerms.filter((term) => normalized.includes(term));
}

export async function extractTextFromFile(fileBuffer: Buffer, filename: string): Promise<string> {
  const lower = filename.toLowerCase();

  if (lower.endsWith(".pdf")) {
    const parsed = await pdfParse(fileBuffer);
    return parsed.text ?? "";
  }

  if (lower.endsWith(".docx")) {
    const result = await mammoth.extractRawText({ buffer: fileBuffer });
    return result.value ?? "";
  }

  if (lower.endsWith(".txt")) {
    return fileBuffer.toString("utf-8");
  }

  throw new Error("Unsupported file format. Please upload PDF, DOCX, or TXT.");
}

export function buildResumeProfile(resumeText: string): ResumeProfile {
  return {
    rawText: resumeText,
    detectedSkills: extractSkills(resumeText),
    inferredRoleKeywords: extractRoleKeywords(resumeText),
    yearsOfExperience: extractYearsOfExperience(resumeText),
    educationKeywords: extractEducationKeywords(resumeText)
  };
}
