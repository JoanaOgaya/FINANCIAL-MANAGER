# Finance Operations Management System (FOMS) & Financial Intelligence Platform

An enterprise financial management platform that integrates the core Finance Operations Management System (FOMS) with an AI-driven Financial Intelligence Layer for automated billing, digital payment processing, delinquency risk assessment, and document validation.

---

## Repository Structure

```text
FOMS-System-Repository/
|
+-- foms-frontend/              Staff Operations & AI Intelligence Web App (React, TypeScript, Vite)
+-- foms-backend/               Core Financial Web API (.NET 10, EF Core 9, SQL Server)
|   +-- FOMS.Api/               API Entry Point, Controllers, and Middleware
|   +-- FOMS.Application/       Business Logic, DTOs, and Service Interfaces
|   +-- FOMS.Domain/            Domain Entities, Value Objects, and Enums
|   +-- FOMS.Infrastructure/    EF Core DbContexts, MSSQL Repositories, and External Clients
+-- speedpay-portal/            Client Self-Service Payment Portal (React, TypeScript, Vite)
+-- ai-service/                 AI Intelligence Engine & Document Processing (Python FastAPI, Gemini)
+-- ai-gateway/                 Integration Gateway (.NET 10 Web API)
+-- scripts/                    Database Seeding and Diagnostic Utilities
+-- docker-compose.yml          Container orchestration for PostgreSQL, MongoDB, and pgAdmin
+-- .env.example                Environment configuration template
+-- .env                        Active local environment configuration
+-- README.md                   System documentation and run guides
```

---

## Service Endpoints and Port Allocation

| Component | Layer / Framework | Host / Port | Default URL | Description |
|---|---|---|---|---|
| **FOMS Staff Portal** | Frontend (Vite, React) | `localhost:5173` | http://localhost:5173 | Financial operations, invoice management, AI dashboard |
| **SpeedPay Client Portal** | Frontend (Vite, React) | `localhost:5174` | http://localhost:5174 | Client self-service invoice settlement via PayMongo |
| **FOMS Core Backend API** | Backend (.NET 10 Web API) | `localhost:5007` | http://localhost:5007/api | Primary transactional REST API connected to MSSQL |
| **AI Integration Gateway** | Gateway API (.NET 10) | `localhost:5000` | http://localhost:5000 | Reverse proxy & RBAC mediator between frontends & AI |
| **AI Microservice Engine** | Backend (Python FastAPI) | `localhost:8000` | http://localhost:8000 | OCR, duplicate detection, risk scoring with Gemini |
| **Swagger API Documentation** | Interactive Documentation | `localhost:8000` | http://localhost:8000/docs | FastAPI interactive API documentation |
| **pgAdmin 4 Administration** | Database Console (Docker) | `localhost:5050` | http://localhost:5050 | PostgreSQL visual management dashboard |

---

## Database Architecture (Polyglot Persistence)

The architecture implements a polyglot persistence strategy designed for operational compliance, auditability, and separation of concerns:

| Database Engine | Deployment Mode | Database Name | Responsibility | Connection String |
|---|---|---|---|---|
| **Microsoft SQL Server** | Local Windows Service (`localhost\SQLEXPRESS`) | `FOMS_DB` | **Official Source of Truth** for all financial records, roles, users, clients, rate cards, invoices, accounts receivable, payments, payment history, notifications, and tamper-evident audit logs. | `Server=localhost\SQLEXPRESS;Database=FOMS_DB;Trusted_Connection=True;TrustServerCertificate=True;` |
| **PostgreSQL 15** | Docker Container | `foms_ai_results` | Analytical datastore for AI processing outputs, OCR extractions, duplicate payment hashes, and credit scoring records. | `postgresql://postgres:postgres@localhost:5432/foms_ai_results` |
| **MongoDB 6.0** | Docker Container | `foms_trends_db` | High-throughput telemetry, historical activity metrics, and time-series audit event trails. | `mongodb://root:mongo_password_2026@localhost:27017/foms_trends_db?authSource=admin` |

> [!IMPORTANT]
> **Transactional Integrity**: Official FOMS records (invoices, payments, clients, audit logs) are strictly persisted to Microsoft SQL Server (`FOMS_DB`). PostgreSQL and MongoDB serve exclusively as AI decision-support and telemetry databases.

---

## Microsoft SQL Server Schema (`FOMS_DB`)

The primary database `FOMS_DB` contains the following core tables:
- `dbo.Roles` - System roles and access tiers (Financial Manager, Head Accountant, Accountant, Coordinator, Staff).
- `dbo.Users` - System credentials, employee numbers, and active account flags.
- `dbo.Clients` - Client profiles, DMS sync status, and contact records.
- `dbo.ClientFinanceSettings` - Billing terms, payment credit days, VAT/tax types, and ODA rates.
- `dbo.ClientRates` - Service types, delivery areas, minimum weights, and rate matrices.
- `dbo.Invoices` - Invoicing records, VAT computation, subtotal, total amounts, and statuses.
- `dbo.AccountsReceivable` - Outstanding balances, aging buckets, and collection tracking.
- `dbo.Payments` - Payment records, PayMongo reference IDs, payment methods, and validation states.
- `dbo.PaymentHistory` - Immutable chronological ledger of payment status transitions.
- `dbo.Notifications` - Role-targeted system notifications and alerts.
- `dbo.AuditLogs` - Audit ledger (`audit_id`, `user_id`, `role`, `action`, `module`, `remarks`, `created_at`).

---

## Database Health & Verification Endpoints

The core backend exposes dedicated endpoints to verify Microsoft SQL Server connectivity and transactional read/write operations:

### 1. Database Health Check
- **Endpoint:** `GET /api/health/database`
- **URL:** `http://localhost:5007/api/health/database`
- **Success Response:**
  ```json
  {
    "success": true,
    "database": "FOMS_DB",
    "provider": "Microsoft SQL Server",
    "server": "localhost\\SQLEXPRESS",
    "status": "Connected"
  }
  ```

### 2. Read Audit Logs (MSSQL Query)
- **Endpoint:** `GET /api/test/audit-logs`
- **URL:** `http://localhost:5007/api/test/audit-logs`
- **Success Response:**
  ```json
  {
    "success": true,
    "source": "Microsoft SQL Server",
    "database": "FOMS_DB",
    "table": "AuditLogs",
    "count": 2,
    "data": [
      {
        "audit_id": 1,
        "role": "System Admin",
        "action": "DATABASE_CREATED",
        "module": "MSSQL Setup",
        "remarks": "FOMS_DB local database created successfully."
      }
    ]
  }
  ```

### 3. Insert Audit Log (MSSQL Transaction)
- **Endpoint:** `POST /api/test/audit-logs`
- **URL:** `http://localhost:5007/api/test/audit-logs`
- **Payload:**
  ```json
  {
    "role": "Backend Test",
    "action": "BACKEND_CONNECTED",
    "module": "MSSQL Connection",
    "remarks": "Backend successfully connected to local FOMS_DB."
  }
  ```
- **Success Response:**
  ```json
  {
    "success": true,
    "message": "Audit log inserted successfully.",
    "data": {
      "role": "Backend Test",
      "action": "BACKEND_CONNECTED",
      "module": "MSSQL Connection",
      "remarks": "Backend successfully connected to local FOMS_DB."
    }
  }
  ```

### 4. Verification in SQL Server Management Studio (SSMS)
Verify data directly in SSMS by executing:
```sql
USE FOMS_DB;
GO

SELECT audit_id, role, action, module, remarks, created_at
FROM dbo.AuditLogs;
GO
```

---

## Local Development Setup

### 1. Environment Configuration
Copy the template configuration file to `.env`:

```bash
cp .env.example .env
```

Key environment configuration variables in `.env`:
```ini
# Microsoft SQL Server
MSSQL_SERVER=localhost\SQLEXPRESS
MSSQL_DB=FOMS_DB
MSSQL_CONNECTION_STRING=Server=localhost\SQLEXPRESS;Database=FOMS_DB;Trusted_Connection=True;TrustServerCertificate=True;

# Supporting Databases (Docker)
POSTGRES_CONNECTION_STRING=postgresql://postgres:postgres@localhost:5432/foms_ai_results
MONGODB_URI=mongodb://root:mongo_password_2026@localhost:27017/foms_trends_db?authSource=admin

# Core Backend & AI Service
FOMS_READ_API_URL=http://localhost:5007
AI_SERVICE_URL=http://localhost:8000
AI_SERVICE_API_KEY=foms-secret-key-2026
GEMINI_API_KEY=your-gemini-api-key-here
GEMINI_MODEL=gemini-2.0-flash

# PayMongo / SpeedPay
PAYMONGO_SECRET_KEY=sk_test_fyNzfY2nbwdhfgUcoMmWoZJq
VITE_PAYMONGO_SECRET_KEY=sk_test_fyNzfY2nbwdhfgUcoMmWoZJq
```

---

### 2. Infrastructure Services (Docker)
Start PostgreSQL 15, MongoDB 6.0, and pgAdmin 4:

```bash
docker-compose up -d
```

Verify containers are running:
```bash
docker-compose ps
```

---

### 3. Backend Services

Run each backend service in its own terminal:

#### A. Core FOMS Web API (.NET 10)
```bash
cd foms-backend/FOMS.Api
dotnet run
```
- Listens on: `http://localhost:5007`
- Verifies connection to `localhost\SQLEXPRESS` and `FOMS_DB`.

#### B. AI Integration Gateway (.NET 10)
```bash
cd ai-gateway
dotnet run
```
- Listens on: `http://localhost:5000`
- Relays authenticated requests to the Python AI service.

#### C. AI Microservice Engine (Python FastAPI)
```bash
cd ai-service
py -m uvicorn app.main:app --reload
```
- Listens on: `http://localhost:8000`
- API documentation: `http://localhost:8000/docs`

---

### 4. Frontend Applications

Run each frontend application in its own terminal:

#### A. FOMS Staff Portal (with AI Layer)
```bash
cd foms-frontend
npm install
npm run dev
```
- Accessible at: `http://localhost:5173`
- Configured via `foms-frontend/.env` to point to `http://localhost:5007`.

#### B. SpeedPay Client Portal
```bash
cd speedpay-portal
npm install
npm run dev
```
- Accessible at: `http://localhost:5174`
- Integrated with PayMongo sandbox checkout for digital payments.

---

## Role-Based Access Control (RBAC)

| Role | Core Operations Permissions | AI Intelligence Permissions |
|---|---|---|
| **Financial Manager** | Full access to invoices, client rates, approvals, adjustments, and settings | Full AI access: dashboard, collection notices, risk reviews, audit logs, configuration |
| **Head Accountant** | Invoice validation, accounts receivable, reconciliations, payment approvals | AI dashboard, risk score review, duplicate detection review, limited audit |
| **Accountant** | Invoice creation, payment verification, delivery document matching | AI dashboard, duplicate detection view, collection notice generation |
| **Coordinator** | Waybill tracking, POD uploads, client information view | Read-only AI recommendations related to delivery document validation |
| **Staff** | Basic view permissions according to designated functional workflows | No direct AI operational permissions |

---

## Troubleshooting & FAQ

### SQL Server Connection Issues
- **Error:** `Cannot connect to localhost\SQLEXPRESS`
  - Ensure the **SQL Server (SQLEXPRESS)** service is running in Windows Services (`services.msc`).
  - Verify your Windows user has `sysadmin` or `db_owner` permissions on `FOMS_DB`.
- **Error:** `The certificate chain was issued by an authority that is not trusted`
  - Ensure `TrustServerCertificate=True;` is included in the connection string.
- **Error:** `Invalid object name 'AuditLogs'`
  - Ensure the active database context is `FOMS_DB` and the table schema `dbo.AuditLogs` is created.

## Backend Implementation Plan

The full backend and database implementation plan is documented in **backend_implementation_plan.md** in this repository.

---
