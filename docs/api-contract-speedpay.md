# SpeedPay Client Portal — API Contract Specification

This document details the REST API specification for the standalone **SpeedPay Client Portal** application (`speedpay/`).

---

## 1. Overview & Architecture

- **Application:** SpeedPay Standalone Web App (`speedpay/`)
- **Port:** `5174` (Development) / `4174` (Preview)
- **Target API Service:** `http://localhost:4000` (Mock API) / `http://localhost:8000/api` (Backend)
- **Role:** Customer / Client self-service portal to view outstanding invoices, select digital payment options (PayMongo, GCash, Maya, QRPh Bank Transfer), upload proof of payment, and track validation status.

---

## 2. Authentication & Session

SpeedPay supports both authenticated client logins and tokenized invoice access links.

### `POST /speedpay/auth/client-login`
- **Request Body:**
  ```json
  {
    "clientCode": "CLI-001",
    "accessCode": "SecretPin123"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "token": "eyJhbGciOi...",
    "client": {
      "id": "cli-001",
      "name": "Acme Logistics Inc.",
      "email": "billing@acmelogistics.com"
    }
  }
  ```

---

## 3. Client Invoices & Lookup

### `GET /speedpay/invoices`
Fetches outstanding and historical invoices for the authenticated client.
- **Headers:** `Authorization: Bearer <token>`
- **Response (200 OK):**
  ```json
  {
    "items": [
      {
        "id": "inv-001",
        "invoiceNumber": "INV-2026-0001",
        "totalAmount": 45000.00,
        "balance": 45000.00,
        "dueDate": "2026-11-15",
        "status": "UNPAID"
      }
    ]
  }
  ```

### `GET /speedpay/invoices/:invoiceNumber`
Direct lookup of an invoice by number or scanned QR code without full login.
- **Response (200 OK):** Invoice details and payable amount.

---

## 4. Payment Submission & Proof Upload

### `POST /speedpay/submissions`
Creates a client payment submission record awaiting FOMS verification.
- **Request Body:**
  ```json
  {
    "invoiceId": "inv-001",
    "invoiceNumber": "INV-2026-0001",
    "amountPaid": 45000.00,
    "paymentMethod": "gcash",
    "referenceNumber": "GCASH-99882211",
    "proofImageUrl": "data:image/png;base64,...",
    "submittedAt": "2026-10-11T08:30:00Z"
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "id": "sp-sub-101",
    "referenceNumber": "GCASH-99882211",
    "status": "Pending Validation",
    "message": "Payment submission received and queued for accounting review."
  }
  ```

### `GET /speedpay/submissions/:id/status`
Checks the real-time review status of a submitted payment.
- **Response (200 OK):**
  ```json
  {
    "id": "sp-sub-101",
    "status": "Validated",
    "validatedAt": "2026-10-11T09:15:00Z",
    "receiptNumber": "OR-2026-0042"
  }
  ```
