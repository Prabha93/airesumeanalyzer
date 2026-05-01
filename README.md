# AI Resume Analyzer + Job Matcher

Open-source-friendly monorepo for analyzing resumes and matching them to job postings with transparent scoring.

## Tech Stack

- API: Node.js, TypeScript, Express, Multer, pdf-parse, mammoth
- Web: React + Vite + TypeScript
- Shared contracts: TypeScript package in monorepo

## Monorepo Layout

- apps/api: Resume parsing and matching API
- apps/web: Upload and results dashboard
- packages/shared: Shared types and models

## Features in this MVP

- Upload resume files in PDF, DOCX, or TXT format
- Extract text and detect skills from a predefined taxonomy
- Compute explainable match score against sample job postings
- Show matched/missing skills and scoring breakdown in UI

## Local Setup

1. Install dependencies:
   npm install
2. Start API + Web together:
   npm run dev
3. Open the web app:
   http://localhost:5173

API runs on http://localhost:8080 by default.

## API Endpoints

- GET /health
- GET /api/jobs
- POST /api/match?topK=5
  - form-data field: resume (PDF, DOCX, or TXT)

## Roadmap for Open Source Growth

1. Replace sample jobs with external connectors and scheduled ingestion.
2. Add vector-based semantic matching using open-source embeddings.
3. Add PostgreSQL + pgvector persistence.
4. Add authentication and multi-tenant candidate/job spaces.
5. Add automated evaluation and benchmark datasets.

## Push to GitHub

After verifying locally:

1. git add .
2. git commit -m "feat: scaffold AI resume analyzer monorepo MVP"
3. git push origin main

## License

MIT
