import { Router } from "express";
import * as faceEngine from "../services/faceEngine";
import type { HealthResponseBody } from "../models/types";

export const healthRouter = Router();

healthRouter.get("/health", (_req, res) => {
  const body: HealthResponseBody = { status: "ok", modelLoaded: faceEngine.isReady() };
  res.json(body);
});
