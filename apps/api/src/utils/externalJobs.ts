import { JobPosting } from "@airesume/shared";
import { skillTaxonomy } from "./skillTaxonomy";

// ── Shared helpers ──────────────────────────────────────────────

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

type ArbeitnowJob = {
  slug: string;
  company_name: string;
  title: string;
  description: string;
  remote: boolean;
  url: string;
  tags: string[];
  location: string;
  created_at?: number;
};

type ArbeitnowResponse = {
  data?: ArbeitnowJob[];
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

// ── Remotive ────────────────────────────────────────────────

function normalizeRemotiveJob(job: RemotiveJob): JobPosting {
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
    throw new Error(`Failed to fetch Remotive jobs (${response.status}).`);
  }

  const payload = (await response.json()) as RemotiveResponse;
  return (payload.jobs ?? []).slice(0, limit).map(normalizeRemotiveJob);
}

// ── Arbeitnow (free, no auth required) ──────────────────────────
// Note: Arbeitnow focuses on EU tech roles and is fully open (no key needed).
// LinkedIn does NOT provide a free public jobs API — it requires business
// partnership approval. LinkedIn search *links* are generated separately.

function normalizeArbeitnowJob(job: ArbeitnowJob): JobPosting {
  const cleanDescription = stripHtmlTags(job.description ?? "");
  const skillCandidates = extractSkillsFromText(`${job.title} ${cleanDescription}`);

  return {
    id: `arbeitnow-${job.slug}`,
    title: job.title,
    company: job.company_name,
    location: job.remote ? "Remote" : (job.location || "Unspecified"),
    description: cleanDescription,
    requiredSkills: skillCandidates.slice(0, 5),
    niceToHaveSkills: skillCandidates.slice(5, 10),
    experienceLevel: inferExperienceLevel(`${job.title} ${cleanDescription}`),
    source: "arbeitnow",
    jobUrl: job.url,
    companyLinkedinUrl: buildLinkedInCompanySearchUrl(job.company_name),
    postedAt: job.created_at ? new Date(job.created_at * 1000).toISOString() : undefined
  };
}

export async function fetchArbeitnowJobs(options?: {
  query?: string;
  limit?: number;
}): Promise<JobPosting[]> {
  const limit = Math.max(5, Math.min(options?.limit ?? 20, 50));
  const query = (options?.query ?? "").trim();

  const endpoint = query
    ? `https://arbeitnow.com/api/job-board-api?search=${encodeURIComponent(query)}`
    : "https://arbeitnow.com/api/job-board-api";

  const response = await fetch(endpoint);
  if (!response.ok) {
    throw new Error(`Failed to fetch Arbeitnow jobs (${response.status}).`);
  }

  const payload = (await response.json()) as ArbeitnowResponse;
  return (payload.data ?? []).slice(0, limit).map(normalizeArbeitnowJob);
}

// ── Combined live fetch ─────────────────────────────────────────

export async function fetchAllLiveJobs(options?: {
  query?: string;
  limit?: number;
}): Promise<{ jobs: JobPosting[]; sources: string[] }> {
  const limit = options?.limit ?? 30;
  const perSource = Math.ceil(limit / 2);

  const [remotiveResult, arbeitnowResult] = await Promise.allSettled([
    fetchRemotiveJobs({ query: options?.query, limit: perSource }),
    fetchArbeitnowJobs({ query: options?.query, limit: perSource }),
  ]);

  const jobs: JobPosting[] = [];
  const sources: string[] = [];

  if (remotiveResult.status === "fulfilled" && remotiveResult.value.length > 0) {
    jobs.push(...remotiveResult.value);
    sources.push("remotive");
  }
  if (arbeitnowResult.status === "fulfilled" && arbeitnowResult.value.length > 0) {
    jobs.push(...arbeitnowResult.value);
    sources.push("arbeitnow");
  }

  return { jobs: jobs.slice(0, limit), sources };
}

// ── LinkedIn job search URL builder ─────────────────────────────
// LinkedIn does not expose a free/open jobs API, so we generate search
// URLs that open directly in the user's browser — no API key required.

export function buildLinkedInJobSearchUrls(queries: string[], location?: string): string[] {
  const locationPart = location?.trim() ? `&location=${encodeURIComponent(location.trim())}` : "";

  return queries.map((query) => {
    const keywords = encodeURIComponent(query);
    return `https://www.linkedin.com/jobs/search/?keywords=${keywords}${locationPart}`;
  });
}
