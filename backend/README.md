# PDF → Excel Converter Service

Python FastAPI microservice za profesionalnu ekstrakciju tabela iz PDF dokumenata.

## Pokretanje (Docker — preporučeno)

```bash
# iz root projekta
docker compose up pdf-converter --build
```

Servis: http://localhost:8000  
Health: http://localhost:8000/api/v1/health

## Lokalni development

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Napomena:** Za OCR i camelot potrebni su sistemski paketi:
- `ghostscript` (camelot)
- `poppler-utils` (pdf2image)

Na macOS: `brew install ghostscript poppler`

## API

| Metoda | Putanja | Opis |
|--------|---------|------|
| GET | `/api/v1/health` | Status servisa |
| POST | `/api/v1/convert` | Upload PDF, pokreće async job |
| GET | `/api/v1/jobs/{id}` | Status, progress, logs, preview |
| GET | `/api/v1/jobs/{id}/download` | Preuzmi .xlsx |
| DELETE | `/api/v1/jobs/{id}` | Obriši job i temp fajlove |

### POST /convert (multipart)

- `file` — PDF
- `export_mode` — `single_sheet` | `multiple_sheets` | `combined`
- `base_name` — naziv Excel fajla

## Parsing pipeline

1. Detekcija tipa PDF (tekst / scan / mixed)
2. Text PDF: camelot lattice → camelot stream → pdfplumber tables → text fallback
3. Scan PDF: PaddleOCR (ako `OCR_ENABLED=true`)
4. Excel generisanje: bold headers, borders, auto width, freeze row, format valuta/datuma

## Env varijable

Vidi `.env.example`.
