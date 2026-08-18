import { Router } from "express";
import * as faceEngine from "../services/faceEngine";
import type {
  EnrollRequestBody,
  EnrollResponseBody,
  EnrollResult,
  EnrollFailure,
} from "../models/types";

export const enrollRouter = Router();

enrollRouter.post("/enroll", async (req, res) => {
  const body = req.body as EnrollRequestBody;

  if (!Array.isArray(body?.images) || body.images.length === 0) {
    return res.status(400).json({ error: "images must be a non-empty array" });
  }

  const results: (EnrollResult | EnrollFailure)[] = [];

  for (const image of body.images) {
    try {
      const described = await faceEngine.describeFace(image);
      if (described.ok) {
        results.push({ embedding: described.embedding, qualityScore: described.qualityScore });
      } else {
        results.push({ error: described.reason });
      }
    } catch {
      results.push({ error: "decode_failed" });
    }
  }

  const summary = results
    .map((r) => ("error" in r ? `error:${r.error}` : `quality:${r.qualityScore.toFixed(2)}`))
    .join(", ");
  console.log(`enroll: ${results.length} image(s) -> ${summary}`);

  const response: EnrollResponseBody = { results };
  res.json(response);
});
