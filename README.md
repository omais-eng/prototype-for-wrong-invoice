# AI Invoice Resolution Platform (AIRP)

An AI-powered Invoice Validation and Resolution System built to handle **200,000+ invoices per year**, automatically detecting errors, duplicates, PO mismatches, and contract violations — then routing invoices to the right action without manual work.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         AIRP — System Overview                      │
├─────────────┬──────────────────────────────────────┬───────────────┤
│  Email/IMAP │   Document Processing (OCR + LLM)   │  File Upload  │
│  Ingestion  │   PDF · Excel · Scanned Images       │  Dashboard    │
└──────┬──────┴────────────────┬─────────────────────┴───────┬───────┘
       │                       │                             │
       ▼                       ▼                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        FastAPI Backend (port 8000)                  │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │ Duplicate    │  │ PO Matching  │  │ Contract     │             │
│  │ Detection    │  │ Engine       │  │ Validation   │             │
│  │ (hash+fuzzy  │  │ (±2% tol.)  │  │ (rate check) │             │
│  │ +embeddings) │  └──────────────┘  └──────────────┘             │
│  └──────────────┘                                                   │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │              AI Analysis Layer (Claude 3.5 Sonnet)           │  │
│  │  • Error explanations  • Risk scoring  • Email drafting      │  │
│  └──────────────────────────────────────────────────────────────┘  │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
          ┌────────────────┼─────────────────┐
          ▼                ▼                 ▼
   ┌─────────────┐  ┌──────────┐  ┌──────────────────┐
   │  PostgreSQL │  │  Redis   │  │  Mock ERP API    │
   │  (port 5432)│  │  (6379)  │  │  (port 8001)     │
   └─────────────┘  └──────────┘  └──────────────────┘
          │
          ▼
   ┌─────────────────────────────────────────────────┐
   │         Next.js Dashboard (port 3000)           │
   │  • Invoice Inbox  • Validation Results          │
   │  • Approval Queue • History  • Vendor Errors    │
   └─────────────────────────────────────────────────┘
```

---

## Features

| Module | What it does |
|--------|-------------|
| **Email Ingestion** | Polls IMAP inbox, extracts PDF/Excel/image attachments |
| **Document Processing** | OCR (Tesseract), LLM extraction (Claude), Excel parsing |
| **Duplicate Detection** | SHA256 exact match + fuzzy (amount/date) + semantic embeddings |
| **PO Matching** | Validates vendor, quantities, prices against open POs (±2% tolerance) |
| **Contract Validation** | Checks invoice rates against approved contract rates |
| **AI Reasoning** | Explains errors, scores risk 0–100, drafts vendor rejection emails |
| **Auto Notification** | Sends rejection emails to vendors, approval requests to managers |
| **Manager Dashboard** | Approve / Reject / Request Clarification with one click |
| **ERP Integration** | Pushes approved invoices to ERP (mock for prototype) |

---

## Quick Start

### Option A — Docker Compose (recommended)

```bash
# 1. Clone and configure
cp .env.example .env
# Edit .env to add ANTHROPIC_API_KEY (optional — system works without it)

# 2. Start all services
docker compose up --build

# 3. Open dashboard
open http://localhost:3000
```

Services started:
- `http://localhost:3000` — Frontend Dashboard
- `http://localhost:8000` — Backend API (`/docs` for Swagger)
- `http://localhost:8001` — Mock ERP (`/docs` for Swagger)
- `http://localhost:5432` — PostgreSQL
- `http://localhost:6379` — Redis

---

### Option B — Local Development

#### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate           # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Install system deps (macOS)
brew install tesseract poppler

# Install system deps (Ubuntu/Debian)
# sudo apt-get install -y tesseract-ocr poppler-utils

# Start PostgreSQL (or use Docker)
docker run -d -p 5432:5432 \
  -e POSTGRES_USER=airp \
  -e POSTGRES_PASSWORD=airp_pass \
  -e POSTGRES_DB=airp_db \
  postgres:15-alpine

cp ../.env.example .env
uvicorn main:app --reload --port 8000
```

#### Mock ERP

```bash
cd mock-erp
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```

#### Frontend

```bash
cd frontend
npm install
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1 npm run dev
```

---

## Seeding Test Data

```bash
# Generate sample invoice files (PDF, Excel)
cd scripts
pip install reportlab openpyxl faker
python generate_sample_invoices.py
# Output: scripts/sample_invoices/

# Seed database with 200 realistic invoices
python seed_database.py
```

---

## API Reference

### Invoice Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/invoices/upload` | Upload and process invoice file |
| `GET` | `/api/v1/invoices` | List invoices (filters: status, vendor, date) |
| `GET` | `/api/v1/invoices/{id}` | Invoice detail with validation results |
| `PUT` | `/api/v1/invoices/{id}/approve` | Manager approves → pushes to ERP |
| `PUT` | `/api/v1/invoices/{id}/reject` | Manager rejects with reason |
| `POST` | `/api/v1/invoices/{id}/revalidate` | Re-run all validations |
| `GET` | `/api/v1/invoices/stats/summary` | Dashboard statistics |

### Dashboard Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/dashboard/stats` | Aggregate counts and trends |
| `GET` | `/api/v1/dashboard/recent-activity` | Last 20 events |
| `GET` | `/api/v1/dashboard/error-breakdown` | Error type distribution |

Full interactive docs at `http://localhost:8000/docs`

---

## Invoice Processing Flow

```
Email received / File uploaded
        │
        ▼
  Extract attachment (PDF / Excel / Image)
        │
        ▼
  OCR + LLM extraction → structured JSON
        │
        ▼
  ┌─────────────────────────────────┐
  │        Validation Engine        │
  │                                 │
  │  1. Required fields check       │
  │  2. Math verification           │
  │  3. Duplicate detection         │
  │     └─ Exact hash               │
  │     └─ Fuzzy (amount + date)    │
  │     └─ Semantic embeddings      │
  │  4. Vendor status check         │
  │  5. PO matching (±2%)           │
  │  6. Contract compliance         │
  └────────────┬────────────────────┘
               │
       ┌───────┴────────┐
       │                │
   PASSED            FAILED
       │                │
       ▼                ▼
  AI Summary      AI explains errors
  → Manager       → Draft rejection email
    Approval        → Auto-send to vendor
    Queue
       │
       ▼
  Manager: Approve / Reject
       │
       ▼
  Push to ERP
```

---

## Error Codes

| Code | Meaning |
|------|---------|
| `DUPLICATE_INVOICE` | Same invoice number already submitted |
| `PO_NOT_FOUND` | PO number not found in ERP |
| `PO_MISMATCH` | Invoice fields don't match PO |
| `VENDOR_MISMATCH` | Vendor on invoice ≠ vendor on PO |
| `PRICE_MISMATCH` | Price deviation > 2% from PO |
| `QUANTITY_MISMATCH` | Quantity differs from PO |
| `CONTRACT_VIOLATION` | Total exceeds contract value |
| `PRICE_NOT_APPROVED` | Rate not in approved contract rates |
| `MATH_ERROR` | Line items don't sum to stated total |
| `MISSING_FIELD` | Required field absent |
| `VENDOR_INACTIVE` | Vendor is inactive in ERP |

---

## Configuration

All settings via environment variables (see `.env.example`):

| Variable | Default | Notes |
|----------|---------|-------|
| `ANTHROPIC_API_KEY` | _(empty)_ | Leave empty for template fallback mode |
| `DATABASE_URL` | `postgresql+asyncpg://...` | Async PostgreSQL |
| `MOCK_ERP_URL` | `http://localhost:8001` | Switch to real ERP in production |
| `SMTP_HOST/USER/PASS` | _(empty)_ | Leave empty for console-log mock |
| `IMAP_HOST/USER/PASS` | _(empty)_ | Leave empty to disable inbox polling |

---

## Project Structure

```
prototype-for-wrong-invoice/
├── docker-compose.yml
├── .env.example
├── README.md
│
├── backend/                        # FastAPI backend
│   ├── main.py
│   ├── requirements.txt
│   ├── Dockerfile
│   └── app/
│       ├── config.py
│       ├── database.py
│       ├── models/                 # SQLAlchemy ORM models
│       │   ├── vendor.py
│       │   ├── purchase_order.py
│       │   ├── contract.py
│       │   ├── invoice.py
│       │   └── validation_log.py
│       ├── schemas/                # Pydantic request/response schemas
│       ├── services/               # Business logic
│       │   ├── email_service.py
│       │   ├── document_service.py
│       │   ├── duplicate_detection.py
│       │   ├── validation_service.py
│       │   ├── ai_service.py
│       │   ├── erp_service.py
│       │   └── notification_service.py
│       └── routers/                # API route handlers
│           ├── invoices.py
│           ├── vendors.py
│           ├── purchase_orders.py
│           └── dashboard.py
│
├── mock-erp/                       # Simulated ERP API
│   ├── main.py
│   ├── requirements.txt
│   ├── Dockerfile
│   └── data/
│       └── seed_data.py
│
├── frontend/                       # Next.js dashboard
│   ├── app/
│   │   ├── page.tsx               # Dashboard home
│   │   ├── invoices/page.tsx      # Invoice inbox
│   │   ├── validation/page.tsx    # Validation results
│   │   ├── approval/page.tsx      # Manager approval queue
│   │   ├── history/page.tsx       # Invoice history
│   │   └── vendor-errors/page.tsx # Vendor error logs
│   ├── components/
│   │   ├── Sidebar.tsx
│   │   ├── InvoiceUpload.tsx
│   │   ├── StatusBadge.tsx
│   │   └── ValidationDetails.tsx
│   └── lib/api.ts
│
└── scripts/
    ├── seed_database.py            # Populate DB with test data
    └── generate_sample_invoices.py # Generate test PDF/Excel files
```

---

## Scaling Notes

This prototype is designed to scale to 200,000 invoices/year:

- **Async FastAPI** — non-blocking I/O throughout
- **PostgreSQL** — indexed on `vendor_id`, `invoice_number`, `status`, `created_at`
- **Redis** — available for caching ERP lookups and rate limiting
- **Celery** — dependency included for background task queue (email polling, bulk processing)
- **Duplicate embeddings** — stored in DB, can be migrated to pgvector/Pinecone for scale
- **Stateless services** — all services are horizontally scalable behind a load balancer

---

## License

MIT — built as a prototype. Replace mock ERP with real ERP integration before production use.
