# GrowEasy AI CSV Importer — Backend

AI-powered backend that accepts **any CSV format** (Facebook Lead Ads, Google Ads exports, Excel sheets, real-estate CRM exports, manually created spreadsheets, etc.) and intelligently maps it into GrowEasy's canonical CRM lead schema using **Gemini**, with optional persistence to **Supabase**.

Built for the GrowEasy Software Developer (Intern) assignment.

---

## Why this design

The assignment is explicit that **the challenge is not parsing CSVs — it's robust, arbitrary-schema field mapping.** The architecture reflects that:

- **CSV parsing is dumb and deterministic** (`csv-parse`), headers are never assumed — whatever columns exist are preserved verbatim.
- **All intelligence lives in the prompt + schema** (`src/prompts/extraction.prompt.ts`), which encodes every rule from the assignment: enum whitelists for `crm_status`/`data_source`, the multi-email/multi-mobile → `crm_note` rule, the "skip if no email & no mobile" rule, and the JS-`Date`-parseable `created_at` requirement.
- **The AI's output is never trusted blindly.** `gemini.service.ts` re-validates every record server-side (enum whitelist check, date-parseability check, skip-rule enforcement) — defense in depth in case the model drifts from instructions.
- **Batching + bounded concurrency + retries.** Rows are chunked (`BATCH_SIZE`), batches run with a concurrency pool (`BATCH_CONCURRENCY`) instead of one-at-a-time or all-at-once, and each batch retries with exponential backoff (`BATCH_MAX_RETRIES`) before gracefully degrading — a failed batch is marked "skipped with reason" rather than crashing the whole import.
- **Stateless by default, persistent if you want it.** Supabase is fully optional (`isSupabaseConfigured`). Without it the API still works end-to-end; with it, every import run and its leads are stored for history/audit (`GET /api/leads/imports/:id`).

---

## Tech Stack

- **Runtime:** Node.js 18+, TypeScript (strict mode)
- **Framework:** Express
- **AI:** Google Gemini (`@google/generative-ai`), structured JSON output via `responseSchema`
- **Database (optional):** Supabase (Postgres)
- **Upload handling:** Multer (in-memory, 5MB limit, CSV-only filter)
- **CSV parsing:** `csv-parse`

---

## Project Structure

```
src/
├── config/          # env loading, Supabase client
├── controllers/      # request handlers (thin — delegate to services)
├── services/          # csv parsing, Gemini extraction, orchestration, persistence
├── middleware/        # multer upload, async wrapper, global error handler
├── routes/             # route wiring
├── prompts/            # the extraction prompt (single source of truth for AI rules)
├── types/               # shared TS types (CrmRecord, ImportSummary, etc.)
├── utils/                # logger, AppError, batching/concurrency helpers
├── app.ts                 # Express app (middleware, routes)
└── server.ts               # entrypoint
supabase/
└── schema.sql               # optional Postgres schema
```

---

## Setup

### 1. Prerequisites
- Node.js 18+
- A Gemini API key: https://aistudio.google.com/app/apikey
- (Optional) A Supabase project: https://supabase.com

### 2. Install & configure

```bash
git clone <your-repo-url>
cd groweasy-backend
npm install
cp .env.example .env
```

Edit `.env`:

```bash
GEMINI_API_KEY=your_gemini_api_key_here     # required
GEMINI_MODEL=gemini-2.0-flash               # default is fine

# optional — leave blank to run stateless
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

### 3. (Optional) Set up Supabase persistence

In your Supabase project's SQL editor, run `supabase/schema.sql`. This creates `import_runs` and `leads` tables. If you skip this step, just leave the Supabase env vars blank — every endpoint still works, imports just aren't saved anywhere.

### 4. Run

```bash
npm run dev      # local dev with hot reload (ts-node-dev)
# or
npm run build && npm start   # production build
```

Server starts on `http://localhost:4000` (configurable via `PORT`).

### 5. Docker (optional)

```bash
docker compose up --build
```

---

## API Reference

### `GET /api/health`
Health check. Returns whether persistence is `supabase` or `stateless`.

### `POST /api/csv/preview`
Accepts a CSV upload and parses it — **no AI processing**. Optional helper for the frontend's Step 2 preview table (the frontend can equally do this client-side with a CSV parsing library; this endpoint exists because the assignment lists "Accept CSV Upload" and "Parse CSV" as explicit backend capabilities).

- **Body:** `multipart/form-data`, field `file` (the `.csv`)
- **Response 200:**
```json
{
  "success": true,
  "data": {
    "headers": ["Full Name", "Email Address", "Phone", "..."],
    "rows": [{ "Full Name": "Rahul Sharma", "...": "..." }],
    "totalRows": 3,
    "truncated": false
  }
}
```

### `POST /api/leads/import`
**The main endpoint** — called once, when the user clicks **Confirm**. Runs the full pipeline: accept upload → parse CSV → batch AI extraction (Gemini) → return structured CRM JSON.

- **Body:** `multipart/form-data`, field `file` (the `.csv`)
- **Response 200:**
```json
{
  "success": true,
  "data": {
    "importId": "b3f1...",
    "totalRows": 50,
    "totalImported": 47,
    "totalSkipped": 3,
    "imported": [
      {
        "created_at": "2026-05-13 14:20:48",
        "name": "John Doe",
        "email": "john.doe@example.com",
        "country_code": "+91",
        "mobile_without_country_code": "9876543210",
        "company": "GrowEasy",
        "city": "Mumbai",
        "state": "Maharashtra",
        "country": "India",
        "lead_owner": "test@gmail.com",
        "crm_status": "GOOD_LEAD_FOLLOW_UP",
        "crm_note": "Client is asking to reschedule demo",
        "data_source": "",
        "possession_time": null,
        "description": null
      }
    ],
    "skipped": [
      {
        "original_row_index": 12,
        "reason": "Missing both email and mobile number",
        "raw_row": { "Name": "Walk-in visitor", "City": "Delhi" }
      }
    ],
    "batches": { "total": 4, "failed": 0 },
    "persisted": true
  }
}
```

### `GET /api/leads/imports/:importId`
Fetch a previously persisted import run (only works if Supabase is configured; otherwise returns 404).

---

## Example: curl

```bash
curl -X POST http://localhost:4000/api/leads/import \
  -F "file=@./sample_leads.csv"
```

---

## Error Handling

- Non-CSV files, missing files, and files over 5MB are rejected with `400` before any AI call.
- Malformed CSVs return a clear `400` with the parser error.
- A failed AI batch retries 3× with exponential backoff (1s → 2s → 4s); if still failing, those rows are marked `skipped` with a reason instead of failing the entire import.
- All errors funnel through a single Express error-handling middleware and return a consistent `{ success: false, error }` shape.

## Configuration reference (`.env`)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `4000` | Server port |
| `CORS_ORIGIN` | `*` | Comma-separated allowed origins |
| `GEMINI_API_KEY` | — | **Required.** Google AI Studio key |
| `GEMINI_MODEL` | `gemini-2.0-flash` | Gemini model name |
| `BATCH_SIZE` | `15` | Rows per AI extraction call |
| `BATCH_CONCURRENCY` | `3` | Parallel batches in flight |
| `BATCH_MAX_RETRIES` | `3` | Retries per failed batch |
| `MAX_FILE_SIZE_MB` | `5` | Upload size limit |
| `SUPABASE_URL` | — | Optional |
| `SUPABASE_SERVICE_ROLE_KEY` | — | Optional |

## Deployment

Any Node host works (Render, Railway, Fly.io, etc.):
1. Set the environment variables above in the platform's dashboard.
2. Build command: `npm run build`
3. Start command: `npm start`

The included `Dockerfile` is a self-contained multi-stage build if you prefer container deploys.
