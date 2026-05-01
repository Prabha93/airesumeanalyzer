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
  score: number;
  matchedSkills: string[];
  missingSkills: string[];
  reasons: string[];
}

export interface JobMatchWithDetails {
  job: JobPosting;
  match: MatchResult;
}
