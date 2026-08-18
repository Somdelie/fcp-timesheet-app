import { Router } from "express";
import * as faceEngine from "../services/faceEngine";
import { findBestMatch } from "../services/compare";
import { estimateHeadTurn } from "../services/liveness";
import type { VerifyRequestBody, VerifyResponseBody } from "../models/types";

export const verifyRouter = Router();

verifyRouter.post("/verify", async (req, res) => {
  const body = req.body as VerifyRequestBody;

  if (typeof body?.image !== "string") {
    return res.status(400).json({ error: "image (base64 string) is required" });
  }
  if (!Array.isArray(body?.candidateEmbeddings) || body.candidateEmbeddings.length === 0) {
    return res.status(400).json({ error: "candidateEmbeddings must be a non-empty array" });
  }

  const startedAt = Date.now();

  // Express 4 doesn't route rejected promises from async handlers to error
  // middleware — wrap the whole body so an unexpected throw here still
  // produces a response instead of a hung request.
  try {
    const described = await faceEngine.describeFace(body.image);
    if (!described.ok) {
      console.log(`verify: rejected -> ${described.reason}`);
      return res.status(422).json({ error: described.reason });
    }

    const { bestIndex, distance, confidence } = findBestMatch(
      described.embedding,
      body.candidateEmbeddings,
    );

    let livenessPassed: boolean | undefined;
    if (body.checkLiveness) {
      livenessPassed = estimateHeadTurn(described.landmarks).turned;
    }

    const response: VerifyResponseBody = {
      confidence,
      distance,
      bestIndex,
      processingTimeMs: Date.now() - startedAt,
      ...(livenessPassed !== undefined ? { livenessPassed } : {}),
    };
    console.log(
      `verify: confidence=${confidence.toFixed(3)} distance=${distance.toFixed(3)} bestIndex=${bestIndex}` +
        (livenessPassed !== undefined ? ` liveness=${livenessPassed}` : "") +
        ` (${response.processingTimeMs}ms, ${body.candidateEmbeddings.length} candidate(s))`,
    );
    res.json(response);
  } catch (err) {
    console.error("verify failed:", err);
    res.status(500).json({ error: "internal_error" });
  }
});
