# PonudeApp — MVP

Aplikacija za upravljanje cenovnicima i kreiranje ponuda.

## Stack

- Next.js App Router + TypeScript
- Tailwind CSS + shadcn/ui komponente
- MySQL (`ponudaapp`) preko `mysql2` (bez Prisma)

## Pokretanje

1. Kreirajte bazu i tabele:

```bash
mysql -u root -p < scripts/init.sql
```

2. Podesite `.env.local` (kopirajte iz `.env.example`):

```
MYSQL_HOST=mysql-xxxxx.c.aivencloud.com
MYSQL_PORT=28711
MYSQL_USER=avnadmin
MYSQL_PASSWORD=vaša_aiven_lozinka
MYSQL_DATABASE=ponudaapp
MYSQL_SSL=true
```

**Važno:** koristite bazu `ponudaapp`, ne `defaultdb`. Na Aiven-u pokrenite `scripts/init.sql` ako tabele još ne postoje.

3. Instalacija i dev server:

```bash
npm install
npm run dev
```

4. PDF → Excel servis (Python FastAPI):

```bash
# Docker (preporučeno)
npm run pdf-converter:docker

# ili lokalno — vidi backend/README.md
```

U `.env.local` dodajte:

```
PDF_CONVERTER_URL=http://localhost:8000
```

**Produkcija (Vercel):** u Project Settings → Environment Variables (ne Shared):

| Varijabla | Opis |
|-----------|------|
| `PDF_CONVERTER_URL` | URL Render servisa (`backend/` deploy) |
| `PDF_CONVERTER_API_KEY` | Isti secret kao `API_KEY` na Renderu |
| `PDF_CONVERTER_TIMEOUT_MS` | Opciono, podrazumevano 300000 |

Bez ovih varijabli PDF konverzija vraća 503 — koristite originalni `.xlsx` cenovnik.

**Test HoReCa PDF lokalno:**

```bash
pip install pdfplumber
node scripts/test-horeca-pdf.mjs "HoReCa cenovnik -primena 01.09.2026.pdf"
```

Otvorite [http://localhost:3000](http://localhost:3000). `/` je marketing; aplikacija je `/app` (posle logina `/products`).

## Operacije (produkcija)

Kratak runbook pre plaćajućih klijenata.

### Deploy (Vercel)

1. Production branch → Vercel Project (ne Shared env za Budget ako delite MYSQL_*).
2. Posle izmene env: **Redeploy**.
3. Provera: `GET https://<domen>/api/health` — `ok: true`, `dbPing: ok`. Stripe/Resend su boolean (`stripeConfigured`, `resendConfigured`) bez tajni.

### Env (kompletna lista u `.env.example`)

Obavezno na Vercelu (Production): `MYSQL_*` (ili `PONUDEAPP_DATABASE` ako Shared `MYSQL_DATABASE=defaultdb`), `JWT_SECRET` (**jedan**, bez `AUTH_SECRET`), `AUTH_REQUIRED=true`, `NEXT_PUBLIC_APP_URL=https://<domen>`.

Po potrebi: Stripe, Resend, `PDF_CONVERTER_*`, `SUPERADMIN_EMAILS`.

`.env.local` je u `.gitignore` — ne commituj ključeve.

### Stripe webhook

Kod (Checkout, Portal, webhook) već postoji; aktivacija je poseban korak.

1. Stripe Dashboard → Developers → Webhooks → endpoint `https://<domen>/api/stripe/webhook`
2. Eventi: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`
3. `STRIPE_WEBHOOK_SECRET` = signing secret (`whsec_...`)
4. Customer Portal: Settings → Billing → Customer portal (uključen)
5. Lokalno: `stripe listen --forward-to localhost:3000/api/stripe/webhook`

### Resend (email)

1. API ključ → `RESEND_API_KEY`, pošiljalac → `EMAIL_FROM`
2. DNS na domenu (Resend Dashboard → Domain): SPF, DKIM, opciono DMARC
3. Dok domen nije verifikovan, koristi `onboarding@resend.dev` samo za test na sopstveni inbox
4. Bez ključa u dev-u mail se loguje u konzolu (nije „poslato“)

### Super-admin (operator, nije klijent)

Pristup: `users.role = superadmin` **ili** email u `SUPERADMIN_EMAILS`.

```bash
node scripts/create-user.mjs you@example.com "<lozinka>" "Ops" superadmin
```

Ruta `/internal/admin` — lista org, plan, status, suspend. **Nije u sidebaru.** Impersonate je isključen.

Suspend org → niko iz te firme ne može login (postojeće sesije padaju). Super-admin i dalje može da uđe da ukine suspenziju.

### Backup (Aiven)

Aiven MySQL radi **automated backups** (service → Backups). Restore:

1. Aiven Console → servis → **Backups** → Restore (novi servis ili fork, ne overwrite produkcije naslepo)
2. Ažuriraj `MYSQL_HOST` / `MYSQL_PORT` / lozinku na novi endpoint
3. Proveri `MYSQL_DATABASE` / `PONUDEAPP_DATABASE=ponudaapp` (ne `defaultdb`)
4. `GET /api/health` dok `dbPing=ok`

Opciono lokalno (samo DDL, bez podataka):

```bash
npm run backup:schema
```

Fajl ide u `backups/` (gitignored).

## Stranice

| Ruta | Opis |
|------|------|
| `/` | Marketing (ulogovani → `/app`) |
| `/app` | Početna aplikacije |
| `/products` | Tabela proizvoda, pretraga, filter |
| `/upload` | Upload Excel cenovnika (.xlsx) |
| `/pdf-to-excel` | Profesionalni PDF → Excel konverter |
| `/quotes` | Lista ponuda |
| `/quotes/new` | Quote builder |
| `/quotes/[id]` | Detalji + PDF/Excel export |
| `/settings/billing` | Plan / Stripe |
| `/internal/admin` | Operator: org + suspend (nije u meniju) |

## Upload cenovnika

Preporučeno: **.xlsx** (Excel). Za PDF koristite stranicu **PDF → Excel** (`/pdf-to-excel`) — podržava tabele, više stranica, OCR za skenirane dokumente.

## PDF → Excel

Profesionalni konverter sa Python FastAPI microservice-om:

- pdfplumber + camelot za tekstualne PDF-ove
- PaddleOCR za skenirane PDF-ove
- Više export modova (jedan sheet, više sheetova, combined)
- Preview podataka pre preuzimanja
- Async job processing sa progress logovima

Vidi `backend/README.md` za API i Docker setup.

Prvi red — zaglavlje. Podržane kolone:

- `sku` (obavezno)
- `name` ili `naziv` (obavezno)
- `price` ili `cena` (obavezno)
- `category` ili `kategorija` (opciono)

Ako SKU postoji → ažurira se cena. Inače → novi proizvod.

## API

- `GET/POST /api/products`
- `GET/POST /api/quotes`
- `GET /api/quotes/:id`
- `POST /api/upload` (multipart form)
