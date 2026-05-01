import { JobPosting } from "@airesume/shared";

export const sampleJobs: JobPosting[] = [
  {
    id: "job-001",
    title: "AI Engineer",
    company: "Open Talent Labs",
    location: "Remote",
    description:
      "Build and deploy NLP pipelines, tune embeddings, and ship production APIs for candidate-job ranking.",
    requiredSkills: ["python", "fastapi", "nlp", "machine learning", "docker"],
    niceToHaveSkills: ["postgresql", "kubernetes", "llm", "aws"],
    experienceLevel: "mid",
    source: "sample"
  },
  {
    id: "job-002",
    title: "Full Stack Developer",
    company: "CareerForge",
    location: "Bengaluru",
    description:
      "Develop React frontend and Node APIs. Collaborate with product teams and improve test coverage.",
    requiredSkills: ["react", "typescript", "node.js", "express", "sql"],
    niceToHaveSkills: ["docker", "redis", "jest", "aws"],
    experienceLevel: "mid",
    source: "sample"
  },
  {
    id: "job-003",
    title: "Data Analyst",
    company: "Insight Harbor",
    location: "Remote",
    description:
      "Build dashboards, analyze hiring trends, and communicate insights through data storytelling.",
    requiredSkills: ["sql", "python", "excel", "tableau", "statistics"],
    niceToHaveSkills: ["power bi", "pandas", "communication"],
    experienceLevel: "junior",
    source: "sample"
  },
  {
    id: "job-004",
    title: "Backend Engineer",
    company: "MatchWorks",
    location: "Pune",
    description:
      "Design scalable backend services, maintain databases, and optimize API performance.",
    requiredSkills: ["node.js", "typescript", "postgresql", "api design", "redis"],
    niceToHaveSkills: ["kafka", "docker", "kubernetes"],
    experienceLevel: "senior",
    source: "sample"
  },
  {
    id: "job-005",
    title: "MLOps Engineer",
    company: "ModelOps Collective",
    location: "Remote",
    description:
      "Automate model deployment workflows and monitor model quality in production.",
    requiredSkills: ["python", "docker", "kubernetes", "mlops", "ci/cd"],
    niceToHaveSkills: ["terraform", "prometheus", "grafana"],
    experienceLevel: "mid",
    source: "sample"
  }
];
