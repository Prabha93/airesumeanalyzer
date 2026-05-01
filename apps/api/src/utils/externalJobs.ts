import { JobPosting } from "@airesume/shared";
import { skillTaxonomy } from "./skillTaxonomy";

type RemotiveJob = {
  id: number;
  url: string;
  title: string;
  company_name: string;
  candidate_required_location?: string;
  description: string;
  publication_date?: string;
};

type RemotiveResponse = {
  jobs?: RemotiveJob[];
};

function stripHtmlTags(input: string): string {
  return input.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function extractSkillsFromText(text: string, maxCount = 8): string[] {
  const normalized = text.toLowerCase();
  const found = [...skillTaxonomy].filter((skill) => {
    const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\b${escaped}\\b`, "i").test(normalized);
  });

  return found.slice(0, maxCount);
}

function inferExperienceLevel(text: string): JobPosting["experienceLevel"] {
  const normalized = text.toLowerCase();

  if (/senior|lead|principal|staff/.test(normalized)) {
    return "senior";
  }

  if (/junior|entry|fresher|intern/.test(normalized)) {
    return "junior";
  }

  return "mid";
}

function buildLinkedInCompanySearchUrl(company: string): string {
  const query = encodeURIComponent(company);
  return `https://www.linkedin.com/search/results/companies/?keywords=${query}`;
}

function normalizeToJobPosting(job: RemotiveJob): JobPosting {
  const cleanDescription = stripHtmlTags(job.description ?? "");
  const skillCandidates = extractSkillsFromText(`${job.title} ${cleanDescription}`);

  return {
    id: `remotive-${job.id}`,
    title: job.title,
    company: job.company_name,
    location: job.candidate_required_location ?? "Remote",
    description: cleanDescription,
    requiredSkills: skillCandidates.slice(0, Math.max(1, Math.min(5, skillCandidates.length))),
    niceToHaveSkills: skillCandidates.slice(5, 10),
    experienceLevel: inferExperienceLevel(`${job.title} ${cleanDescription}`),
    source: "remotive",
    jobUrl: job.url,
    companyLinkedinUrl: buildLinkedInCompanySearchUrl(job.company_name),
    postedAt: job.publication_date
  };
}

export async function fetchRemotiveJobs(options?: {
  query?: string;
  limit?: number;
}): Promise<JobPosting[]> {
  const limit = Math.max(5, Math.min(options?.limit ?? 30, 100));
  const query = (options?.query ?? "").trim();

  const endpoint = query
    ? `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(query)}`
    : "https://remotive.com/api/remote-jobs";

  const response = await fetch(endpoint);
  if (!response.ok) {
    throw new Error(`Failed to fetch remote jobs (${response.status}).`);
  }

  const payload = (await response.json()) as RemotiveResponse;
  const jobs = payload.jobs ?? [];

  return jobs.slice(0, limit).map(normalizeToJobPosting);
}

export function buildLinkedInJobSearchUrls(queries: string[], location?: string): string[] {
  const locationPart = location?.trim() ? `&location=${encodeURIComponent(location.trim())}` : "";

  return queries.map((query) => {
    const keywords = encodeURIComponent(query);
    return `https://www.linkedin.com/jobs/search/?keywords=${keywords}${locationPart}`;
  });
}
