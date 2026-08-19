// Shared bands between the 1:1 per-employee verify path (scan-out-face) and
// the 1:N continuous-scanner identify path (scan-out-identify) — kept in one
// place so the two never drift apart. Placeholder values (design doc §8),
// NOT yet calibrated against real site photos — see face-service's
// compare.ts for why the underlying distance->confidence mapping is also a
// placeholder.
export const VERIFIED_THRESHOLD = 0.9;
export const PENDING_REVIEW_THRESHOLD = 0.75;

// 1:N only — how much closer the winning employee's best distance must be
// than the next-closest *distinct* employee's best distance before treating
// a VERIFIED-band result as safe to auto-record without a foreman tap. A
// narrow win among many candidates is a weaker identification signal than
// the same distance would be with only one person in the pool (which is all
// the 1:1 path ever compares against). Same distance scale as
// face-service's CONFIDENCE_SCALE (1.2) — engineering estimate, not
// calibrated against real multi-worker distance distributions yet.
export const MIN_IDENTIFY_MARGIN = 0.15;
