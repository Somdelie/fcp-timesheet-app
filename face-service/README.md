# face-service (Phase 0 spike)

Standalone face verification engine. **Not integrated with FCP yet** — no
Prisma migrations, no attendance code changes, no UI changes. This exists to
answer one question: *can the chosen model reliably verify FCP workers under
construction-site conditions?* See
`office-app/FACE_VERIFICATION_TECHNICAL_DESIGN.md` for the full architecture
this spike feeds into.

## Model choice — and why it isn't ArcFace

The design doc originally named an "ArcFace-family" model. During Phase 0,
checking the actual license terms on the obvious candidates surfaced a real
problem:

- InsightFace (`buffalo_l`, `antelopev2`, ...): explicitly *"non-commercial
  research purposes only."*
- The ONNX Model Zoo's official ArcFace (`LResNet100E-IR`): unclear weight
  license, and trained on **MS-Celeb-1M** — a dataset Microsoft took down in
  2019 over consent/privacy concerns about the people in it.

Neither is acceptable to ship in a commercial payroll product. This service
instead uses **dlib's `face_recognition_resnet_model_v1`** (via
[`@vladmandic/face-api`](https://github.com/vladmandic/face-api)) — its
author explicitly released it into the **public domain**, commercial use
included.
Trade-off: 128-d descriptors and an older (2017) architecture rather than
ArcFace's 512-d, but still ~99.4% on LFW, which is a reasonable starting
point for Phase 0. If accuracy under real site conditions (Step 5) turns out
to be insufficient, that's the trigger to go find/license a stronger
commercially-clean model — not to quietly ship a research-only one.

## Comparison metric

dlib/face-api.js descriptors are compared by **Euclidean distance**, not
cosine similarity (cosine similarity is the ArcFace/512-d convention — using
it here would produce meaningless numbers). The conventional rule of thumb
is *distance ≤ 0.6 ⇒ same person*, tuned on LFW. `src/services/compare.ts`
maps distance to a 0-1 "confidence" with a placeholder linear scale —
replace it with a calibrated mapping once Phase 0 has real distance
measurements (design doc §8).

## Runtime backend

Runs on TensorFlow's **WASM backend** (`@tensorflow/tfjs` +
`@tensorflow/tfjs-backend-wasm`), not `@tensorflow/tfjs-node`. `tfjs-node`'s
prebuilt binary didn't have a matching build for this dev machine's Node/OS
combo, and the from-source fallback needs a full Visual Studio + Windows SDK
install — not worth requiring just to run `pnpm dev`. WASM is a plain
compiled binary with no toolchain dependency, and it's an
officially-supported `@vladmandic/face-api` backend, not a hack. Image
decoding uses `sharp` instead of `tf.node.decodeImage` for the same reason
(`tf.node` only exists when `tfjs-node` is loaded) — `sharp` is already a
proven dependency in `fcp-timesheet-app`. Trade-off: WASM is slower than a
native TF binary; if per-scan latency becomes a problem at Phase 2, revisit
`tfjs-node` on the actual Linux deployment target where its prebuilt binary
installs cleanly.

## Setup

```bash
pnpm install
pnpm dev        # starts on :4001 (override with PORT=)
```

`GET /health` returns `{ status: "ok", modelLoaded: false }` immediately on
boot, flipping to `true` once the models finish loading (a few seconds).

## Endpoints

Matches `office-app/FACE_VERIFICATION_TECHNICAL_DESIGN.md` §5:

```
GET  /health
POST /enroll   { images: string[] (base64) }
               → { results: ({ embedding: number[]; qualityScore: number } | { error })[] }
POST /verify   { image: string (base64); candidateEmbeddings: number[][] }
               → { confidence: number; distance: number; bestIndex: number; processingTimeMs: number }
```

Rejects frames with zero or multiple detected faces (`no_face_detected` /
`multiple_faces_detected`) rather than guessing — this is 1:1 verification
against an already-selected employee, never 1:N identification.

## Step 4 — technical validation (this repo can do this part)

Prove the pipeline mechanically works — starts, loads, embeds, compares, at
acceptable latency — using **your own arbitrary local test images** (not
committed to the repo, not FCP employee data):

```bash
pnpm smoke-test ./reference.jpg ./live.jpg
```

This is a plumbing check, not an accuracy check. Two unrelated stock photos
are fine for this step.

## Step 5 — real-world validation (out of scope for this codebase)

Requires a controlled, consented internal test set from the FCP team (20–30
volunteers, hard hat on/off, indoor/outdoor lighting, different times of
day) — this is explicitly not something that can be sourced or fabricated
here. Once that data exists, measure false-accept/false-reject rates and
confidence distributions against it, and use the results to replace the
placeholder threshold in `compare.ts` and decide go/no-go on Phase 1.

## Docker

```bash
docker build -t face-service .
docker run -p 4001:4001 face-service
```

Uses `node:22-alpine`, same as the other FCP services — the WASM backend
has no native-binary/glibc constraint, and `sharp` already has reliable
Alpine/musl prebuilt support.
