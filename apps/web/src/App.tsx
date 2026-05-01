import { useMemo, useState } from "react";
import { JobMatchWithDetails } from "@airesume/shared";

type MatchApiResponse = {
  profile: {
    detectedSkills: string[];
    inferredRoleKeywords: string[];
    yearsOfExperience?: number;
    educationKeywords: string[];
  };
  matches: JobMatchWithDetails[];
  totalJobs: number;
  error?: string;
};

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

export default function App(): JSX.Element {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<MatchApiResponse | null>(null);

  const summary = useMemo(() => {
    if (!data) {
      return null;
    }

    const top = data.matches[0];
    if (!top) {
      return "No matches were generated for this resume.";
    }

    return `Top match: ${top.job.title} at ${top.job.company} (${top.match.score}% fit)`;
  }, [data]);

  async function handleAnalyze(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);

    if (!file) {
      setError("Please select a PDF, DOCX, or TXT resume first.");
      return;
    }

    const formData = new FormData();
    formData.append("resume", file);

    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/match?topK=5`, {
        method: "POST",
        body: formData
      });

      const payload = (await response.json()) as MatchApiResponse;

      if (!response.ok) {
        throw new Error(payload.error ?? "Request failed.");
      }

      setData(payload);
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Unexpected error";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <header className="hero">
        <p className="kicker">Open Source MVP</p>
        <h1>AI Resume Analyzer + Job Matcher</h1>
        <p>
          Upload a resume and get explainable job-match scores with skill coverage and missing-skill
          insights.
        </p>
      </header>

      <main className="grid">
        <section className="card">
          <h2>1. Upload Resume</h2>
          <form onSubmit={handleAnalyze} className="stack">
            <input
              type="file"
              accept=".pdf,.docx,.txt"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <button type="submit" disabled={loading}>
              {loading ? "Analyzing..." : "Analyze Resume"}
            </button>
          </form>
          {error ? <p className="error">{error}</p> : null}
          {summary ? <p className="summary">{summary}</p> : null}
        </section>

        <section className="card">
          <h2>2. Resume Signals</h2>
          {!data ? (
            <p className="placeholder">No resume analyzed yet.</p>
          ) : (
            <div className="stack">
              <div>
                <h3>Detected Skills</h3>
                <p>{data.profile.detectedSkills.join(", ") || "None detected"}</p>
              </div>
              <div>
                <h3>Role Keywords</h3>
                <p>{data.profile.inferredRoleKeywords.join(", ") || "None detected"}</p>
              </div>
              <div>
                <h3>Estimated Experience</h3>
                <p>
                  {data.profile.yearsOfExperience !== undefined
                    ? `${data.profile.yearsOfExperience} years`
                    : "Not detected"}
                </p>
              </div>
            </div>
          )}
        </section>
      </main>

      <section className="results card">
        <h2>3. Job Matches</h2>
        {!data || data.matches.length === 0 ? (
          <p className="placeholder">Matches will appear here after analysis.</p>
        ) : (
          <div className="jobs">
            {data.matches.map((entry) => (
              <article key={entry.job.id} className="job">
                <div className="jobHeader">
                  <h3>{entry.job.title}</h3>
                  <span className="score">{entry.match.score}%</span>
                </div>
                <p className="meta">
                  {entry.job.company} • {entry.job.location} • {entry.job.experienceLevel}
                </p>
                <p>{entry.job.description}</p>
                <p>
                  <strong>Matched:</strong> {entry.match.matchedSkills.join(", ") || "None"}
                </p>
                <p>
                  <strong>Missing:</strong> {entry.match.missingSkills.join(", ") || "None"}
                </p>
                <ul>
                  {entry.match.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
