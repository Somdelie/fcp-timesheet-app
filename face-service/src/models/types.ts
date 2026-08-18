// Request/response shapes for the face-service HTTP contract
// (see office-app/FACE_VERIFICATION_TECHNICAL_DESIGN.md §5).
//
// This is NOT where ML model weights live — those ship bundled inside the
// @vladmandic/face-api package. This folder just holds the data-shape
// definitions for the API, matching the src/models convention.

export interface EnrollRequestBody {
  /** Base64-encoded JPEG/PNG images, one per enrollment photo. */
  images: string[];
}

export interface EnrollResult {
  /** 128-d face descriptor from dlib's ResNet recognition model. */
  embedding: number[];
  /** Detector confidence for the face used to produce this embedding, 0-1. */
  qualityScore: number;
}

export interface EnrollFailure {
  error: "no_face_detected" | "multiple_faces_detected" | "decode_failed";
}

export interface EnrollResponseBody {
  results: (EnrollResult | EnrollFailure)[];
}

export interface VerifyRequestBody {
  /** Base64-encoded JPEG/PNG of the live capture. */
  image: string;
  /** Approved enrollment embeddings for the *already-selected* employee (1:1, not 1:N). */
  candidateEmbeddings: number[][];
  /**
   * Phase 3, first-cut only (see src/services/liveness.ts) — when true,
   * checks this same frame for head-turn asymmetry. Direction-agnostic:
   * the client prompts "turn either way" and we just check *some*
   * detectable turn happened, since left/right sign is easy to get
   * backwards across mirrored front cameras and isn't the point.
   */
  checkLiveness?: boolean;
}

export interface VerifyResponseBody {
  /**
   * Confidence in [0,1], derived from Euclidean distance to the closest
   * candidate. Placeholder mapping — see src/services/compare.ts. Real
   * accept/reject thresholds come from Phase 0/pilot measurements, not
   * this service.
   */
  confidence: number;
  /** Raw Euclidean distance to the closest candidate (dlib/face-api.js convention; lower = more similar). */
  distance: number;
  /** Index into candidateEmbeddings that produced the closest match. */
  bestIndex: number;
  processingTimeMs: number;
  /** Present only when checkLiveness was requested. First-cut heuristic — see liveness.ts. */
  livenessPassed?: boolean;
}

export interface HealthResponseBody {
  status: "ok";
  modelLoaded: boolean;
}
