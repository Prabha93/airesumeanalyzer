/**
 * Semantic text embeddings using @xenova/transformers
 * Model: Xenova/all-MiniLM-L6-v2  (~23 MB, downloaded once on first use)
 *
 * Because @xenova/transformers is an ESM-only package and this API uses CommonJS,
 * we use the `new Function()` dynamic import trick: TypeScript does NOT transform
 * code inside Function() constructors, so the output JS contains a native
 * import() call that Node 18+ can resolve to load ESM modules from a CJS host.
 */

interface EmbeddingTensor {
  data: Float32Array;
}

type FeaturePipeline = (text: string, options?: object) => Promise<EmbeddingTensor>;

let _pipeline: FeaturePipeline | null = null;
let _ready = false;

// Single shared init promise so concurrent callers wait on the same load
let _initPromise: Promise<FeaturePipeline | null> | null = null;

// In-memory embedding cache: key → float vector
// Job embeddings are stable (keyed by job ID), resume embeddings change per request
const _cache = new Map<string, number[]>();

async function initModel(): Promise<FeaturePipeline | null> {
  try {
    // new Function() bypasses TypeScript's import() → require() transform.
    // At runtime Node 18+ executes this as a real dynamic ESM import.
    const mod = await (new Function("m", "return import(m)"))("@xenova/transformers") as {
      pipeline: (task: string, model: string, opts?: object) => Promise<FeaturePipeline>;
      env: Record<string, unknown>;
    };

    // Disable browser localStorage cache — use Node filesystem cache instead
    mod.env["useBrowserCache"] = false;

    console.log("[AI] Loading Xenova/all-MiniLM-L6-v2 … (~23 MB on first run, cached after)");
    _pipeline = await mod.pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", {
      quantized: true,
    });

    _ready = true;
    console.log("[AI] Semantic embedding model ready ✓");
    return _pipeline;
  } catch (err) {
    console.warn(
      "[AI] Semantic model unavailable — rule-based scoring will be used.",
      err instanceof Error ? err.message : String(err)
    );
    return null;
  }
}

function getOrLoadPipeline(): Promise<FeaturePipeline | null> {
  if (_ready && _pipeline) return Promise.resolve(_pipeline);
  if (!_initPromise) _initPromise = initModel();
  return _initPromise;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na  += a[i] * a[i];
    nb  += b[i] * b[i];
  }
  return na === 0 || nb === 0 ? 0 : dot / (Math.sqrt(na) * Math.sqrt(nb));
}

async function embed(text: string, cacheKey: string): Promise<number[] | null> {
  if (_cache.has(cacheKey)) return _cache.get(cacheKey)!;

  const model = await getOrLoadPipeline();
  if (!model) return null;

  try {
    // Truncate to ~2 000 chars to stay well within the 512-token context window
    const tensor = await model(text.slice(0, 2000), { pooling: "mean", normalize: true });
    const vec = Array.from(tensor.data);
    _cache.set(cacheKey, vec);
    return vec;
  } catch {
    return null;
  }
}

/**
 * Returns a 0-100 score representing semantic similarity between
 * the resume text and a job posting's text.
 * Returns null if the model is not yet available.
 */
export async function computeSemanticScore(
  resumeText: string,
  jobText: string,
  jobId: string
): Promise<number | null> {
  const resumeKey = `resume:${resumeText.length}:${resumeText.slice(0, 80)}`;
  const [rv, jv] = await Promise.all([
    embed(resumeText, resumeKey),
    embed(jobText, `job:${jobId}`),
  ]);
  if (!rv || !jv) return null;

  const sim = cosineSimilarity(rv, jv);
  // Cosine range [-1, 1] → normalize to [0, 100]
  return Math.round(((sim + 1) / 2) * 100);
}

export function isSemanticModelReady(): boolean {
  return _ready;
}

/** Called once at server startup — loads the model in the background. */
export async function warmUpSemanticModel(): Promise<void> {
  await getOrLoadPipeline();
}
