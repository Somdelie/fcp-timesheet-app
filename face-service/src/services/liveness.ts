// Phase 3 liveness — FIRST CUT, documented as a heuristic, not a robust
// anti-spoof guarantee (see office-app/FACE_VERIFICATION_TECHNICAL_DESIGN.md
// §9). Real active-liveness (timed blink/turn sequencing across multiple
// frames) is real effort; this checks a single already-captured frame for
// enough head-turn asymmetry that a flat printed photo held at a normal
// angle is unlikely to fake, without requiring the client to stream video.
//
// Blink-based liveness was deliberately NOT attempted here: detecting a
// blink needs at least two frames (eyes-open reference + eyes-closed during
// the blink) — a single still can't tell "eyes closed" from "eyes were
// always like that in the photo being held up." Head-turn is checkable from
// one frame because a genuinely turned 3D face foreshortens differently
// than a flat 2D photo does, even at one instant.
//
// Landmark indices follow the standard 68-point iBUG scheme (also what
// dlib / face-api.js's faceLandmark68Net produces):
//   36 = right eye outer corner, 45 = left eye outer corner, 33 = nose tip

const TURN_RATIO_THRESHOLD = 0.15;

export function estimateHeadTurn(landmarks: { x: number; y: number }[]): {
  turned: boolean;
  ratio: number;
} {
  const rightEyeOuter = landmarks[36];
  const leftEyeOuter = landmarks[45];
  const noseTip = landmarks[33];

  const eyeMidX = (rightEyeOuter.x + leftEyeOuter.x) / 2;
  const eyeSpan = Math.abs(leftEyeOuter.x - rightEyeOuter.x);

  if (eyeSpan === 0) return { turned: false, ratio: 0 };

  const ratio = (noseTip.x - eyeMidX) / eyeSpan;
  return { turned: Math.abs(ratio) > TURN_RATIO_THRESHOLD, ratio };
}
