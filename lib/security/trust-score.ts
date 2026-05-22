export type TrustLevel = "low" | "medium" | "high";

export interface TrustScoreInput {
  knownDevice: boolean;
  deviceSuccessLogins: number;
  stableIp: boolean;
  accountAgeDays: number;
  successfulLoginsTotal: number;
}

export interface TrustScoreResult {
  trustScore: number;
  trustLevel: TrustLevel;
}

export function scoreToLevel(score: number): TrustLevel {
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

/** Bez fingerprint biblioteka — heuristike iz poznatog uređaja, IP, istorije, starosti naloga. */
export function computeTrustScore(input: TrustScoreInput): TrustScoreResult {
  let score = 0;

  if (input.knownDevice) {
    score += 20;
    if (input.deviceSuccessLogins >= 3) score += 15;
    else if (input.deviceSuccessLogins >= 1) score += 8;
  }

  if (input.stableIp) score += 20;

  if (input.successfulLoginsTotal >= 10) score += 15;
  else if (input.successfulLoginsTotal >= 3) score += 10;
  else if (input.successfulLoginsTotal >= 1) score += 5;

  if (input.accountAgeDays >= 90) score += 25;
  else if (input.accountAgeDays >= 30) score += 18;
  else if (input.accountAgeDays >= 7) score += 10;
  else if (input.accountAgeDays >= 1) score += 4;

  const trustScore = Math.min(100, Math.max(0, score));
  return { trustScore, trustLevel: scoreToLevel(trustScore) };
}

export function isSensitiveActionReauthRequired(level: TrustLevel): boolean {
  return level === "low";
}

/** /24 IPv4 prefix za stabilnost (bez fingerprinta). */
export function ipNetworkPrefix(ip: string | null): string | null {
  if (!ip) return null;
  if (ip.includes(":")) {
    const parts = ip.split(":").filter(Boolean);
    return parts.length >= 4 ? parts.slice(0, 4).join(":") : ip;
  }
  const octets = ip.split(".");
  if (octets.length === 4) return `${octets[0]}.${octets[1]}.${octets[2]}.0/24`;
  return ip;
}
