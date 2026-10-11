# FOMS Standalone Mock API Server

A standalone Node.js mock API designed to support frontend pair-programming and manual UI testing for all 4 roles without connecting to a real backend.

---

## 🚀 How to Run

From the project root (`AI-LAYER`):

### 1. Default Mode (with realistic seed data)
```bash
npm run mock:api
```
Starts the server on `http://localhost:4000` with seeded records for clients, invoices, payments, waybills, liquidations, AR records, audit logs, and notifications.

### 2. Empty State Mode (test empty UI tables and prompts)
```bash
npm run mock:api -- --empty
```
Starts the server with 0 records in all business entity tables (only the 4 test users are retained for login). Useful to test empty table states, "No data available" screens, and new record creations.

### 3. Failure Mode (test 502 error handling and network resilience)
```bash
npm run mock:api -- --fail
```
All API endpoints return `502 Bad Gateway` to verify that UI error toasts, empty fallback views, and network failure warnings render gracefully.

---

## 👥 Test Accounts (4 User Roles)

Use any of these 4 credentials on the `/login` screen.

| Role | Employee ID | Username | Password | Full Name | Primary Dashboard / Modules |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **FINANCIAL_MANAGER** | `EMP-001` | `fm` | `Password@FM2026` | Eleanor Vance | Executive Dashboard, Invoice Approvals, Settlements, Adjustments, Cash Flow, Liquidations |
| **HEAD_ACCOUNTANT** | `EMP-002` | `ha` | `Password@HA2026` | Arthur Pendelton | Invoicing Review, Payment Validation, Adjustments, SpeedPay, Settlements, Audit Logs |
| **ACCOUNTANT** | `EMP-003` | `acc` | `Password@AC2026` | Clara Oswald | Invoicing Desk, Clients, Rates, Waybills, AR Management, Payments, Record Settlement |
| **ASSISTANT_FM** | `EMP-004` | `afm` | `Password@AF2026` | Miles Morales | Liquidation Reports, Unique Documents, Flagged Duplicates, Review History |

---

## 📡 Real-Time Testing

- **WebSocket**: `ws://localhost:4000/ws`
  - Accepts connections and automatically emits `{ "topic": "*" }` or specific topics (`invoices`, `payments`, `waybills`, `notifications`, etc.) whenever mutations occur.
- **Server-Sent Events (SSE)**: `http://localhost:4000/events`
  - Standard EventSource streaming for testing browser push events.

---

## 🛠 Implemented Endpoints

All endpoints support an optional `/api` prefix (e.g. `/api/invoices` routes identically to `/invoices`).

### 1. Authentication
- `POST /auth/login` — Accepts `{ employeeId, password }` or `{ username, password }`. Returns `{ accessToken, refreshToken }` or `401`.
- `GET /auth/me` — Bearer token authentication. Returns `{ id, fullName, role, email }`.
- `POST /auth/logout` — Revokes the active session token.

### 2. Dashboard & Navigation
- `GET /dashboard/summary` — Executive KPIs, attention items, aging distribution, and cash flow trends.
- `GET /dashboard/nav-badges` — Real-time badge counts for sidebar counters.

### 3. Invoices (`/invoices`)
- `GET /invoices` — Query params: `page`, `pageSize`, `search`, `status`, `sortBy`, `sortDir`, `clientId`.
- `POST /invoices` — Create a new invoice.
- `GET /invoices/:id` — Invoice details by ID or invoice number.
- `PUT /invoices/:id` — Update invoice attributes.
- `DELETE /invoices/:id` — Remove invoice.
- `POST /invoices/:id/submit` — Transition to `Pending Approval`.
- `POST /invoices/:id/verify` — Transition to `Approved`.
- `POST /invoices/:id/approve` — Financial Manager approval.
- `POST /invoices/:id/return` — Return invoice with revision remarks.
- `POST /invoices/:id/reject` — Reject invoice with revision remarks.

### 4. Payments & Receipts
- `GET /payments` — List payments with filter/sort/pagination.
- `POST /payments` — Record new payment.
- `GET /payments/:id` — Payment details.
- `POST /payments/:id/verify` — Validate payment.
- `POST /payments/:id/approve` — Approve payment.
- `POST /payments/:id/reject` — Reject payment.
- `GET /official-receipts` — Official receipt registers.
- `POST /official-receipts` — Issue official receipt.

### 5. Accounts Receivable
- `GET /ar/records` — Accounts receivable records with aging brackets.
- `GET /ar/aging` — AR aging category breakdown.
- `GET /ar/follow-ups` — Client collection communication history.
- `POST /ar/follow-ups` — Log collection follow-up activity.

### 6. AI Recommendations & Duplicate Detection
- `GET /ai/collection/recommendations` — AI collection suggestions.
- `POST /ai/collection/recommendations/new` — Log priority decision.
- `POST /ai/collection/recommendations/:id/review` — Review recommendation.
- `POST /ai/duplicates/scan` — Upload document to trigger AI duplicate inspection.
- `GET /ai/duplicates` — List flagged duplicate records.
- `GET /ai/duplicates/unique-documents` — Verified unique records.
- `GET /ai/duplicates/review-history` — Audit trail of duplicate decisions.
- `POST /ai/duplicates/:id/:action` — Resolve or dismiss duplicate flags.

### 7. Waybills & Logistics
- `GET /waybills` (or `/shipment-records`) — Query waybills.
- `POST /waybills` — Create new waybill.
- `GET /waybills/:id` — Waybill details.
- `POST /waybills/:id/:action` — Transition status (`verify`, `return`, `approve`).

### 8. Liquidations & Treasury
- `GET /liquidations` — Courier expense liquidation reports.
- `POST /liquidations` — Submit liquidation.
- `POST /liquidations/:id/:action` — Transition status (`verify`, `return`, `approve`).
- `GET /cash-flow` (or `/cashflow`) — Cash inflow and outflow ledger.
- `POST /cash-flow` — Record cash movement.
- `GET /settlements` — Driver settlement envelopes and discrepancies.
- `POST /settlements` — Record driver settlement.
- `POST /settlements/:id/:action` — Validate settlement.
- `GET /adjustments` — Financial adjustments and credit memos.
- `POST /adjustments` — Record financial adjustment.

### 9. SpeedPay Portal Integration
- `GET /speedpay/submissions` — Proof of payment submissions.
- `POST /speedpay/submissions` — Public payment upload.
- `POST /speedpay/submissions/:id/verify` — Approve or reject payment proof.

### 10. Audit & Control
- `GET /audit-logs` — Immutable system audit trail.
- `GET /users` — Staff roster.
- `PATCH /users/:id/status` — Activate/deactivate user accounts.
- `GET /notifications` — User notifications.
- `PATCH /notifications/:id` — Mark notification read/unread.
- `POST /notifications/read-all` — Mark all notifications read.
- `DELETE /notifications` — Clear notification center.
