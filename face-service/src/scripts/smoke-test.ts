// Technical validation only (design doc §13, Phase 0 Step 4) — proves the
// service starts, the model loads, embeddings get generated, comparison
// runs, and latency is reasonable. This is NOT accuracy validation: don't
// draw any conclusion about real-world confidence from this script's
// output. That requires a real, consented FCP test set (Step 5) that only
// the FCP team can collect — this script deliberately takes arbitrary local
// image paths instead of embedding any images itself.
//
// Usage:
//   pnpm smoke-test <referenceImage.jpg> <liveImage.jpg> [http://localhost:4001]

import { readFileSync } from "fs";
import type { EnrollResponseBody, VerifyResponseBody, HealthResponseBody } from "../models/types";

async function main() {
  const [, , referencePath, livePath, baseUrlArg] = process.argv;
  const baseUrl = baseUrlArg ?? "http://localhost:4001";

  if (!referencePath || !livePath) {
    console.error("Usage: pnpm smoke-test <referenceImage> <liveImage> [baseUrl]");
    process.exit(1);
  }

  const toBase64 = (path: string) => readFileSync(path).toString("base64");

  console.log("Checking /health...");
  const health = (await fetch(`${baseUrl}/health`).then((r) => r.json())) as HealthResponseBody;
  console.log(health);

  console.log("Enrolling reference image...");
  const enrollRes = (await fetch(`${baseUrl}/enroll`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ images: [toBase64(referencePath)] }),
  }).then((r) => r.json())) as EnrollResponseBody;

  const [enrolled] = enrollRes.results;
  if (!enrolled || "error" in enrolled) {
    console.error("Enrollment failed:", enrollRes);
    process.exit(1);
  }
  console.log(`Enrolled. qualityScore=${enrolled.qualityScore.toFixed(3)}`);

  console.log("Verifying live image against reference...");
  const verifyRes = (await fetch(`${baseUrl}/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      image: toBase64(livePath),
      candidateEmbeddings: [enrolled.embedding],
    }),
  }).then((r) => r.json())) as VerifyResponseBody;

  console.log(verifyRes);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
