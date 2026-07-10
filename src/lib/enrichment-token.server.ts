import { createHmac, timingSafeEqual } from "node:crypto";

function enrichmentSecret(): string {
  const s =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.LOVABLE_API_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!s) throw new Error("Enrichment token secret is not configured");
  return s;
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Mint a short-lived (default 10 min) token bound to a specific ride_request id. */
export function signEnrichmentToken(id: string, ttlSeconds = 600): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `${id}.${exp}`;
  const sig = b64url(createHmac("sha256", enrichmentSecret()).update(payload).digest());
  return `${payload}.${sig}`;
}

export function verifyEnrichmentToken(id: string, token: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [tokId, expStr, sig] = parts;
  if (tokId !== id) return false;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;
  const expected = b64url(
    createHmac("sha256", enrichmentSecret()).update(`${tokId}.${expStr}`).digest(),
  );
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
