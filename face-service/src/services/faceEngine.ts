import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-backend-wasm";
// @vladmandic/face-api's default entry point (`main`) is
// dist/face-api.node.js, which unconditionally requires @tensorflow/tfjs-node
// — importing that would defeat the whole point of switching to WASM. The
// package separately ships dist/face-api.node-wasm.js specifically for
// Node + the WASM backend; that's the one to import here.
import * as faceapi from "@vladmandic/face-api/dist/face-api.node-wasm.js";
import { decodeBase64Image } from "../utils/image";

// Model weights ship bundled inside the @vladmandic/face-api package itself
// (its ./model directory) — no separate download step for Phase 0.
const MODEL_PATH = require.resolve("@vladmandic/face-api/package.json").replace(
  "package.json",
  "model",
);

let modelsLoaded = false;

export async function loadModels(): Promise<void> {
  if (modelsLoaded) return;

  // WASM backend, not tfjs-node: no compiled native TF binary required, so
  // this runs the same way in dev (any OS) and in the eventual Docker/VPS
  // deployment — see face-service/README.md for why tfjs-node was dropped.
  await tf.setBackend("wasm");
  await tf.ready();
  await faceapi.nets.ssdMobilenetv1.loadFromDisk(MODEL_PATH);
  await faceapi.nets.faceLandmark68Net.loadFromDisk(MODEL_PATH);
  await faceapi.nets.faceRecognitionNet.loadFromDisk(MODEL_PATH);

  modelsLoaded = true;
}

export function isReady(): boolean {
  return modelsLoaded;
}

export type DescribeResult =
  | { ok: true; embedding: number[]; qualityScore: number; landmarks: { x: number; y: number }[] }
  | { ok: false; reason: "no_face_detected" | "multiple_faces_detected" };

/**
 * Detects the single face in an image and returns its 128-d descriptor.
 * Deliberately requires exactly one face — this service does 1:1
 * verification against an already-selected employee, never 1:N
 * identification, so an ambiguous multi-face frame should be rejected
 * rather than silently picking one.
 */
export async function describeFace(base64Image: string): Promise<DescribeResult> {
  if (!modelsLoaded) {
    throw new Error("Models not loaded yet — call loadModels() first");
  }

  const tensor = await decodeBase64Image(base64Image);
  try {
    const detections = await faceapi
      .detectAllFaces(tensor)
      .withFaceLandmarks()
      .withFaceDescriptors();

    if (detections.length === 0) {
      return { ok: false, reason: "no_face_detected" };
    }
    if (detections.length > 1) {
      return { ok: false, reason: "multiple_faces_detected" };
    }

    const [match] = detections;
    return {
      ok: true,
      embedding: Array.from(match.descriptor),
      qualityScore: match.detection.score,
      landmarks: match.landmarks.positions.map((p) => ({ x: p.x, y: p.y })),
    };
  } finally {
    tensor.dispose();
  }
}
