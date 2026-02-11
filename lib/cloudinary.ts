import {
  v2 as cloudinary,
  type UploadApiOptions,
  type UploadApiResponse,
} from "cloudinary";

const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } =
  process.env;

if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
  // We throw only when this module is imported on the server and config is missing.
  throw new Error(
    "Missing Cloudinary config. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in your environment.",
  );
}

cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET,
  secure: true,
});

export type CloudinaryFolder =
  | "employees"
  | "attendance"
  | "site-day-photos"
  | (string & {});

export async function uploadImageBuffer(
  buffer: Buffer,
  options: UploadApiOptions & { folder?: CloudinaryFolder } = {},
): Promise<UploadApiResponse> {
  const folder = options.folder ?? "misc";

  return new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, ...options },
      (error, result) => {
        if (error || !result)
          return reject(error ?? new Error("Upload failed"));
        resolve(result);
      },
    );

    stream.end(buffer);
  });
}

export async function uploadImageFile(
  file: File,
  options: UploadApiOptions & { folder?: CloudinaryFolder } = {},
): Promise<UploadApiResponse> {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return uploadImageBuffer(buffer, options);
}

export function getSecureUrl(result: UploadApiResponse): string {
  return result.secure_url || result.url;
}

export async function deleteImage(publicId: string): Promise<void> {
  if (!publicId) return;
  await cloudinary.uploader.destroy(publicId).catch(() => {
    // Ignore deletion errors to avoid blocking cleanup.
  });
}
