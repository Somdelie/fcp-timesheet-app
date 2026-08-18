import express from "express";
import { healthRouter } from "./routes/health";
import { enrollRouter } from "./routes/enroll";
import { verifyRouter } from "./routes/verify";
import { loadModels } from "./services/faceEngine";

const PORT = Number(process.env.PORT ?? 4001);

async function main() {
  const app = express();
  // Enrollment photos are base64 JSON — a handful of JPEGs comfortably
  // exceeds Express's 100kb default body limit.
  app.use(express.json({ limit: "25mb" }));

  // Request log — this is the Phase 0 debug console: watch this terminal
  // while testing from the phone (dev-face-test.tsx) to see every call land,
  // its status, and how long it took.
  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      console.log(
        `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - start}ms)`,
      );
    });
    next();
  });

  app.use(healthRouter);
  app.use(enrollRouter);
  app.use(verifyRouter);

  // Catches synchronous throws / body-parser errors. Route handlers below
  // wrap their own async logic in try/catch (Express 4 doesn't forward
  // rejected promises here on its own).
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("Unhandled error:", err);
    res.status(500).json({ error: "internal_error" });
  });

  // Listen immediately so /health is queryable during startup (modelLoaded:
  // false until loadModels() finishes); /enroll and /verify will 500 until
  // then, which is correct — there's no partial-model state worth serving.
  app.listen(PORT, () => {
    console.log(`face-service listening on :${PORT}`);
  });

  console.log("Loading face models...");
  await loadModels();
  console.log("Models loaded.");
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
