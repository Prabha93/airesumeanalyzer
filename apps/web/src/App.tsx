import { useEffect, useState } from "react";
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
  scoringMode?: "rule-based" | "hybrid";
  liveSources?: string[];
  fallbackReason?: string;
  profileSuggestions?: {
    recommendedSearchQueries: string[];
    linkedinJobSearchUrls: string[];
  };
  error?: string;
};

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

function ScoreBar({ score }: { score: number }): JSX.Element {
  const color = score >= 70 ? "#0f8f72" : score >= 40 ? "#d08c0a" : "#b42318";
  return (
    <div className="scoreBarWrap">
      <div className="scoreBarTrack">
        <div className="scoreBarFill" style={{ width: `${score}%`, background: color }} />
      </div>
      <span className="scoreLabel" style={{ color }}>{score}%</span>
    </div>
  );
}

function Chip({ label, variant }: { label: string; variant: "match" | "miss" | "neutral" }): JSX.Element {
  return <span className={`chip chip--${variant}`}>{label}</span>;
}

export default function App(): JSX.Element {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<MatchApiResponse | null>(null);
  const [useLiveJobs, setUseLiveJobs] = useState(true);
  const [query, setQuery] = useState("ai engineer");
  const [location, setLocation] = useState("remote");
  const [aiReady, setAiReady] = useState(false);

  // Poll model status until AI model is warm
  useEffect(() => {
    if (aiReady) return;
    const check = async () => {
      try {
        const r = await fetch(`${API_URL}/api/model/status`);
        const j = await r.json() as { ready: boolean };
        if (j.ready) setAiReady(true);
      } catch { /* ignore */ }
    };
    check();
    const id = setInterval(check, 5000);
    return () => clearInterval(id);
  }, [aiReady]);

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
      const searchParams = new URLSearchParams({
        topK: "5",
        useLiveJobs: String(useLiveJobs),
        query,
        location
      });

      const response = await fetch(`${API_URL}/api/match?${searchParams.toString()}`, {
        method: "POST",
        body: formData
      });

      const payload = (await response.json()) as MatchApiResponse;
      if (!response.ok) throw new Error(payload.error ?? "Request failed.");
      setData(payload);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      {/* ── Hero ─────────────────────────────────────────── */}
      <header className="hero">
        <div className="heroInner">
          <div>
            <p className="kicker">Open Source · Free · No sign-up</p>
            <h1>AI Resume Analyzer</h1>
            <p className="heroSub">
              Upload your resume and instantly see how well it matches real-world job listings —
              with skill gap analysis and direct apply links.
            </p>
          </div>
          <div className="heroStats">
            <div className="stat"><span>📄</span>PDF · DOCX · TXT</div>
            <div className="stat"><span>🌐</span>Live Job Data</div>
            <div className="stat"><span>🔍</span>Skill Gap Analysis</div>
            <div className="stat"><span>🔗</span>LinkedIn Links</div>
            <div className={`stat ${aiReady ? "statAi" : "statAiLoading"}`}>
              <span>{aiReady ? "✨" : "⏳"}</span>
              {aiReady ? "AI Scoring: on" : "AI model loading…"}
            </div>
          </div>
        </div>
      </header>

      {/* ── Upload form ──────────────────────────────────── */}
      <section className="card uploadCard">
        <form onSubmit={handleAnalyze}>
          <div className="formGrid">
            <div className="formCol">
              <label className="fieldLabel">
                Role / Job Keywords
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. ai engineer" />
              </label>
              <label className="fieldLabel">
                Preferred Location
                <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. remote" />
              </label>
              <label className="toggleRow">
                <input type="checkbox" checked={useLiveJobs} onChange={(e) => setUseLiveJobs(e.target.checked)} />
                <span>Use live job listings <em>(Remotive open API)</em></span>
              </label>
            </div>

            <div className="formCol uploadCol">
              <label className="fieldLabel dropzone" htmlFor="resumeFile">
                <span className="dropIcon">📂</span>
                <span>{file ? file.name : "Click to select resume"}</span>
                <span className="dropHint">PDF, DOCX or TXT · max 5 MB</span>
              </label>
              <input
                id="resumeFile"
                type="file"
                accept=".pdf,.docx,.txt"
                className="hiddenFileInput"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <button type="submit" className="analyzeBtn" disabled={loading}>
                {loading ? (
                  <><span className="spinner" />Analyzing…</>
                ) : (
                  "Analyze Resume →"
                )}
              </button>
            </div>
          </div>
          {error ? <p className="errorBanner">{error}</p> : null}
          {data?.fallbackReason ? <p className="infoBanner">{data.fallbackReason}</p> : null}
          {data?.liveSources && data.liveSources.length > 0 && (
            <p className="infoLine">Job sources: {data.liveSources.join(" + ")}</p>
          )}
          {data?.scoringMode && (
            <p className="infoLine">
              Scoring: <strong>{data.scoringMode === "hybrid" ? "✨ AI hybrid (semantic + rule-based)" : "📏 Rule-based only"}</strong>
            </p>
          )}
        </form>
      </section>

      {/* ── Results ──────────────────────────────────────── */}
      {data && (
        <>
          {/* Resume signals */}
          <section className="card">
            <h2 className="sectionTitle">Resume Signals
              {data.profile.yearsOfExperience !== undefined && (
                <span className="badge">{data.profile.yearsOfExperience} yrs exp</span>
              )}
              {data.liveSources && data.liveSources.length > 0 && (
                <span className="badgeGray">sources: {data.liveSources.join(", ")}</span>
              )}
            </h2>
            <div className="signalsGrid">
              <div className="signalBox">
                <p className="signalHeading">Detected Skills</p>
                <div className="chips">
                  {data.profile.detectedSkills.length > 0
                    ? data.profile.detectedSkills.map((s) => <Chip key={s} label={s} variant="neutral" />)
                    : <span className="dimText">None detected</span>}
                </div>
              </div>
              <div className="signalBox">
                <p className="signalHeading">Education Keywords</p>
                <div className="chips">
                  {data.profile.educationKeywords.length > 0
                    ? data.profile.educationKeywords.map((s) => <Chip key={s} label={s} variant="neutral" />)
                    : <span className="dimText">None detected</span>}
                </div>
              </div>
            </div>
          </section>

          {/* LinkedIn search suggestions */}
          {data.profileSuggestions && data.profileSuggestions.linkedinJobSearchUrls.length > 0 && (
            <section className="card">
              <h2 className="sectionTitle">LinkedIn Job Search Suggestions</h2>
              <p className="dimText">Based on your profile, open these searches directly on LinkedIn:</p>
              <div className="linkPills">
                {data.profileSuggestions.linkedinJobSearchUrls.map((url, i) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="linkedinPill"
                  >
                    🔗 {data.profileSuggestions!.recommendedSearchQueries[i] ?? "Search"}
                  </a>
                ))}
              </div>
            </section>
          )}

          {/* Job matches */}
          <section className="card">
            <h2 className="sectionTitle">
              Top Job Matches
              <span className="badgeGray">{data.matches.length} of {data.totalJobs} jobs scored</span>
            </h2>
            {data.matches.length === 0 ? (
              <p className="dimText">No matches found — try different keywords.</p>
            ) : (
              <div className="jobs">
                {data.matches.map((entry, index) => (
                  <article key={entry.job.id} className="job">
                    <div className="jobTop">
                      <div className="jobMeta">
                        <div className="jobRank">#{index + 1}</div>
                        <div>
                          <h3 className="jobTitle">{entry.job.title}</h3>
                          <p className="jobSub">
                            {entry.job.company} &nbsp;·&nbsp; {entry.job.location} &nbsp;·&nbsp;
                            <span className="levelBadge">{entry.job.experienceLevel}</span>
                          </p>
                        </div>
                      </div>
                      <ScoreBar score={entry.match.score} />
                    </div>

                    <div className="jobLinks">
                      {entry.job.jobUrl && (
                        <a href={entry.job.jobUrl} target="_blank" rel="noreferrer" className="applyLink">Apply →</a>
                      )}
                      {entry.job.companyLinkedinUrl && (
                        <a href={entry.job.companyLinkedinUrl} target="_blank" rel="noreferrer" className="linkedInLink">LinkedIn</a>
                      )}
                    </div>

                    <div className="skillsRow">
                      <div>
                        <p className="signalHeading">Matched</p>
                        <div className="chips">
                          {entry.match.matchedSkills.length > 0
                            ? entry.match.matchedSkills.map((s) => <Chip key={s} label={s} variant="match" />)
                            : <span className="dimText">None</span>}
                        </div>
                      </div>
                      <div>
                        <p className="signalHeading">Missing</p>
                        <div className="chips">
                          {entry.match.missingSkills.length > 0
                            ? entry.match.missingSkills.map((s) => <Chip key={s} label={s} variant="miss" />)
                            : <span className="dimText">None — great fit!</span>}
                        </div>
                      </div>
                    </div>

                    <details className="reasonDetails">
                      <summary>Score breakdown</summary>
                      <ul>
                        {entry.match.reasons.map((r) => <li key={r}>{r}</li>)}
                      </ul>
                      {entry.match.semanticScore !== undefined && (
                        <p className="semanticNote">
                          ✨ Semantic score: {entry.match.semanticScore}% (neural embedding similarity)
                        </p>
                      )}
                    </details>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* ── Footer ───────────────────────────────────────── */}
      <footer className="footer">
        <p>
          Made with ⚡ TypeScript · ⚛️ React · 🔷 Express · 📦 open-source APIs by{" "}
          <a href="https://github.com/Prabha93" target="_blank" rel="noreferrer">Prabha93</a>
        </p>
      </footer>
    </div>
  );
}
