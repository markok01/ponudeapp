import { createHash, randomBytes, randomUUID } from "crypto";

/** SHA-256 heks vrednost session tokena — u bazi se ne čuva plain token. */
export function hashSessionToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}

/** Opaque token za cookie/JWT sid (64 hex znaka). */
export function generateRawSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export function isLegacySessionId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export function newSessionRowId(): string {
  return randomUUID();
}
