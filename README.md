# Integrated System: FOMS & AI-Powered Financial Intelligence Layer

This repository contains the integrated codebase for the **Finance Operations Management System (FOMS)** and the **AI-Powered Financial Intelligence Layer**.

---

## 📂 Repository Structure

```text
FOMS-System-Repository/
│
├── foms-frontend/              ← React + TypeScript Staff Portal (Port 5173)
├── foms-backend/               ← C# .NET 10 Web API, EF Core & Local MSSQL (Port 5007)
│   └── FOMS.Api/               ← Primary API entry point & Controllers
├── speedpay-portal/            ← React + TypeScript SpeedPay Client Portal (Port 5174)
├── ai-frontend/                ← React AI Decision Support Dashboard (Port 5175)
├── ai-service/                 ← Python FastAPI AI Intelligence Engine & Gemini OCR (Port 8000)
├── ai-gateway/                 ← ASP.NET Core 10 Integration Gateway (Port 5000)
├── scripts/                    ← Utility & data seed scripts
├── docker-compose.yml          ← Orchestrates PostgreSQL, MongoDB, and pgAdmin
├── .env.example                ← Environment template
├── .env                        ← Local secrets and credentials (gitignored)
└── README.md
```

> **Architecture Note:** All sub-projects operate as independent, decoupled services inside a monorepo structure.

---

## 📌 Quick Access URLs & Ports

| Service / Component | Layer / Framework | Local URL / Endpoint |
|---|---|---|
| 🖥️ **FOMS Staff Web Application** | Frontend (Vite + React) | [http://localhost:5173](http://localhost:5173) |
| 💳 **SpeedPay Client Portal** | Frontend (Vite + React) | [http://localhost:5174](http://localhost:5174) |
| 📊 **AI Intelligence Dashboard** | Frontend (Vite + React) | [http://localhost:5175](http://localhost:5175) |
| ⚡ **FOMS Core .NET 10 Web API** | Backend API (.NET 10) | [http://localhost:5007/api](http://localhost:5007/api) |
| 🛡️ **AI Integration Gateway** | Gateway API (.NET 10) | [http://localhost:5000](http://localhost:5000) |
| 🤖 **FastAPI AI Intelligence Engine** | AI Microservice (Python) | [http://localhost:8000](http://localhost:8000) |
| 📘 **FastAPI Swagger API Docs** | Interactive API Docs | [http://localhost:8000/docs](http://localhost:8000/docs) |
| 🐘 **pgAdmin 4 Web Console** | Database GUI (Docker) | [http://localhost:5050](http://localhost:5050) |

---

## 💾 Database Architecture

| Database Engine | Hosting | Purpose & Database Name |
|---|---|---|
| **Microsoft SQL Server** | Local Service (`localhost\SQLEXPRESS`) | **FOMS_DB** — Official source of truth (Users, Invoices, Payments, Audit Logs) |
| **PostgreSQL 15** | Docker (`localhost:5432`) | **foms_ai_results** — AI duplicate alerts, OCR extracts, risk classifications |
| **MongoDB 6.0** | Docker (`localhost:27017`) | **foms_trends_db** — Time-series activity logs, historical trends, recommendations |

---

## 🌟 Main Features & Modules

### 1. Finance Operations Management System (FOMS)
* **Accounts Receivable & Invoicing**: Automated billing computation, client rate cards, VAT calculations, and aging buckets.
* **Waybill & Proof of Delivery (POD)**: Waybill verification, CTC tracking, and document lifecycle control.
* **Digital Payments & SpeedPay**: Integrated PayMongo checkout (GCash, Maya, Cards) and payment proof validation.
* **Official Receipts & Settlement**: Formal OR generation upon payment approval and settlement reconciliation.
* **Audit Trail & RBAC**: Strict role-based access control with comprehensive audit logging for compliance.

### 2. AI-Powered Financial Intelligence Layer
* **Document OCR & Strict Classifier**: Multi-modal Gemini API integration for financial document recognition (Official Receipts, Invoices, Bank Slips) with heuristic fallback.
* **Duplicate Detection Engine**: Fuzzy matching and text comparison preventing double payments and fraudulent receipts.
* **Delinquency Risk Scoring**: Predictive risk modeling assessing client payment behaviors and cash flow forecasts.
* **No-Touch Recommendation Policy**: AI proposes collection priority actions without altering source-of-truth records.

---

## 🛠️ Technology Stack

| Domain | Technologies |
|---|---|
| **FOMS Backend** | C# .NET 10, Entity Framework Core, SQL Server Express |
| **FOMS Frontend** | React, TypeScript, Vite, Vanilla CSS |
| **SpeedPay Portal** | React, TypeScript, Vite, PayMongo Gateway API |
| **AI Microservice** | Python 3.12+, FastAPI, Google Gemini API, Pandas, RapidFuzz |
| **AI Gateway** | ASP.NET Core 10, HttpClientFactory |
| **AI Frontend** | React 19, TypeScript, Vite |
| **Databases** | Microsoft SQL Server, PostgreSQL 15, MongoDB 6.0 |
| **Containerization** | Docker Compose |

---

## 🌿 Branching Strategy (Git Flow)

```text
feature/foms-backend ──────┐
feature/foms-frontend ─────┤
feature/speedpay ──────────┤
feature/ai-service ────────┼──→ develop ──→ integration testing ──→ main
feature/ai-gateway ────────┤
feature/ai-frontend ───────┤
feature/docker-integration─┘
```

### Branches & Purpose

| Branch | Purpose |
|---|---|
| `main` | Production-ready stable release |
| `develop` | Integrated working branch for all services |
| `feature/foms-frontend` | FOMS staff frontend development |
| `feature/foms-backend` | FOMS .NET backend development |
| `feature/speedpay` | SpeedPay client portal development |
| `feature/ai-service` | Python FastAPI AI service |
| `feature/ai-gateway` | ASP.NET Core AI gateway |
| `feature/ai-frontend` | AI dashboard frontend |
| `feature/docker-integration` | Docker configuration and service management |

---

## 🚀 Getting Started & How to Run

### 1. Clone & Configure Environment
```bash
git clone https://github.com/crystalyjoyce/FOMS-System-Repository.git
cd FOMS-System-Repository
cp .env.example .env
```
*Ensure `.env` contains your local database settings and Gemini API key.*

### 2. Start Supporting Databases (Docker)
```bash
docker-compose up -d
```
*Starts PostgreSQL (`5432`), pgAdmin (`5050`), and MongoDB (`27017`). Microsoft SQL Server runs locally via `localhost\SQLEXPRESS`.*

### 3. Start Backend Services
Open separate terminals for each backend:

* **FOMS Backend API:**
  ```bash
  cd foms-backend/FOMS.Api
  dotnet run
  ```
  *(Runs on http://localhost:5007)*

* **AI Gateway:**
  ```bash
  cd ai-gateway
  dotnet run
  ```
  *(Runs on http://localhost:5000)*

* **AI Python Microservice:**
  ```bash
  cd ai-service
  py -m uvicorn app.main:app --reload
  ```
  *(Runs on http://localhost:8000)*

### 4. Start Frontend Applications
Open separate terminals for each frontend:

* **FOMS Staff Portal:**
  ```bash
  cd foms-frontend
  npm install
  npm run dev
  ```
  *(Runs on http://localhost:5173)*

* **SpeedPay Client Portal:**
  ```bash
  cd speedpay-portal
  npm install
  npm run dev
  ```
  *(Runs on http://localhost:5174)*

* **AI Intelligence Dashboard:**
  ```bash
  cd ai-frontend
  npm install
  npm run dev
  ```
  *(Runs on http://localhost:5175)*
