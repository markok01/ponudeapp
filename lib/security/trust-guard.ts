import type { TrustLevel } from "@/lib/security/trust-score";
import { isSensitiveActionReauthRequired } from "@/lib/security/trust-score";

export class ReauthRequiredError extends Error {
  readonly code = "reauth_required" as const;

  constructor() {
    super(
      "Ponovo se prijavite sa ovog uređaja (nizak trust score sesije). Odjavite se i ulogujte ponovo.",
    );
    this.name = "ReauthRequiredError";
  }
}

export function assertTrustForSensitiveAction(trustLevel: TrustLevel): void {
  if (isSensitiveActionReauthRequired(trustLevel)) {
    throw new ReauthRequiredError();
  }
}
