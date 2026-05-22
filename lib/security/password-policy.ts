export interface PasswordPolicyResult {
  ok: boolean;
  reasons: string[];
}

/** Jača lozinka za naloge koje admin kreira u aplikaciji. */
export function validateAdminCreatedPassword(password: string): PasswordPolicyResult {
  const reasons: string[] = [];
  if (!password || password.length < 12) {
    reasons.push("Lozinka mora imati najmanje 12 karaktera");
  }
  if (!/[a-z]/.test(password)) reasons.push("Potrebno je malo slovo");
  if (!/[A-Z]/.test(password)) reasons.push("Potrebno je veliko slovo");
  if (!/[0-9]/.test(password)) reasons.push("Potrebno je jedna cifra");
  if (!/[^A-Za-z0-9]/.test(password)) {
    reasons.push("Potrebno je jedan specijalni znak");
  }
  if (/\s/.test(password)) reasons.push("Lozinka ne sme sadržati razmake");
  return { ok: reasons.length === 0, reasons };
}

export function passwordPolicyMessage(result: PasswordPolicyResult): string {
  return result.reasons.join(". ");
}
