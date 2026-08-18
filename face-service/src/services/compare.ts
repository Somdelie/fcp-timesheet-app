// Comparison metric for dlib-derived 128-d descriptors.
//
// Important: this model family (dlib's ResNet face recognition net, as used
// by face-api.js / Python's `face_recognition`) was validated by its authors
// using EUCLIDEAN DISTANCE, not cosine similarity. Cosine similarity is the
// convention for ArcFace-style 512-d embeddings, which this service does NOT
// use (see office-app/FACE_VERIFICATION_TECHNICAL_DESIGN.md — the ArcFace
// candidates all carried unacceptable commercial-licensing/dataset-provenance
// risk, so Phase 0 validates this model instead). Applying cosine similarity
// to these descriptors would silently produce meaningless scores.
//
// The conventional rule of thumb in the dlib/face-api.js ecosystem is:
// distance <= 0.6 => same person. That threshold was tuned on LFW, not on
// FCP workers wearing hard hats in site lighting — it is a starting point,
// not a decision. Phase 0's job is to measure the real distance
// distribution on FCP's own test set and replace CONFIDENCE_SCALE below
// with a calibrated mapping (or replace this whole function with proper
// bucket thresholds, matching §8 of the design doc).

const CONFIDENCE_SCALE = 1.2;

export function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Descriptor length mismatch: ${a.length} vs ${b.length}`);
  }
  let sumSquares = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sumSquares += diff * diff;
  }
  return Math.sqrt(sumSquares);
}

/** Placeholder linear mapping from distance to a 0-1 confidence figure. See note above. */
export function distanceToConfidence(distance: number): number {
  const confidence = 1 - distance / CONFIDENCE_SCALE;
  return Math.max(0, Math.min(1, confidence));
}

export function findBestMatch(
  liveEmbedding: number[],
  candidates: number[][],
): { bestIndex: number; distance: number; confidence: number } {
  let bestIndex = -1;
  let bestDistance = Infinity;

  for (let i = 0; i < candidates.length; i++) {
    const distance = euclideanDistance(liveEmbedding, candidates[i]);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = i;
    }
  }

  return {
    bestIndex,
    distance: bestDistance,
    confidence: distanceToConfidence(bestDistance),
  };
}
