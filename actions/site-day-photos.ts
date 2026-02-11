"use server";

import { prisma } from "@/lib/prisma";
import { requireServerAuth } from "@/lib/auth-server";
import { deleteImage } from "@/lib/cloudinary";

export async function runSiteDayPhotoCleanupInternal(maxAgeDays = 5) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - maxAgeDays);

  const oldPhotos = await prisma.siteDayPhoto.findMany({
    where: { uploadedAt: { lt: cutoff } },
    select: { id: true, cloudinaryPublicId: true },
  });

  if (!oldPhotos.length) {
    return { ok: true as const, deletedCount: 0 };
  }

  await Promise.all(
    oldPhotos.map((p) =>
      p.cloudinaryPublicId
        ? deleteImage(p.cloudinaryPublicId)
        : Promise.resolve(),
    ),
  );

  const { count } = await prisma.siteDayPhoto.deleteMany({
    where: { uploadedAt: { lt: cutoff } },
  });

  return { ok: true as const, deletedCount: count };
}

export async function cleanupOldSiteDayPhotos(maxAgeDays = 5) {
  const auth = await requireServerAuth();

  if (auth.role !== "ADMIN") {
    return { ok: false as const, error: "Forbidden" };
  }

  if (maxAgeDays <= 0) {
    return { ok: false as const, error: "maxAgeDays must be positive" };
  }

  return runSiteDayPhotoCleanupInternal(maxAgeDays);
}
