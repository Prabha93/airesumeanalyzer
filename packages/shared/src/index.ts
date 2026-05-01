export type ExperienceLevel = "junior" | "mid" | "senior";

export interface JobPosting {
  id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  requiredSkills: string[];
  niceToHaveSkills: string[];
  experienceLevel: ExperienceLevel;
  source?: "sample" | "remotive" | "arbeitnow";
  jobUrl?: string;
  companyLinkedinUrl?: string;
  postedAt?: string;
}

export interface ResumeProfile {
  rawText: string;
  detectedSkills: string[];
  inferredRoleKeywords: string[];
  yearsOfExperience?: number;
  educationKeywords: string[];
}

export interface MatchResult {
  jobId: string;
  /** Hybrid score (rule-based + semantic when AI model is loaded), 0–100 */
  score: number;
  /** Raw semantic cosine-similarity score from the embedding model, 0–100 */
  semanticScore?: number;
  matchedSkills: string[];
  missingSkills: string[];
  reasons: string[];
}

export interface JobMatchWithDetails {
  job: JobPosting;
  match: MatchResult;
}
