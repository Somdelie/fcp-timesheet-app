import fs from "fs";
import path from "path";

export async function rotateLogIfNeeded(
  logFilePath: string,
  maxBytes = 5 * 1024 * 1024,
) {
  try {
    await fs.promises.access(logFilePath, fs.constants.F_OK);
  } catch {
    return null;
  }

  try {
    const st = await fs.promises.stat(logFilePath);
    if (!st.isFile() || st.size <= maxBytes) return null;

    const logDir = path.dirname(logFilePath);
    const archiveDir = path.join(logDir, "archive");
    await fs.promises.mkdir(archiveDir, { recursive: true });

    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const baseName = `site-photo-uploads-${ts}.log`;
    const dest = path.join(archiveDir, baseName);

    await fs.promises.rename(logFilePath, dest);
    return dest;
  } catch (e) {
    console.error("rotateLogIfNeeded error", e);
    return null;
  }
}

export async function listArchivedLogFiles(logDir: string) {
  const archiveDir = path.join(logDir, "archive");
  try {
    const items = await fs.promises.readdir(archiveDir);
    return items
      .filter((f) => f.startsWith("site-photo-uploads") && f.endsWith(".log"))
      .map((f) => path.join(archiveDir, f))
      .sort();
  } catch {
    return [];
  }
}

export async function markFileImported(filePath: string) {
  try {
    const dir = path.dirname(filePath);
    const importedDir = path.join(dir, "imported");
    await fs.promises.mkdir(importedDir, { recursive: true });
    const dest = path.join(importedDir, path.basename(filePath) + ".imported");
    await fs.promises.rename(filePath, dest);
    return dest;
  } catch (e) {
    console.error("markFileImported error", e);
    return null;
  }
}
