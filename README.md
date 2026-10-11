# Finance Operations Management System (FOMS) & Financial Intelligence Platform

An enterprise financial management platform that integrates the core Finance Operations Management System (FOMS) with an AI-driven Financial Intelligence Layer for automated billing, digital payment processing, delinquency risk assessment, and document validation.

---

## Repository Structure

```text
FOMS-System-Repository/
|
+-- foms-frontend/              Staff Operations Web Application (React, TypeScript)
+-- foms-backend/               Core Financial Web API (.NET 10, EF Core, SQL Server)
|   +-- FOMS.Api/               API Entry Point, Controllers, and Middleware
+-- speedpay-portal/            Client Self-Service Payment Portal (React, TypeScript)
+-- ai-frontend/                Financial Intelligence Dashboard (React, TypeScript)
+-- ai-service/                 AI Intelligence Engine & Document Processing (Python FastAPI)
+-- ai-gateway/                 Integration Gateway (.NET 10)
+-- scripts/                    Database Seeding and Diagnostic Utilities
+-- docker-compose.yml          Container orchestration for PostgreSQL, MongoDB, and pgAdmin
+-- .env.example                Environment configuration template
+-- .env                        Local configuration (gitignored)
+-- README.md                   System documentation
```

---

## Service Endpoints and Port Allocation

| Component | Layer / Framework | Host / Port | Default URL |
|---|---|---|---|
| FOMS Staff Portal | Frontend (Vite, React) | Localhost:5173 | http://localhost:5173 |
| SpeedPay Client Portal | Frontend (Vite, React) | Localhost:5174 | http://localhost:5174 |
| AI Intelligence Dashboard | Frontend (Vite, React) | Localhost:5175 | http://localhost:5175 |
| FOMS Core Backend API | Backend (.NET 10 Web API) | Localhost:5007 | http://localhost:5007/api |
| AI Integration Gateway | Gateway API (.NET 10) | Localhost:5000 | http://localhost:5000 |
| AI Microservice Engine | Backend (Python FastAPI) | Localhost:8000 | http://localhost:8000 |
| Swagger API Documentation | Interactive Documentation | Localhost:8000 | http://localhost:8000/docs |
| pgAdmin 4 Administration | Database Console (Docker) | Localhost:5050 | http://localhost:5050 |

---

## Database Architecture

The architecture implements a polyglot persistence strategy designed for separation of concerns and operational compliance:

| Database Engine | Deployment Mode | Database Name | Responsibility |
|---|---|---|---|
| Microsoft SQL Server | Local Service (`localhost\SQLEXPRESS`) | `FOMS_DB` | Primary source of truth for accounts, invoices, billing records, payments, and audit logs |
| PostgreSQL 15 | Docker Container (`localhost:5432`) | `foms_ai_results` | Storage for AI processing results, document OCR extractions, and duplicate detection records |
| MongoDB 6.0 | Docker Container (`localhost:27017`) | `foms_trends_db` | High-throughput time-series metrics, historical activity logs, and trend analytics |

---

## System Capabilities

### 1. Finance Operations Management System (FOMS)
* **Accounts Receivable and Invoicing**: Automated billing schedules, customizable client rate cards, VAT computation, and aging analysis.
* **Waybill and Delivery Verification**: Tracking and lifecycle management of Waybills and Proof of Delivery (POD) documentation.
* **Digital Payment Processing**: Integrated checkout gateway via PayMongo supporting card payments, e-wallets (GCash, Maya), and bank transfers.
* **Settlement and Receipt Issuance**: Generation of Official Receipts (OR) upon validated payment confirmation and reconciliation.
* **Compliance and Auditability**: Role-based access control (RBAC) and tamper-evident audit logging for financial governance.

### 2. Financial Intelligence Layer
* **Document Extraction and Classification**: Automated financial receipt and invoice OCR powered by Google Gemini API with fallback parsers.
* **Duplicate Detection**: Levenshtein distance and fuzzy matching algorithms to identify potential fraudulent or redundant payment submissions.
* **Credit Risk and Delinquency Analysis**: Algorithmic scoring that evaluates client settlement history and predicts payment defaults.
* **Advisory Recommendations**: Data-driven collection recommendations provided to staff without modifying transactional source-of-truth records.

---

## Technology Stack

| Domain | Technologies |
|---|---|
| Core Backend | C# .NET 10, ASP.NET Core Web API, Entity Framework Core 9 |
| AI Microservice | Python 3.12+, FastAPI, Google Gemini API, Pandas, RapidFuzz |
| Integration Gateway | ASP.NET Core 10, HttpClientFactory |
| Frontends | React 19, TypeScript, Vite, Vanilla CSS |
| Database Engines | Microsoft SQL Server Express, PostgreSQL 15, MongoDB 6.0 |
| Containerization | Docker, Docker Compose |

---

## Branching Strategy

The repository follows a Git Flow branching model:

```text
feature/foms-backend ------+
feature/foms-frontend -----+
feature/speedpay ----------+
feature/ai-service --------+---> develop ---> integration testing ---> main
feature/ai-gateway --------+
feature/ai-frontend -------+
feature/docker-integration-+
```

| Branch | Description |
|---|---|
| `main` | Production-ready, validated releases |
| `develop` | Primary integration branch for active development |
| `feature/foms-frontend` | Staff application frontend development |
| `feature/foms-backend` | Core .NET financial backend development |
| `feature/speedpay` | SpeedPay client payment interface |
| `feature/ai-service` | Python FastAPI intelligence service |
| `feature/ai-gateway` | .NET integration gateway |
| `feature/ai-frontend` | Intelligence dashboard frontend |
| `feature/docker-integration` | Infrastructure and containerization configurations |

---

## Local Development Setup

### 1. Environment Configuration
Clone the repository and copy the environment template:

```bash
git clone https://github.com/crystalyjoyce/FOMS-System-Repository.git
cd FOMS-System-Repository
cp .env.example .env
```

Ensure `.env` contains valid credentials for SQL Server, PostgreSQL, MongoDB, and the Gemini API key.

### 2. Infrastructure Services (Docker)
Start the supporting containerized databases:

```bash
docker-compose up -d
```

This initializes PostgreSQL (`5432`), MongoDB (`27017`), and pgAdmin (`5050`). Microsoft SQL Server is managed locally through your SQL Server Express instance (`localhost\SQLEXPRESS`).

### 3. Backend Services
Run each backend service in a dedicated terminal window:

* **FOMS Core Backend API:**
  ```bash
  cd foms-backend/FOMS.Api
  dotnet run
  ```
  Endpoint: `http://localhost:5007`

* **AI Integration Gateway:**
  ```bash
  cd ai-gateway
  dotnet run
  ```
  Endpoint: `http://localhost:5000`

* **AI Microservice:**
  ```bash
  cd ai-service
  py -m uvicorn app.main:app --reload
  ```
  Endpoint: `http://localhost:8000`

### 4. Frontend Applications
Run each frontend application in a dedicated terminal window:

* **FOMS Staff Portal:**
  ```bash
  cd foms-frontend
  npm install
  npm run dev
  ```
  Accessible at: `http://localhost:5173`

* **SpeedPay Client Portal:**
  ```bash
  cd speedpay-portal
  npm install
  npm run dev
  ```
  Accessible at: `http://localhost:5174`

* **AI Intelligence Dashboard:**
  ```bash
  cd ai-frontend
  npm install
  npm run dev
  ```
  Accessible at: `http://localhost:5175`
