# FOMS API Contract Specification

This document details the REST API, WebSocket, and Server-Sent Events (SSE) contract for the **FOMS (Financial Operations Management System)** frontend web application (`frontend/`).

---

## 1. General Architecture & Base URLs

- **Default Base URL:** `http://localhost:4000` (development mock) / `http://localhost:8000/api` (production backend)
- **Content-Type:** `application/json`
- **Authentication Header:** `Authorization: Bearer <accessToken>`
- **Standard Paging Response Structure:**
  ```json
  {
    "items": [...],
    "total": 120,
    "page": 1,
    "pageSize": 20
  }
  ```

---

## 2. Authentication & User Sessions

### `POST /auth/login`
Authenticates a user session.
- **Request Body:**
  ```json
  {
    "employeeId": "EMP-001",
    "password": "Password@FM2026"
  }
  ```
- **Success Response (200 OK):**
  ```json
  {
    "accessToken": "eyJhbGciOiJIUzI1NiIsIn...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsIn...",
    "user": {
      "id": "usr-001",
      "employeeId": "EMP-001",
      "fullName": "Eleanor Vance",
      "role": "FINANCIAL_MANAGER",
      "email": "eleanor.vance@speedex.com"
    }
  }
  ```

### `GET /auth/me`
Fetches active user profile from Bearer token.
- **Response (200 OK):** User object.

### `POST /auth/logout`
Terminates the user session.

---

## 3. Core FOMS Business Endpoints

### 3.1 Clients (`/clients`)
- `GET /clients` — Query params: `page`, `pageSize`, `search`, `status`
- `GET /clients/:id`
- `POST /clients` — Create new corporate or individual client
- `PUT /clients/:id` — Update client profile

### 3.2 Invoices (`/invoices`)
- `GET /invoices` — Query params: `page`, `pageSize`, `status`, `clientId`, `dateFrom`, `dateTo`
- `GET /invoices/:id`
- `POST /invoices` — Create new invoice
- `PUT /invoices/:id` — Edit invoice details
- `POST /invoices/:id/approve` — Approve pending invoice (`HEAD_ACCOUNTANT` or `FINANCIAL_MANAGER`)
- `POST /invoices/:id/reject` — Reject invoice with `reason`

### 3.3 Payments (`/payments`)
- `GET /payments` — Query params: `page`, `pageSize`, `status`, `invoiceId`
- `GET /payments/:id`
- `POST /payments` — Record payment transaction

### 3.4 Settlements & Adjustments (`/settlements`, `/adjustments`)
- `GET /settlements` / `POST /settlements`
- `GET /adjustments` / `POST /adjustments`

### 3.5 Accounts Receivable & Aging (`/ar`)
- `GET /ar` — Aging breakdown and AR records per client
- `GET /ar/aging-summary` — Current, 1-30, 31-60, 61-90, 90+ buckets

### 3.6 SpeedPay Submissions (`/speedpay`)
- `GET /speedpay` — Query params: `page`, `pageSize`, `status`, `dateFrom`, `dateTo`
- `POST /speedpay/:id/validate` — Validate payment (`HEAD_ACCOUNTANT`, `FINANCIAL_MANAGER`)
- `POST /speedpay/:id/reject` — Reject with `reason`

---

## 4. AI-Powered Financial Intelligence Layer

See [`docs/api-contract-ai.md`](./api-contract-ai.md) for full specifications:
- `POST /ai/duplicates/check` — Pre-save duplicate detection
- `GET /ai/duplicates` — AI duplicate flag queue
- `POST /ai/duplicates/:id/decide` — Level 1 decision (`DUPLICATE` | `NOT_DUPLICATE`) by Accountant / Asst. FM
- `POST /ai/duplicates/:id/review` — Level 2 decision (`APPROVE` | `RETURN`) by Head Accountant / FM
- `GET /ai/risk/factors` — Dynamic factor breakdown
- `GET /ai/documents/unique` — Unique document store

---

## 5. Real-Time Push Channels

- **WebSocket:** `ws://<host>:<port>/ws`
- **Server-Sent Events (SSE):** `http://<host>:<port>/events`
- **Topics:** `invoices`, `payments`, `waybills`, `duplicates`, `notifications`
