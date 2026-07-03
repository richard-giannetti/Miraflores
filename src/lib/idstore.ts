import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";

/**
 * Guest ID images are personal data (PRD §8 — EU/GDPR relevance). They are:
 *  - encrypted at rest with AES-256-GCM before touching disk,
 *  - stored outside the web root (./storage/uploads, git-ignored),
 *  - purged 30 days after checkout by scripts/purge-id-uploads.ts.
 * The key comes from ID_ENCRYPTION_KEY (base64, 32 bytes).
 */

const UPLOAD_DIR = path.join(process.cwd(), "storage", "uploads");

function key(): Buffer {
  const raw = process.env.ID_ENCRYPTION_KEY;
  if (!raw) throw new Error("ID_ENCRYPTION_KEY is not set.");
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error("ID_ENCRYPTION_KEY must decode to 32 bytes (base64).");
  }
  return buf;
}

/** Encrypt and persist an uploaded ID image. Returns the relative file path. */
export async function saveEncryptedId(
  reservationId: string,
  data: Buffer,
  contentType: string
): Promise<string> {
  await mkdir(UPLOAD_DIR, { recursive: true });
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const tag = cipher.getAuthTag();

  // Layout: [1 byte ct-length header omitted] iv(12) | tag(16) | ciphertext
  const meta = Buffer.from(JSON.stringify({ contentType }));
  const metaLen = Buffer.alloc(2);
  metaLen.writeUInt16BE(meta.length, 0);
  const blob = Buffer.concat([iv, tag, metaLen, meta, encrypted]);

  const rel = path.join("storage", "uploads", `${reservationId}.enc`);
  await writeFile(path.join(process.cwd(), rel), blob);
  return rel;
}

/** Decrypt a stored ID image (used by staff-side viewing, not built in v1 UI). */
export async function readEncryptedId(
  relPath: string
): Promise<{ data: Buffer; contentType: string }> {
  const blob = await readFile(path.join(process.cwd(), relPath));
  const iv = blob.subarray(0, 12);
  const tag = blob.subarray(12, 28);
  const metaLen = blob.readUInt16BE(28);
  const meta = JSON.parse(blob.subarray(30, 30 + metaLen).toString());
  const encrypted = blob.subarray(30 + metaLen);
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  const data = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return { data, contentType: meta.contentType };
}

export async function deleteEncryptedId(relPath: string): Promise<void> {
  try {
    await unlink(path.join(process.cwd(), relPath));
  } catch {
    // already gone — fine
  }
}
