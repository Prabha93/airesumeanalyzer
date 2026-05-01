import { JobMatchWithDetails, JobPosting, MatchResult, ResumeProfile } from "@airesume/shared";
import { computeSemanticScore } from "./embedder";

function toSet(values: string[]): Set<string> {
  return new Set(values.map((v) => v.toLowerCase().trim()));
}

function calculateRoleFit(resume: ResumeProfile, job: JobPosting): number {
  const haystack = `${job.title} ${job.description}`.toLowerCase();
  if (resume.inferredRoleKeywords.length === 0) {
    return 0;
  }

  const keywordHits = resume.inferredRoleKeywords.filter((keyword) => haystack.includes(keyword));
  return keywordHits.length / resume.inferredRoleKeywords.length;
}

function calculateExperienceFit(resume: ResumeProfile, level: JobPosting["experienceLevel"]): number {
  if (resume.yearsOfExperience === undefined) {
    return 0.5;
  }

  if (level === "junior") {
    return resume.yearsOfExperience >= 0 ? 1 : 0;
  }

  if (level === "mid") {
    return resume.yearsOfExperience >= 2 ? 1 : 0.4;
  }

  return resume.yearsOfExperience >= 5 ? 1 : 0.2;
}

export function matchResumeToJobs(resume: ResumeProfile, jobs: JobPosting[]): JobMatchWithDetails[] {
  const resumeSkills = toSet(resume.detectedSkills);

  const ranked = jobs.map((job) => {
    const required = job.requiredSkills.map((s) => s.toLowerCase());
    const niceToHave = job.niceToHaveSkills.map((s) => s.toLowerCase());

    const matchedRequired = required.filter((skill) => resumeSkills.has(skill));
    const missingRequired = required.filter((skill) => !resumeSkills.has(skill));
    const matchedNiceToHave = niceToHave.filter((skill) => resumeSkills.has(skill));

    const requiredCoverage = required.length > 0 ? matchedRequired.length / required.length : 0;
    const niceCoverage = niceToHave.length > 0 ? matchedNiceToHave.length / niceToHave.length : 0;
    const roleFit = calculateRoleFit(resume, job);
    const experienceFit = calculateExperienceFit(resume, job.experienceLevel);

    const weightedScore =
      requiredCoverage * 0.6 + niceCoverage * 0.15 + roleFit * 0.15 + experienceFit * 0.1;

    const match: MatchResult = {
      jobId: job.id,
      score: Math.round(weightedScore * 100),
      matchedSkills: [...matchedRequired, ...matchedNiceToHave],
      missingSkills: missingRequired,
      reasons: [
        `Required skill coverage: ${Math.round(requiredCoverage * 100)}%`,
        `Nice-to-have coverage: ${Math.round(niceCoverage * 100)}%`,
        `Role keyword fit: ${Math.round(roleFit * 100)}%`,
        `Experience fit: ${Math.round(experienceFit * 100)}%`
      ]
    };

    return { job, match };
  });

  return ranked.sort((a, b) => b.match.score - a.match.score);
}

/**
 * Async post-processing step: adds a semantic similarity score from the
 * embedding model to each result and blends it into the final score.
 * Mutates `results` in place (updates scores + re-sorts).
 * No-op when the model is unavailable (scores stay rule-based).
 */
export async function enrichWithSemanticScores(
  resumeText: string,
  results: JobMatchWithDetails[]
): Promise<void> {
  await Promise.all(
    results.map(async (entry) => {
      const jobText = `${entry.job.title} ${entry.job.description}`;
      const semScore = await computeSemanticScore(resumeText, jobText, entry.job.id);

      if (semScore !== null) {
        entry.match.semanticScore = semScore;
        // Hybrid blend: 55% rule-based signal + 45% neural semantic score
        entry.match.score = Math.round(entry.match.score * 0.55 + semScore * 0.45);
        entry.match.reasons.push(`Semantic similarity: ${semScore}%`);
      }
    })
  );

  // Re-sort by updated hybrid scores
  results.sort((a, b) => b.match.score - a.match.score);
}
