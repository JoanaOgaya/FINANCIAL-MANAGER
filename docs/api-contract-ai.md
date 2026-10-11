# Speedex FOMS — AI Financial Intelligence Layer API Contract

This specification defines the communication contract between the FOMS Frontend and the AI-Powered Financial Intelligence Layer backend services (FR-001..FR-025, NFR-001..NFR-024).

---

## 1. Core Principles

1. **Zero Client Computation**: All risk scores, confidence percentages, similarity scores, priority rankings, threshold bands, and OCR extractions are computed exclusively by backend AI services. The frontend merely displays these outputs.
2. **AI Disclaimer Display**: Every AI-generated output is accompanied by the non-negotiable disclaimer: `"AI suggestion, requires validation"`.
3. **Two-Level Approval Workflow & Separation of Duties (SoD)**:
   - **Level 1 (Accountant / Asst FM for liquidation)**: Receives AI duplicate flags in status `FLAGGED` or `RETURNED`. Must submit decision `"Mark as Duplicate"` (`decision: DUPLICATE`) or `"Mark as Not Duplicate"` (`decision: NOT_DUPLICATE`) with mandatory remarks. Transitions record to `PENDING_REVIEW`.
   - **Level 2 (Head Accountant / Financial Manager for liquidation)**: Inspects the side-by-side review queue of items in `PENDING_REVIEW`. Can approve (`action: APPROVE`) or return (`action: RETURN` with required remarks).
   - **Separation of Duties (SoD)**: Nobody can approve their own decision. If `decision.decidedBy` equals the current user ID, Approve is forbidden with reason: `"You cannot approve your own decision"`.
   - `FINANCIAL_MANAGER` on non-liquidation duplicates is view-only.
   - `ASSISTANT_FM` is restricted strictly to liquidation and expense documents.
   - Unauthorized access returns HTTP `403 Forbidden` and renders the dedicated 403 Forbidden page.
4. **No Automated Mutation**: No AI recommendation can auto-update, auto-approve, or auto-settle official ledger records without deliberate human validation and submission. Official records change only after Head Accountant (or FM for liquidation) approves (FR-018, FR-019, NFR-013).

---

## 2. Authentication & Authorization

All endpoints require a Bearer token in the `Authorization` header:
```http
Authorization: Bearer <session_token>
```

### Role Matrix

| Endpoint Area | Financial Manager | Head Accountant | Accountant | Asst. Financial Manager |
|---|---|---|---|---|
| Duplicate Pages (View) | All (Full) | All (Full) | Own Scope | Liquidation Docs Only |
| Duplicate Check in Forms | - | Allowed | Allowed | Liquidation Only |
| Decide Duplicate / Not Dup (Level 1) | - | - | Allowed (`FLAGGED`, `RETURNED`) | Liquidation Only (`FLAGGED`, `RETURNED`) |
| Review + Approve / Return (Level 2) | Liquidation Only (`PENDING_REVIEW`) | Allowed (`PENDING_REVIEW`) | - | - |
| Receivable Risk View | All | All | Own Scope | 403 Forbidden |
| Collection Priority & Forecasting | All | All | Own Scope | 403 Forbidden |
| Dashboard AI Alerts | Allowed (Executive) | Allowed (Supervisory) | Allowed (Operational Own) | Liquidation Scope Only |
| Document Upload | - | - | Allowed | Liquidation Only |
| Document Verify / Confirm | View | Verify | Confirm Own Upload | Verify (Liquidation Only) |
| AI Output History (FR-025) | All | All | Own Activity | Liquidation Only |
| Risk Formula / Threshold Bands | Read-Only | Read-Only | Read-Only | Read-Only |

---

## 3. Endpoints

### 3.1 Duplicate Pre-Save Check (FR-002..FR-007, NFR-002)

#### `POST /ai/duplicates/check`
Executes an inline similarity check against historical archives prior to form save.

**Request Body:**
```json
{
  "entityType": "waybill | invoice | receipt | speedpay",
  "fieldName": "waybillNumber | invoiceNumber | receiptNumber | referenceNumber",
  "fieldValue": "string",
  "entityId": "string (optional, for edit mode exclusion)"
}
```

**Response (200 OK):**
```json
{
  "isDuplicate": false,
  "matches": [
    {
      "recordId": "WB-1002",
      "documentNumber": "WB-1002",
      "clientName": "FastTrack Logistics Corp",
      "amount": 2671.80,
      "similarity": 100,
      "matchReason": "Exact match with existing Waybill #WB-1002"
    }
  ],
  "message": "Potential duplicate records detected."
}
```

#### `POST /ai/duplicates/skip-log`
Audits when a user proceeds with manual review after an AI service error or timeout (>5s).

**Request Body:**
```json
{
  "entityType": "string",
  "fieldName": "string",
  "fieldValue": "string",
  "remarks": "string (mandatory justification)"
}
```

#### `POST /ai/duplicates/:id/decide`
Level 1 duplicate decision by Accountant (or Assistant FM for liquidation documents).
Transitions status from `FLAGGED` or `RETURNED` to `PENDING_REVIEW`.

**Request Body:**
```json
{
  "decision": "DUPLICATE | NOT_DUPLICATE",
  "remarks": "string (mandatory justification remarks)",
  "reviewer": "string (name of deciding user)"
}
```

**Response (200 OK):**
```json
{
  "id": "DUP-FLAG-001",
  "status": "PENDING_REVIEW",
  "decision": "DUPLICATE",
  "decidedBy": "Accountant User",
  "decidedRemarks": "Confirmed exact duplicate invoice number and billing period.",
  "decidedAt": "2026-03-11T09:30:00Z"
}
```

#### `POST /ai/duplicates/:id/review`
Level 2 supervisory review by Head Accountant (or Financial Manager for liquidation documents).
Transitions status from `PENDING_REVIEW` to `APPROVED_DUPLICATE` (if Level 1 decision was DUPLICATE), `CLEARED_NOT_DUPLICATE` (if Level 1 decision was NOT_DUPLICATE), or `RETURNED` (if returned to Accountant).

**Request Body:**
```json
{
  "action": "APPROVE | RETURN",
  "remarks": "string (mandatory if action is RETURN, optional for APPROVE)",
  "reviewer": "string (name of supervisory reviewer)"
}
```

**Response (200 OK):**
```json
{
  "id": "DUP-FLAG-001",
  "status": "APPROVED_DUPLICATE",
  "reviewedBy": "Head Accountant User",
  "reviewedRemarks": "Supervisory approval granted.",
  "reviewedAt": "2026-03-11T10:15:00Z"
}
```

---

### 3.2 Dynamic Receivable Risk Scoring (FR-008..FR-013)

#### `GET /ai/risk/config`
Retrieves the dynamic scoring configuration, formula version, and threshold bands. Never hardcoded on client.

**Response (200 OK):**
```json
{
  "formulaVersion": "v2.4-risk-matrix",
  "description": "Multi-factor delinquency model weighting payment history (40%), current aging days (35%), and balance ratio (25%).",
  "lastUpdated": "2026-03-01T00:00:00Z",
  "bands": [
    { "level": "LOW", "min": 0, "max": 33, "color": "#16A34A", "badgeBg": "#F0FDF4", "description": "Low Default Risk" },
    { "level": "MEDIUM", "min": 34, "max": 66, "color": "#D97706", "badgeBg": "#FFFBEB", "description": "Moderate Exposure" },
    { "level": "HIGH", "min": 67, "max": 100, "color": "#DC2626", "badgeBg": "#FEF2F2", "description": "High Delinquency Probability" }
  ]
}
```

#### `GET /ai/risk/invoices/:id`
Retrieves risk calculation and contributing factors for an invoice.

**Response (200 OK):**
```json
{
  "entityId": "INV-2026-004",
  "entityType": "invoice",
  "riskScore": 82,
  "riskLevel": "HIGH",
  "paymentLabel": "OVERDUE",
  "formulaVersion": "v2.4-risk-matrix",
  "computedAt": "2026-03-10T08:00:00Z",
  "factors": [
    { "name": "Days Past Due", "points": 35, "inputValue": "38 days", "description": "Exceeds standard 30-day net terms" },
    { "name": "Historical Delay", "points": 25, "inputValue": "Avg 14 days late", "description": "Client frequently pays outside terms" },
    { "name": "Outstanding Ratio", "points": 22, "inputValue": "68% of credit limit", "description": "High total outstanding relative to limit" }
  ]
}
```

#### `GET /ai/risk/accounts/:id`
Retrieves aggregated risk profile for a client account.

---

### 3.3 Collection Forecasting & Recommendations (FR-014..FR-017)

#### `GET /ai/collection/priorities`
Query params: `?page=1&pageSize=20&scope=all|own|liquidation`

**Response (200 OK):**
```json
{
  "items": [
    {
      "id": "PRIO-001",
      "invoiceNumber": "INV-2026-004",
      "clientName": "Global Prime Agro Exporters",
      "outstandingBalance": 57200.00,
      "dueDate": "2026-03-01",
      "riskScore": 82,
      "riskLevel": "HIGH",
      "priorityRank": 1,
      "daysOverdue": 38,
      "suggestedAction": "Issue formal demand letter and contact Treasury head directly.",
      "aiConfidence": 91
    }
  ],
  "total": 1
}
```

#### `POST /ai/collection/recommendations/:id/review`
Logs human decision on AI recommendation.

**Request Body:**
```json
{
  "decision": "Accept & Close | Proceed with Legal Escalation | Reject Priority Assignment",
  "remarks": "string",
  "recommendedAction": "string"
}
```

---

### 3.4 Document Extraction & Validation (FR-020..FR-024)

#### `POST /ai/documents/upload`
Accepts `multipart/form-data` with document file and `docType`.

**Response (201 Created):**
```json
{
  "id": "DOC-2026-001",
  "fileName": "Express_Billing_INV901.pdf",
  "fileSize": 142850,
  "docType": "invoice",
  "status": "extracted",
  "overallConfidence": 94,
  "uploadedAt": "2026-03-10T10:00:00Z",
  "uploadedBy": "Clara Oswald",
  "fields": [
    { "fieldName": "invoiceNumber", "label": "Invoice Number", "extractedValue": "INV-2026-901", "confidence": 99, "isLowConfidence": false },
    { "fieldName": "totalAmount", "label": "Total Amount", "extractedValue": "54200.00", "confidence": 92, "isLowConfidence": false },
    { "fieldName": "tinNumber", "label": "Client TIN", "extractedValue": "004-912-381-000", "confidence": 64, "isLowConfidence": true, "warning": "Below 70% confidence threshold" }
  ],
  "completeness": [
    { "name": "Company Letterhead / Header", "present": true, "notes": "Clear Speedex Header Present" },
    { "name": "Authorized Signatory", "present": true, "notes": "Signature line verified" },
    { "name": "Tax / TIN Identifier", "present": false, "notes": "TIN field low contrast / blurred" }
  ]
}
```

#### `POST /ai/documents/:id/confirm`
Requires human confirmation and remarks if low-confidence fields were edited.

**Request Body:**
```json
{
  "confirmedFields": { "fieldName": "correctedValue" },
  "remarks": "string (mandatory if any field was changed)"
}
```

---

### 3.5 AI Output Audit History (FR-025)

#### `GET /ai/outputs`
Retrieves chronological audit log of all model inferences, confidence metrics, and user review actions.

---

### 3.6 Dashboard AI Alerts

#### `GET /ai/dashboard/alerts?scope=ROLE`
Returns prioritized actionable alerts scoped to current user's role.
