// HTTP client for the standalone `face-service` (Phase 0 spike — see
// office-app/FACE_VERIFICATION_TECHNICAL_DESIGN.md). Attendance/enrollment
// code depends on the `FaceVerifier` interface, not on face-service's HTTP
// details directly, so swapping the model/provider later doesn't touch
// callers.

export interface FaceEnrollResult {
  embedding: number[];
  qualityScore: number;
}

export type FaceEnrollOutcome =
  | FaceEnrollResult
  | { error: "no_face_detected" | "multiple_faces_detected" | "decode_failed" };

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
  | { ok: false; error: string };

export interface FaceVerifier {
  enroll(images: Buffer[]): Promise<FaceEnrollOutcome[]>;
  verify(
    image: Buffer,
    candidateEmbeddings: number[][],
    options?: { checkLiveness?: boolean },
  ): Promise<FaceVerifyOutcome>;
}

function getFaceServiceBase(): string {
  // Same "no separate config for local dev" convenience as other internal
  // defaults in this repo — override with FACE_SERVICE_URL in Docker/VPS.
  return process.env.FACE_SERVICE_URL ?? "http://localhost:4001";
}

class HttpFaceVerifier implements FaceVerifier {
  async enroll(images: Buffer[]): Promise<FaceEnrollOutcome[]> {
    const res = await fetch(`${getFaceServiceBase()}/enroll`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ images: images.map((b) => b.toString("base64")) }),
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
    });

    const json = await res.json();

    if (!res.ok) {
      // 422 = no_face_detected / multiple_faces_detected (expected,
      // recoverable); anything else is a real failure. Either way, never
      // throw here — verification failures must never block attendance
      // (design doc §11), callers decide the fallback behavior.
      return { ok: false, error: json?.error ?? `status ${res.status}` };
    }

    return { ok: true, ...(json as FaceVerifyResult) };
  }
}

let instance: FaceVerifier | null = null;

export function getFaceVerifier(): FaceVerifier {
  if (!instance) instance = new HttpFaceVerifier();
  return instance;
}
