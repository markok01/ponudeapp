/** Auth API greške — kod → i18n ključ. Bez Next importa (klijent + server). */
export const AUTH_CODE_KEYS: Record<string, string> = {
  wrong_password: "auth.wrongPassword",
  email_password_required: "auth.emailPasswordRequired",
  too_many_login_attempts: "auth.tooManyLoginAttempts",
  too_many_requests: "auth.tooManyRequests",
  no_users: "auth.noUsers",
  invalid_credentials: "auth.invalidCredentials",
  account_not_linked: "auth.accountNotLinked",
  org_suspended: "auth.orgSuspended",
  device_limit: "auth.deviceLimit",
  session_persist_failed: "auth.sessionNotActive",
  jwt_missing: "auth.jwtMissing",
  db_connection: "auth.dbConnection",
  wrong_database: "auth.wrongDatabase",
  sign_in_failed: "auth.signInFailed",
  signup_rate_limited: "auth.signupRateLimited",
  forbidden: "auth.forbidden",
  password_mismatch: "auth.passwordMismatch",
  register_failed: "auth.registerFailed",
  person_name_required: "auth.personNameRequired",
  invalid_email: "auth.invalidEmail",
  email_in_use: "auth.emailInUse",
  password_too_short: "auth.passwordTooShort",
  org_create_failed: "auth.orgCreateFailed",
  invite_invalid: "auth.inviteInvalid",
  invite_accept_failed: "auth.inviteAcceptFailed",
  resend_rate_limited: "auth.resendRateLimited",
  resend_cooldown: "auth.resendCooldownWait",
  resend_failed: "auth.resendFailed",
  resend_sent: "auth.resendSent",
  resend_dev_link: "auth.resendDevLink",
  verify_failed: "auth.verifyFailed",
  verify_token_missing: "auth.verifyMissingToken",
  verify_expired: "auth.verifyExpired",
  verify_used: "auth.verifyUsed",
  google_pending_expired: "auth.googlePendingExpired",
  google_unverified: "auth.googleUnverified",
  google_no_account: "auth.googleNoAccount",
  google_not_configured: "auth.googleNotConfigured",
  google_failed: "auth.googleFailed",
  google_denied: "auth.googleDenied",
  google_mismatch: "auth.googleMismatch",
  google_inactive: "auth.googleInactive",
  google_name_required: "auth.personNameRequired",
  password_policy: "auth.passwordPolicyFailed",
};

export class AuthCodedError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = "AuthCodedError";
    this.code = code;
  }
}
