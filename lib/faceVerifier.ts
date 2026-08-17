// HTTP client for the standalone `face-service` (Phase 0 spike — see
// office-app/FACE_VERIFICATION_TECHNICAL_DESIGN.md). Attendance/enrollment
// code depends on the `FaceVerifier` interface, not on face-service's HTTP
// details directly, so swapping the model/provider later doesn't touch
// callers.

/** Mirrors face-service's services/quality.ts QualityWarning union. */
export type FaceQualityWarning =
  | "resolution_too_low"
  | "too_dark"
  | "too_bright"
  | "too_blurry"
  | "face_too_small"
  | "not_centered"
  | "face_turned"
  | "head_tilted";

/** Mirrors face-service's services/quality.ts QualityMetrics. */
export interface FaceQualityMetrics {
  score: number;
  brightness: number;
  sharpness: number;
  faceSize: number;
  centered: boolean;
  pose: { yaw: number; roll: number };
}

/** Mirrors face-service's services/quality.ts EnrollmentPose — same vocabulary as the Prisma FaceEnrollmentPose enum and office-app's capture-reference.tsx. */
export type FaceEnrollmentPose = "FRONT" | "LEFT" | "RIGHT" | "SMILE" | "NEUTRAL";

export interface FaceEnrollResult {
  embedding: number[];
  /** Composite photo-quality score in [0,1] — see face-service's services/quality.ts. */
  qualityScore: number;
  /** Raw face-detector confidence, 0-1 — a separate signal from qualityScore (see face-service's faceEngine.ts). */
  detectionConfidence: number;
  quality: FaceQualityMetrics;
}

export type FaceEnrollOutcome =
  | FaceEnrollResult
  | {
      error: "no_face_detected" | "multiple_faces_detected" | "decode_failed" | "low_quality";
      /** Present when error is "low_quality" — which specific checks failed. */
      warnings?: FaceQualityWarning[];
    };

export interface FaceVerifyResult {
  confidence: number;
  distance: number;
  bestIndex: number;
  processingTimeMs: number;
  /** Present only when a liveness check was requested (Phase 3 first-cut). */
  livenessPassed?: boolean;
}

export type FaceVerifyOutcome =
  | ({ ok: true } & FaceVerifyResult)
  | { ok: false; error: string; warnings?: FaceQualityWarning[] };

export interface FaceMatchResult {
  bestIndex: number;
  distance: number;
  confidence: number;
}

export interface FaceVerifier {
  /** `poses`, when given, must be the same length/order as `images` — see face-service's EnrollmentPose. Omit for the strict frontal check on every image. */
  enroll(images: Buffer[], poses?: FaceEnrollmentPose[]): Promise<FaceEnrollOutcome[]>;
  verify(
    image: Buffer,
    candidateEmbeddings: number[][],
    options?: { checkLiveness?: boolean },
  ): Promise<FaceVerifyOutcome>;
  /**
   * Embedding-to-embedding comparison (no image, no face detection) — for
   * server-side checks that already have both embeddings on hand, e.g. the
   * duplicate-face-across-employees check at enrollment time. Returns null
   * (never throws) if face-service is unreachable — a biometric-infra hiccup
   * should never block a legitimate enrollment; callers just skip the check.
   */
  matchEmbedding(embedding: number[], candidateEmbeddings: number[][]): Promise<FaceMatchResult | null>;
}

function getFaceServiceBase(): string {
  // Same "no separate config for local dev" convenience as other internal
  // defaults in this repo — override with FACE_SERVICE_URL in Docker/VPS.
  return process.env.FACE_SERVICE_URL ?? "http://localhost:4001";
}

// Fetch timeouts — engineering estimates, not calibrated against real
// production latency (face-service has effectively zero real-traffic
// history as of Phase 2's audit). Not biometric thresholds: a timeout fails
// exactly the same way an unreachable face-service already does, callers
// already handle that safely — these just bound how long "safely" takes.
/** Single image: decode + detect + landmarks + descriptor + distance. */
const VERIFY_TIMEOUT_MS = 8_000;
/** Pure vector comparison, no image decode/inference at all. */
const MATCH_TIMEOUT_MS = 5_000;
/** Up to 5 images processed sequentially, each through the same pipeline as verify. */
const ENROLL_TIMEOUT_MS = 30_000;

class HttpFaceVerifier implements FaceVerifier {
  async enroll(images: Buffer[], poses?: FaceEnrollmentPose[]): Promise<FaceEnrollOutcome[]> {
    const res = await fetch(`${getFaceServiceBase()}/enroll`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        images: images.map((b) => b.toString("base64")),
        ...(poses ? { poses } : {}),
      }),
      signal: AbortSignal.timeout(ENROLL_TIMEOUT_MS),
    });

    if (!res.ok) {
      throw new Error(`face-service /enroll returned ${res.status}`);
    }

    const json = (await res.json()) as { results: FaceEnrollOutcome[] };
    return json.results;
  }

  async verify(
    image: Buffer,
    candidateEmbeddings: number[][],
    options?: { checkLiveness?: boolean },
  ): Promise<FaceVerifyOutcome> {
    const res = await fetch(`${getFaceServiceBase()}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image: image.toString("base64"),
        candidateEmbeddings,
        checkLiveness: options?.checkLiveness,
      }),
      signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
    });

    const json = await res.json();

    if (!res.ok) {
      // 422 = no_face_detected / multiple_faces_detected / low_quality
      // (expected, recoverable); anything else (including a timeout, which
      // throws below rather than landing here) is a real failure. Either
      // way, never throw here — verification failures must never block
      // attendance (design doc §11), callers decide the fallback behavior.
      return { ok: false, error: json?.error ?? `status ${res.status}`, warnings: json?.warnings };
    }

    return { ok: true, ...(json as FaceVerifyResult) };
  }

  async matchEmbedding(
    embedding: number[],
    candidateEmbeddings: number[][],
  ): Promise<FaceMatchResult | null> {
    try {
      const res = await fetch(`${getFaceServiceBase()}/match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ embedding, candidateEmbeddings }),
        signal: AbortSignal.timeout(MATCH_TIMEOUT_MS),
      });
      if (!res.ok) return null;
      return (await res.json()) as FaceMatchResult;
    } catch (e) {
      console.error("face-service /match failed:", e);
      return null;
    }
  }
}

let instance: FaceVerifier | null = null;

export function getFaceVerifier(): FaceVerifier {
  if (!instance) instance = new HttpFaceVerifier();
  return instance;
}
