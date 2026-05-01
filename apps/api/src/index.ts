import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import multer from "multer";
import { sampleJobs } from "./data/jobs";
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

app.post("/api/match", upload.single("resume"), async (req, res) => {
  try {
    const topK = Math.max(1, Math.min(Number(req.query.topK ?? 5), 20));

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
    const rankedMatches = matchResumeToJobs(profile, sampleJobs).slice(0, topK);

    res.json({
      profile: {
        detectedSkills: profile.detectedSkills,
        inferredRoleKeywords: profile.inferredRoleKeywords,
        yearsOfExperience: profile.yearsOfExperience,
        educationKeywords: profile.educationKeywords
      },
      matches: rankedMatches,
      totalJobs: sampleJobs.length
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server error";
    res.status(500).json({ error: message });
  }
});

app.listen(port, () => {
  console.log(`AI Resume Analyzer API running on http://localhost:${port}`);
});
