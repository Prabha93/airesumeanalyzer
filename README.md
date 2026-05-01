# AI Resume Analyzer + Job Matcher

Upload a resume (PDF, DOCX, TXT) and instantly see how well it matches real-world job listings — with skill-gap analysis, explainable scoring, and direct LinkedIn / apply links.

No sign-up. No API key. Fully open-source.

---

## What This Tool Does

1. **Parse** — Extracts text from an uploaded resume using open-source libraries.
2. **Signal extraction** — Detects skills, infers years of experience, and identifies education keywords.
3. **Live job fetch** — Pulls real remote job listings from the Remotive open API.
4. **Score** — Scores each job against the resume using a transparent weighted model:
   - Required skill coverage (60%)
   - Nice-to-have skill coverage (15%)
   - Role keyword fit (15%)
   - Experience level fit (10%)
5. **Explain** — Returns matched skills, missing skills, and per-dimension score breakdown.
6. **Suggest** — Generates LinkedIn job search URLs tailored to your profile.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, TypeScript |
| Backend API | Node.js, Express, TypeScript, tsx (dev) |
| Resume parsing | pdf-parse (PDF), mammoth (DOCX) |
| Job data | Remotive open API (remote jobs) |
| Shared types | TypeScript monorepo package |
| Monorepo | npm workspaces |

---

## Architecture

```mermaid
flowchart TD
    User(["👤 User\n(Browser)"])

    subgraph Web["Frontend — React + Vite :5173"]
        UI["Upload Form\nJob keywords · Location · Live toggle"]
        Results["Results Dashboard\nScore bars · Skill chips · Apply links"]
    end

    subgraph API["Backend — Express API :8080"]
        Router["/api/match"]

        subgraph Parse["Resume Processing"]
            Extractor["Text Extractor\npdf-parse · mammoth · plain text"]
            Profiler["Profile Builder\nSkill taxonomy · Experience regex\n→ ResumeProfile"]
        end

        subgraph Jobs["Job Ingestion"]
            Remotive["Remotive Adapter\nGET remotive.com/api/remote-jobs\nNormalise → JobPosting[]"]
            SampleFallback["Sample Jobs Fallback\n(if live fetch fails)"]
        end

        Matcher["Scoring Engine\nRequired coverage × 0.60\nNice-to-have × 0.15\nRole keyword fit × 0.15\nExperience fit × 0.10\n→ ranked MatchResult[]"]

        Suggest["Suggestion Builder\nLinkedIn job search URLs\nRecommended role queries"]
    end

    ExternalAPI(["🌐 Remotive\nOpen Jobs API"])

    User -->|"Upload resume\n+ search params"| UI
    UI -->|"POST /api/match\nmultipart form-data"| Router
    Router --> Extractor
    Extractor --> Profiler
    Router --> Remotive
    Remotive -->|"fetch"| ExternalAPI
    ExternalAPI -->|"job listings"| Remotive
    Remotive -->|"JobPosting[]"| Matcher
    SampleFallback -.->|"fallback"| Matcher
    Profiler -->|"ResumeProfile"| Matcher
    Matcher -->|"MatchResult[]"| Suggest
    Suggest -->|"{ profile, matches,\nprofileSuggestions }"| Results
    Results --> User
```

---

## File Structure

```
airesumeanalyzer/
├── apps/
│   ├── api/                        # Express backend
│   │   ├── src/
│   │   │   ├── index.ts            # Server entry, routes
│   │   │   ├── data/
│   │   │   │   └── jobs.ts         # Sample job seed data
│   │   │   └── utils/
│   │   │       ├── resumeParser.ts # Text extraction + profile building
│   │   │       ├── matcher.ts      # Scoring engine
│   │   │       ├── externalJobs.ts # Remotive API adapter
│   │   │       └── skillTaxonomy.ts# Canonical skill list
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── web/                        # React frontend
│       ├── src/
│       │   ├── main.tsx            # React entry point
│       │   ├── App.tsx             # Full UI component
│       │   └── styles.css          # Design system styles
│       ├── index.html
│       ├── package.json
│       ├── tsconfig.json
│       └── vite.config.ts
│
├── packages/
│   └── shared/                     # Shared TypeScript types
│       ├── src/
│       │   └── index.ts            # JobPosting, ResumeProfile, MatchResult
│       ├── package.json
│       └── tsconfig.json
│
├── .env.example                    # Environment variable template
├── .gitignore
├── package.json                    # Root workspace + scripts
└── README.md
```

---

## How to Run Locally

**Requirements:** Node.js 18+ and npm 9+

```bash
# 1. Clone
git clone https://github.com/Prabha93/airesumeanalyzer.git
cd airesumeanalyzer

# 2. Install all dependencies (monorepo)
npm install

# 3. Start API + Web in parallel
npm run dev

# 4. Open in browser
#    Web UI  →  http://localhost:5173
#    API     →  http://localhost:8080/health
```

**Run separately if needed:**

```bash
npm run dev:api    # API only  → :8080
npm run dev:web    # Web only  → :5173
```

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Health check |
| GET | `/api/jobs` | List sample jobs |
| GET | `/api/jobs/search?query=ai engineer&limit=25` | Live job search via Remotive |
| POST | `/api/match?topK=5&useLiveJobs=true&query=ai engineer&location=remote` | Upload resume and get matches |

**POST /api/match** — form-data body with field `resume` (PDF, DOCX, or TXT).

---

## Roadmap

- [ ] Vector-based semantic matching (open-source embeddings)
- [ ] PostgreSQL + pgvector persistence
- [ ] Multi-source job ingestion (additional open job APIs)
- [ ] Authentication and saved-search history
- [ ] Automated evaluation suite with synthetic resumes

---

## License

MIT — see [LICENSE](LICENSE)
