export type PasswordPolicyCode =
  | "too_short"
  | "need_lower"
  | "need_upper"
  | "need_digit"
  | "need_special"
  | "no_spaces";

export interface PasswordPolicyResult {
  ok: boolean;
  reasons: PasswordPolicyCode[];
}

const POLICY_SR: Record<PasswordPolicyCode, string> = {
  too_short: "Lozinka mora imati najmanje 12 karaktera",
  need_lower: "Potrebno je malo slovo",
  need_upper: "Potrebno je veliko slovo",
  need_digit: "Potrebno je jedna cifra",
  need_special: "Potrebno je jedan specijalni znak",
  no_spaces: "Lozinka ne sme sadržati razmake",
};

/** Jača lozinka za naloge koje admin kreira u aplikaciji. */
export function validateAdminCreatedPassword(password: string): PasswordPolicyResult {
  const reasons: PasswordPolicyCode[] = [];
  if (!password || password.length < 12) reasons.push("too_short");
  if (!/[a-z]/.test(password)) reasons.push("need_lower");
  if (!/[A-Z]/.test(password)) reasons.push("need_upper");
  if (!/[0-9]/.test(password)) reasons.push("need_digit");
  if (!/[^A-Za-z0-9]/.test(password)) reasons.push("need_special");
  if (/\s/.test(password)) reasons.push("no_spaces");
  return { ok: reasons.length === 0, reasons };
}

export function passwordPolicyMessage(result: PasswordPolicyResult): string {
  return result.reasons.map((code) => POLICY_SR[code]).join(". ");
}

export class PasswordPolicyError extends Error {
  readonly code = "password_policy" as const;
  readonly reasons: PasswordPolicyCode[];

  constructor(reasons: PasswordPolicyCode[]) {
    super(passwordPolicyMessage({ ok: false, reasons }));
    this.name = "PasswordPolicyError";
    this.reasons = reasons;
  }
}
