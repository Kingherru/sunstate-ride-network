import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// AES-256-GCM envelope encryption for provider integration secrets.
// Ciphertext format (all base64 without padding stripping): v1:<iv>:<tag>:<ct>
// Key: INTEGRATIONS_ENCRYPTION_KEY — hex or base64 of at least 32 raw bytes.

function loadKey(): Buffer {
  const raw = process.env.INTEGRATIONS_ENCRYPTION_KEY;
  if (!raw) throw new Error("INTEGRATIONS_ENCRYPTION_KEY is not configured");
  // Try hex first, then base64, then utf8 fallback (hashed via slice).
  let key: Buffer;
  if (/^[0-9a-fA-F]+$/.test(raw) && raw.length >= 64) {
    key = Buffer.from(raw.slice(0, 64), "hex");
  } else {
    const b64 = Buffer.from(raw, "base64");
    key = b64.length >= 32 ? b64.subarray(0, 32) : Buffer.from(raw.padEnd(32, "0")).subarray(0, 32);
  }
  if (key.length !== 32) throw new Error("INTEGRATIONS_ENCRYPTION_KEY must decode to 32 bytes");
  return key;
}

export function encryptSecret(plaintext: string): string {
  const key = loadKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${ct.toString("base64")}`;
}

export function decryptSecret(payload: string): string {
  if (!payload.startsWith("v1:")) throw new Error("Unsupported ciphertext version");
  const [, ivB64, tagB64, ctB64] = payload.split(":");
  const key = loadKey();
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const pt = Buffer.concat([decipher.update(Buffer.from(ctB64, "base64")), decipher.final()]);
  return pt.toString("utf8");
}
