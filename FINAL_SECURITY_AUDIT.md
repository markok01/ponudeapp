# Final Security Audit — PonudeApp Admin & Auth

**Datum:** 2026-05-21  
**Opseg:** Admin RBAC, sesije, API, login, kreiranje korisnika, Vercel deployment  
**UI:** Nije menjan (isti admin panel, ista podešavanja, isti tok prijave)

---

## Security score (procena)

| Oblast | Score (1–10) | Napomena |
|--------|----------------|----------|
| Autentifikacija & sesije | **8.5** | SHA-256 token hash u bazi, JWT v5 bez emaila, idle timeout za admin |
| Admin API & RBAC | **8.0** | Origin/Sec-Fetch CSRF, audit log, suspicious detection |
| Brute-force zaštita | **8.0** | DB rate limit (strožije za admin login) |
| Lozinke & korisnici | **7.5** | Scrypt hash, stroga politika pri admin create, cooldown + honeypot |
| Transport & headers | **7.5** | CSP, HSTS (prod), X-Frame-Options, itd. |
| Observability | **8.0** | `security_audit_log` sa IP, UA, request id, failure reason |
| **Ukupno** | **~8.0 / 10** | Production-ready za mali tim / internu HoReCa app |

---

## Implementirano (šta je urađeno)

### 1. Hash session tokena u bazi (SHA-256)
- U cookie/JWT ide **opaque** token (64 hex); u `user_sessions.token_hash` čuva se **SHA-256**.
- Legacy UUID sesije i dalje rade do isteka (lookup po `id` ili `token_hash`).
- Fajlovi: `lib/security/token-hash.ts`, `services/user-sessions.ts`.

### 2. Revokacija sesija pri promeni uloge
- `bumpUserSecurityVersion()` + `changeUserRole()` u `services/users.ts` — povećava `session_version` i briše sve sesije.
- Deaktivacija/brisanje korisnika i dalje revokuje sesije.
- **Napomena:** Promena `role` u bazi direktno (SQL/skripta) mora pozvati bump — koristite `changeUserRole` ili ručno `session_version++` + `DELETE FROM user_sessions`.

### 3. CSRF zaštita admin API (bez izmene UI)
- Mutacije na `/api/admin/*` zahtevaju **Same-Origin** (`Origin`/`Referer`) i **`Sec-Fetch-Site: same-origin`**.
- Kompatibilno sa postojećim `fetch` iz aplikacije (cookie + same-site).
- Fajl: `lib/security/csrf.ts`, `lib/security/admin-api.ts`.

### 4. Rate limiting — login
- Tabela `auth_rate_limits` (perzistentno, radi na Vercelu).
- **Admin email:** strožije (`ADMIN_LOGIN_*` env).
- **Ostali:** `LOGIN_*` env.
- Fajl: `lib/security/rate-limit.ts`, `app/api/auth/login/route.ts`.

### 5. Inactivity timeout — admin sesija
- `ADMIN_SESSION_IDLE_MINUTES` (podrazumevano **120** min).
- Provera u `getSessionUser()`; istek → revoke + audit `auth.session.revoked_idle`.
- Fajl: `lib/security/admin-idle.ts`, `lib/auth.ts`.

### 6. Audit log
Tabela `security_audit_log`:
- `request_id`, `event_type`, `actor_user_id`, `target_user_id`
- `ip_address`, `user_agent`, `failure_reason`, `metadata` (JSON)

Događaji uključuju: login success/failed/rate_limited, logout, admin API, user create/deactivate/delete, session revoke, suspicious, CSRF block.

Fajl: `lib/security/audit-log.ts`.

### 7. Security headers
`next.config.ts`: CSP, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy, HSTS (samo production).

### 8. CSP hardening
Restriktivan CSP sa `frame-ancestors 'none'`, `form-action 'self'` (Next.js i dalje zahteva `unsafe-inline` za skripte u dev/build).

### 9. Index optimizacija
- `user_sessions`: `token_hash`, `(user_id, expires_at)`
- `users`: `(role, active)`, `(email, active)`
- `security_audit_log`: created, event+created, actor+created, ip+created
- `auth_rate_limits`: locked_until

Auto-migracija: `lib/db.ts` + ručno `scripts/migrate-v7-security.sql`.

### 10. Detekcija sumnjive admin aktivnosti
Heuristike (audit `admin.suspicious`, **ne blokira** automatski):
- Burst admin API (>40/min)
- Burst failed login sa istog IP (>15/15min)
- Osetljive mutacije + volumen

Fajl: `lib/security/suspicious.ts`.

### Dodatno (zahtevi korisnika)

| Zahtev | Status |
|--------|--------|
| Admin ostaje pun kontrola u Podešavanjima | ✅ RBAC nepromenjen (`role === 'admin'`) |
| Odjavi me svuda (admin) | ✅ POST `/api/admin/sessions` + self revoke |
| Uređaj / grad / država u sesijama | ✅ (postojeće + audit na login) |
| Nema email/lozinki u kodu | ✅ uklonjen placeholder email; primeri u skripti su `<email>` |
| Jača zaštita pri dodavanju korisnika | ✅ lozinka 12+ kompleksnost, cooldown 60s sesije, rate limit 8/h, honeypot polja |

---

## Šta admin i dalje može (nepromenjeno)

- Podešavanja: logo, firma, jezik
- **Korisnici:** dodaj / deaktiviraj / ukloni (samo `user` uloga iz app-a)
- **Aktivne prijave:** pregled, odjavi svuda (sebe i druge)
- Admin se kreira **samo** terminalom: `node scripts/create-user.mjs <email> "<lozinka>" "Ime" admin`

---

## Preostali rizici

| Rizik | Ozbiljnost | Mitigacija / budućnost |
|-------|------------|-------------------------|
| **Serverless rate limit** — DB row po IP+email, race na ekstremnom loadu | Niska | Redis/Upstash KV za distributed lock |
| **CSRF** — stari browseri bez `Sec-Fetch-Site` | Niska | Origin/Referer fallback već postoji |
| **Geo/IP lookup** (ip-api) — HTTP, tačnost | Niska | Vercel geo headers u prod; opciono MaxMind |
| **Nema CAPTCHA** na login/create (UI nije diran) | Srednja | Cloudflare Turnstile (hidden widget) ili WebAuthn za admin |
| **Audit log raste** bez retencije | Srednja | Cron: brisanje >90 dana; export u S3 |
| **JWT u cookie** — ako je ukraden do isteka idle | Srednja | Kraći admin idle; opciono 2FA za admin |
| **Promena role u SQL** bez bump | Srednja | Dokumentovano; koristiti `changeUserRole()` |
| **Legacy JWT v4** sa emailom u payload | Niska | Ističu pri re-login; v5 bez emaila |
| **CSP `unsafe-inline`** (Next.js) | Niska | Nonce-based CSP kad framework podrži |
| **Nema WAF** ispred Vercel-a | Srednja | Cloudflare/Vercel Firewall pravila |
| **Secrets u env** — kompromitovan Vercel projekat | Visoka | Rotacija `JWT_SECRET`, least-privilege MySQL user |

---

## Production readiness checklist

- [ ] Deploy najnovijeg koda na Vercel (Production)
- [ ] Proveriti env: `JWT_SECRET`, `AUTH_REQUIRED=true`, `ADMIN_SESSION_IDLE_MINUTES`
- [ ] Pokrenuti migraciju: prvi request pokreće `lib/db.ts` auto-ALTER, ili `scripts/migrate-v7-security.sql` na Aiven
- [ ] Admin nalog samo preko `create-user.mjs` (ne iz app POST)
- [ ] Test: login → Podešavanja → vidiš korisnike i sesije
- [ ] Test: **Odjavi me svuda** → redirect login → ponovna prijava
- [ ] Test: dodaj korisnika sa lozinkom **12+ znakova** (veliko, malo, cifra, specijal)
- [ ] Test: 6+ pogrešnih admin login → lockout poruka
- [ ] Pregled `security_audit_log` u bazi posle testa
- [ ] Rotacija `JWT_SECRET` planirana (godišnje ili posle incidenta)

---

## Env varijable (sigurnost)

```env
ADMIN_SESSION_IDLE_MINUTES=120
ADMIN_LOGIN_MAX_ATTEMPTS=5
ADMIN_LOGIN_WINDOW_SEC=900
ADMIN_LOGIN_LOCKOUT_SEC=1800
LOGIN_MAX_ATTEMPTS=10
LOGIN_WINDOW_SEC=900
LOGIN_LOCKOUT_SEC=900
ADMIN_CREATE_USER_MAX_PER_HOUR=8
ADMIN_CREATE_USER_COOLDOWN_SEC=60
```

---

## Preporuke za budućnost

1. **2FA za admin** (TOTP) — najveći skok bezbednosti za jednog vlasnika.
2. **Email obaveštenje** pri novom loginu admina (SendGrid/Resend).
3. **Retencija audit loga** + dashboard (filter po `event_type`, IP).
4. **Automatski blok** nakon N `admin.suspicious` događaja (trenutno samo log).
5. **WebAuthn / passkey** za admin umesto lozinke na dugi rok.
6. **Separate admin subdomain** (`admin.app.rs`) + stroži CSP.
7. **MySQL read-only** korisnik za report API-je (ako se dodaju).
8. **Dependabot / npm audit** u CI.

---

## Ključni fajlovi

| Fajl | Uloga |
|------|--------|
| `lib/security/*` | Token hash, CSRF, rate limit, audit, idle, suspicious |
| `lib/security/admin-api.ts` | Wrapper za `/api/admin/*` |
| `services/user-sessions.ts` | Sesije + hash lookup |
| `lib/auth.ts` | JWT v5, admin idle |
| `app/api/auth/login/route.ts` | Rate limit + audit |
| `app/api/admin/users/route.ts` | Guard + password policy + cooldown |
| `app/api/admin/sessions/route.ts` | Guard + self revoke |
| `next.config.ts` | Security headers + CSP |
| `scripts/migrate-v7-security.sql` | Ručna DB migracija |

---

## Zaključak

Sistem je **značajno ojačan** za produkciju uz očuvanje postojećeg admin UX-a i RBAC modela. Preostali rizici su uglavnom operativni (retencija logova, WAF, 2FA) — prihvatljivo za internu aplikaciju sa malim brojem korisnika, uz planirano dodavanje 2FA i audit retencije kada tim poraste.

---

## Dopuna v8 (trust, atomičnost, audit chain, alerts)

### Trust score (0–100) / trustLevel
- Kolone na `user_sessions`: `trust_score`, `trust_level` (`low` | `medium` | `high`).
- Cookie `ponudeapp_device` (UUID, httpOnly) — **nije fingerprint biblioteka**.
- Tabela `user_known_devices` — istorija uređaja po korisniku.
- Heuristike: poznat uređaj, stabilan IP (/24), broj uspešnih prijava, starost naloga.
- **low** → osetljive admin mutacije vraćaju `403` + `reauth_required` (ponovna prijava na istom uređaju).
- **medium / high** → normalan rad.

### Atomična invalidacija sesija
- `withTransaction()` u `lib/db.ts`.
- `atomicRevokeUserSession`, `atomicRevokeAllUserSessions`, `atomicInvalidateSessionsOnRoleChange`, `atomicDeactivateUserSessions` u `lib/security/session-revoke.ts`.
- `SELECT … FOR UPDATE` na `users` pre brisanja sesija + bump `session_version`.

### Nepromenjiv audit log
- Append-only INSERT (nema admin API za UPDATE/DELETE).
- Hash lanac: `prev_hash` + `entry_hash` = SHA-256(prev + canonical JSON).
- `GET_LOCK('ponudeapp_audit_chain')` protiv race na serverless-u.
- Obavezna polja: `request_id`, `action`, `actor_user_id`, `target_user_id`, `ip_address`, `user_agent`, `created_at`.
- `suspicious_flag` na alert zapisima.
- `verifyAuditChainSample()` u `lib/security/audit-log.ts` za operativnu proveru.

### Detekcija sumnjive aktivnosti (samo alert)
- `security.alert` u audit logu + `suspicious_flag=1`.
- Triggeri: nova država <10 min, >5 failed login / 10 min, admin novi uređaj/IP, >3 sesije / 1 min.
- **Ne blokira** automatski (osim postojećih rate limit / trust pravila).

Migracija: `scripts/migrate-v8-trust-audit.sql` ili auto `lib/db.ts`.

**Ažurirani score:** ~**8.4 / 10**
