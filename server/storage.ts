/**
 * Local disk storage — replaces Manus Forge S3.
 * Files are stored in UPLOADS_DIR (default: ./uploads) and served at /uploads/.
 */
import fs from "fs/promises";
import path from "path";
import { ENV } from "./_core/env";

function getUploadsDir(): string {
  return path.resolve(ENV.uploadsDir);
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array,
  _contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const uploadsDir = getUploadsDir();
  const fullPath = path.join(uploadsDir, relKey);

  // Ensure directory exists
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, data);

  return { key: relKey, url: `/uploads/${relKey}` };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  return { key: relKey, url: `/uploads/${relKey}` };
}

export async function storageReadBuffer(relKey: string): Promise<Buffer> {
  const fullPath = path.join(getUploadsDir(), relKey);
  return fs.readFile(fullPath);
}
