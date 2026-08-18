import sharp from "sharp";
import * as tf from "@tensorflow/tfjs";

/**
 * Decodes a base64-encoded JPEG/PNG (optionally with a data-URL prefix) into
 * a [height, width, 3] int32 tensor.
 *
 * Uses `sharp` rather than tfjs-node's `tf.node.decodeImage` — this service
 * runs on the WASM backend (see faceEngine.ts) precisely so it doesn't need
 * a compiled native TensorFlow binary, and `tf.node` only exists when
 * `@tensorflow/tfjs-node` is loaded. `sharp` already ships reliable
 * prebuilt binaries for Windows/macOS/Linux/musl, so it doesn't reintroduce
 * the problem this is avoiding.
 */
export async function decodeBase64Image(base64: string): Promise<tf.Tensor3D> {
  const raw = base64.includes(",") ? base64.split(",", 2)[1] : base64;
  const buffer = Buffer.from(raw, "base64");

  const { data, info } = await sharp(buffer)
    .rotate() // auto-orient from EXIF — phone camera photos (esp. front camera) are
    // frequently stored sideways with a "rotate on display" tag rather than
    // pre-rotated pixels; without this the detector can be looking at a
    // rotated frame and legitimately find no upright face in it.
    .toColorspace("srgb")
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  return tf.tensor3d(new Uint8Array(data), [info.height, info.width, info.channels], "int32");
}
