import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import multer from "multer";
import { sampleJobs } from "./data/jobs";
import { buildLinkedInJobSearchUrls, fetchAllLiveJobs } from "./utils/externalJobs";
import { enrichWithSemanticScores, matchResumeToJobs } from "./utils/matcher";
import { buildResumeProfile, extractTextFromFile } from "./utils/resumeParser";
import { isSemanticModelReady, warmUpSemanticModel } from "./utils/embedder";

dotenv.config();

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const port = Number(process.env.PORT ?? 8080);
const allowedOrigin = process.env.WEB_ORIGIN ?? "http://localhost:5173";

app.use(cors({ origin: allowedOrigin }));
app.use(express.json());

// Warm up the semantic model in the background — server starts immediately,
// model becomes available within 30-60 s on first run (downloads ~23 MB once).
warmUpSemanticModel().catch(() => {});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/model/status", (_req, res) => {
  res.json({
    ready: isSemanticModelReady(),
    model: "Xenova/all-MiniLM-L6-v2",
    type: isSemanticModelReady() ? "hybrid (rule-based + semantic)" : "rule-based"
  });
});

app.get("/api/jobs", (_req, res) => {
  res.json({ jobs: sampleJobs, count: sampleJobs.length });
});

app.get("/api/jobs/search", async (req, res) => {
  try {
    const query = String(req.query.query ?? "").trim();
    const limit = Math.max(5, Math.min(Number(req.query.limit ?? 25), 100));

    const { jobs, sources } = await fetchAllLiveJobs({ query, limit });
    res.json({ jobs, count: jobs.length, sources });
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

    // --- Job source selection ---
    let selectedJobs = sampleJobs;
    let liveSources: string[] = [];
    let fallbackReason: string | undefined;

    if (useLiveJobs) {
      try {
        const { jobs: liveJobs, sources } = await fetchAllLiveJobs({ query, limit: 40 });
        if (liveJobs.length > 0) {
          selectedJobs = liveJobs;
          liveSources = sources;
        } else {
          fallbackReason = "No live jobs returned — used sample jobs instead.";
        }
      } catch (liveError) {
        fallbackReason =
          liveError instanceof Error
            ? `Live job fetch failed (${liveError.message}) — used sample jobs.`
            : "Live job fetch failed — used sample jobs.";
      }
    }

    // --- Rule-based matching ---
    const rankedMatches = matchResumeToJobs(profile, selectedJobs).slice(0, topK);

    // --- Semantic enrichment (hybrid AI scoring if model is ready) ---
    if (isSemanticModelReady()) {
      await enrichWithSemanticScores(profile.rawText, rankedMatches);
    }

    const scoringMode: "rule-based" | "hybrid" = isSemanticModelReady() ? "hybrid" : "rule-based";

    // --- LinkedIn search suggestions ---
    const preferredRoleTerms = [
      "ai engineer", "machine learning engineer", "data scientist",
      "backend engineer", "full stack developer", "mlops engineer", "data analyst"
    ];
    const titleTerms = rankedMatches.slice(0, 3).map((e) => e.job.title.toLowerCase());
    const recommendedSearchQueries = [
      ...new Set(
        [...titleTerms, ...preferredRoleTerms, ...profile.detectedSkills]
          .map((t) => t.trim().toLowerCase())
          .filter((t) => t.length >= 4)
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
      scoringMode,
      liveSources,
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
