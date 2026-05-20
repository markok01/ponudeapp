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
docker compose up pdf-converter --build

# ili lokalno — vidi backend/README.md
```

U `.env.local` dodajte:

```
PDF_CONVERTER_URL=http://localhost:8000
```

Otvorite [http://localhost:3000](http://localhost:3000).

## Stranice

| Ruta | Opis |
|------|------|
| `/` | Dashboard |
| `/products` | Tabela proizvoda, pretraga, filter |
| `/upload` | Upload Excel cenovnika (.xlsx) |
| `/pdf-to-excel` | Profesionalni PDF → Excel konverter |
| `/quotes` | Lista ponuda |
| `/quotes/new` | Quote builder |
| `/quotes/[id]` | Detalji + PDF/Excel export |

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
# ponudeapp
