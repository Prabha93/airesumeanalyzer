import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import multer from "multer";
import { sampleJobs } from "./data/jobs";
import { buildLinkedInJobSearchUrls, fetchRemotiveJobs } from "./utils/externalJobs";
import { matchResumeToJobs } from "./utils/matcher";
import { buildResumeProfile, extractTextFromFile } from "./utils/resumeParser";

dotenv.config();

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const port = Number(process.env.PORT ?? 8080);
const allowedOrigin = process.env.WEB_ORIGIN ?? "http://localhost:5173";

app.use(cors({ origin: allowedOrigin }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/jobs", (_req, res) => {
  res.json({ jobs: sampleJobs, count: sampleJobs.length });
});

app.get("/api/jobs/search", async (req, res) => {
  try {
    const query = String(req.query.query ?? "").trim();
    const limit = Math.max(5, Math.min(Number(req.query.limit ?? 25), 100));

    const jobs = await fetchRemotiveJobs({ query, limit });
    res.json({ jobs, count: jobs.length, source: "remotive" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server error";
    res.status(500).json({ error: message });
  }
});

app.post("/api/match", upload.single("resume"), async (req, res) => {
  try {
    const topK = Math.max(1, Math.min(Number(req.query.topK ?? 5), 20));
    const query = String(req.query.query ?? "").trim();
    const location = String(req.query.location ?? "").trim();
    const useLiveJobs = String(req.query.useLiveJobs ?? "false").toLowerCase() === "true";

    if (!req.file) {
      res.status(400).json({ error: "Missing file. Upload in form-data with field name resume." });
      return;
    }

    const extractedText = await extractTextFromFile(req.file.buffer, req.file.originalname);

    if (!extractedText.trim()) {
      res.status(400).json({ error: "Could not extract text from uploaded resume." });
      return;
    }

    const profile = buildResumeProfile(extractedText);

    let selectedJobs = sampleJobs;
    let source: "sample" | "remotive" = "sample";
    let fallbackReason: string | undefined;

    if (useLiveJobs) {
      try {
        const liveJobs = await fetchRemotiveJobs({ query, limit: 40 });
        if (liveJobs.length > 0) {
          selectedJobs = liveJobs;
          source = "remotive";
        } else {
          fallbackReason = "No live jobs returned, used sample jobs instead.";
        }
      } catch (liveError) {
        fallbackReason =
          liveError instanceof Error
            ? `Live job fetch failed, used sample jobs instead: ${liveError.message}`
            : "Live job fetch failed, used sample jobs instead.";
      }
    }

    const rankedMatches = matchResumeToJobs(profile, selectedJobs).slice(0, topK);

    const preferredRoleTerms = [
      "ai engineer",
      "machine learning engineer",
      "data scientist",
      "backend engineer",
      "full stack developer",
      "mlops engineer",
      "data analyst"
    ];

    const titleTerms = rankedMatches.slice(0, 3).map((entry) => entry.job.title.toLowerCase());

    const recommendedSearchQueries = [
      ...new Set(
        [...titleTerms, ...preferredRoleTerms, ...profile.detectedSkills]
          .map((term) => term.trim().toLowerCase())
          .filter((term) => term.length >= 4)
      )
    ].slice(0, 5);

    const linkedinJobSearchUrls = buildLinkedInJobSearchUrls(recommendedSearchQueries, location);

    res.json({
      profile: {
        detectedSkills: profile.detectedSkills,
        inferredRoleKeywords: profile.inferredRoleKeywords,
        yearsOfExperience: profile.yearsOfExperience,
        educationKeywords: profile.educationKeywords
      },
      matches: rankedMatches,
      totalJobs: selectedJobs.length,
      source,
      fallbackReason,
      profileSuggestions: {
        recommendedSearchQueries,
        linkedinJobSearchUrls
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server error";
    res.status(500).json({ error: message });
  }
});

app.listen(port, () => {
  console.log(`AI Resume Analyzer API running on http://localhost:${port}`);
});
