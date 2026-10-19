# AI Code Review — Intelligent AI-Powered Code Analysis & Review Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-indigo.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-v20+-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-v19-blue.svg)](https://react.dev/)
[![MongoDB Atlas](https://img.shields.io/badge/Database-MongoDB%20Atlas-forestgreen.svg)](https://www.mongodb.com/atlas)
[![Google Gemini](https://img.shields.io/badge/AI-Google%20Gemini-orange.svg)](https://ai.google.dev/)

An enterprise-grade, developer-first code review workstation that combines deterministic static analysis with Google Gemini AI models. Analyze source code, identify bugs, detect security vulnerabilities, optimize algorithmic performance, and inspect side-by-side refactored code diffs in a professional dark-themed IDE workspace.

---

## Table of Contents
- [Project Overview](#project-overview)
- [Key Features](#key-features)
- [Supported Languages](#supported-languages)
- [Technology Stack](#technology-stack)
- [System Architecture](#system-architecture)
- [Project Folder Structure](#project-folder-structure)
- [Installation & Local Setup](#installation--local-setup)
- [Environment Variables](#environment-variables)
- [Development Commands](#development-commands)
- [Testing Strategy](#testing-strategy)
- [Deployment Guide](#deployment-guide)
- [Documentation Index](#documentation-index)

---

## Project Overview

Manual code reviews are frequently a bottleneck in modern software delivery. **AI Code Review** acts as a 24/7 senior pair programmer, providing instantaneous, objective, and deeply educational code audits. 

Unlike standard linters, the platform provides:
- **Dual-Layer Analysis**: Instant deterministic regex/AST static scans combined with Google Gemini semantic reasoning.
- **Developer-Native Workspace**: In-browser Monaco Code Editor (the engine powering VS Code) with syntax highlighting, minimaps, and drag-and-drop file ingestion.
- **Side-by-Side Diff Comparison**: Monaco Diff Editor comparing original code against production-ready refactored solutions.
- **Multi-Dimensional Metrics**: Algorithmic Big-O analysis, OWASP/CWE vulnerability mapping, and weighted mathematical quality scoring (0–100).
- **Zero Remote Code Execution (RCE)**: User code is treated strictly as untrusted input and analyzed analytically without compilation or execution.

---

## Key Features

- **Authentication & Security**: Secure user registration, login, logout, and JWT tokens managed via `HttpOnly`, `SameSite=Strict` cookies.
- **Developer Dashboard**: High-density analytics displaying total reviews, average quality score, security defect counts, and historical score trend charts (Recharts).
- **Code Review Workspace**: Monaco Editor supporting C, C++, Java, Python, JavaScript, and TypeScript with real-time character and line counters.
- **Smart Language Detection & Manual Selection**:
  - **Auto Detect by Default**: Evaluates syntax heuristics and file extensions in real-time without costly AI roundtrips.
  - **Manual Selection & Locking**: Developers can explicitly select and freeze any language without subsequent keystrokes overwriting their choice.
  - **Disambiguation Engine**: Resolves C vs C++ (`std::`, `<iostream>`, templates vs `stdio.h`) and JS vs TS (`interface`, `type`, `as const`, type annotations).
  - **Status Indicators**: Dynamic badges for `Auto Detected`, `Manually Selected`, and `Detection Uncertain`.
- **File Upload Ingestion**: Single-file upload (.c, .cpp, .java, .py, .js, .ts up to 1 MB) with client-side UTF-8 validation and automatic language assignment.
- **AI Bug Detection**: Unhandled null dereferences, infinite loops, boundary errors, and race conditions.
- **Security Vulnerability Scanner**: Hardcoded API keys/secrets detection, SQL/NoSQL injection vectors, and C/C++ memory safety hazards (buffer overflows, dangling pointers).
- **Performance Optimizer**: Big-O Time & Space complexity evaluation, memory leak warnings, and loop allocation optimizations.
- **Intelligent Refactoring**: Plain-English explanations of *why* an issue matters with copyable, production-ready code patches.
- **Review History & Search**: Full persistence of past submissions in MongoDB Atlas with language filters, score filters, and batch deletion.
- **Exportable Reports**: Generate and download audit summaries in Markdown, JSON, and print-optimized PDF formats.

---

## Supported Languages

Initial language support:
- **Python** (`.py`)
- **JavaScript** (`.js`, `.jsx`, `.mjs`)
- **TypeScript** (`.ts`, `.tsx`)
- **Java** (`.java`)
- **C** (`.c`)
- **C++** (`.cpp`, `.cc`, `.cxx`, `.h`, `.hpp`)

*Includes built-in auto-detection heuristics and manual override capabilities for all 6 languages.*

---

## Technology Stack

### Frontend
- **Framework**: React 19 + Vite
- **Styling**: Tailwind CSS (Cybernetic Charcoal & Slate developer theme)
- **UI Primitives**: shadcn/ui & Radix UI
- **Code Editor**: `@monaco-editor/react` (Monaco Code Editor & Diff Viewer)
- **Routing**: React Router v7
- **Charts**: Recharts (Score trends & defect radar charts)
- **Icons**: Lucide React
- **HTTP Client**: Axios with interceptors

### Backend
- **Runtime**: Node.js (LTS v20+)
- **Server Framework**: Express.js (ES Modules)
- **Database ODM**: Mongoose v8
- **AI Integration**: Google Gemini API (`@google/generative-ai`)
- **Schema Validation**: Zod v3
- **Security**: Helmet, CORS, Express-Rate-Limit, Cookie-Parser, Bcrypt.js, JsonWebToken
- **File Ingestion**: Multer (In-memory buffer parsing)

### Database & Cloud
- **Database**: MongoDB Atlas (Managed Cloud Cluster)
- **Frontend Hosting**: Vercel
- **Backend Hosting**: Render

### Testing
- Vitest, Supertest, Postman

---

## System Architecture

```
┌────────────────────────────────────────────────────────┐
│                   Frontend (Vercel)                    │
│   React 19 + Vite + Monaco Editor + Tailwind CSS       │
└───────────────────────────┬────────────────────────────┘
                            │ HTTPS (TLS 1.3)
                            │ HttpOnly Secure JWT Cookies
                            ▼
┌────────────────────────────────────────────────────────┐
│                   Backend (Render)                     │
│   Node.js + Express.js (ES Modules)                    │
│   • Security: Helmet, Rate Limiter, CORS               │
│   • Controllers & Auth Middleware                      │
│   • Dual-Layer Analysis Pipeline:                      │
│     1. Static Heuristic Engine (Secrets & Memory)      │
│     2. Google Gemini 1.5 Pro (Semantic Reasoning)      │
│   • Zod Schema Validation & Deduplication              │
│   • Weighted Scoring Engine (0 - 100)                  │
└─────────────┬────────────────────────────┬─────────────┘
              │                            │
              ▼                            ▼
┌───────────────────────────┐ ┌──────────────────────────┐
│   MongoDB Atlas Cluster   │ │    Google Gemini API     │
│   Users, CodeReviews,     │ │    Structured JSON Mode  │
│   AnalysisResults, Issues │ │    Temperature: 0.2      │
└───────────────────────────┘ └──────────────────────────┘
```

---

## Project Folder Structure

```
AI-Code-Review/
├── docs/
│   ├── PRD.md                     # Product Requirements Document
│   ├── TRD.md                     # Technical Requirements Document
│   ├── APP_FLOW.md                # Interactive User Flows & Mermaid Diagrams
│   ├── UI_UX.md                   # Complete Charcoal/Indigo Design System
│   ├── DATABASE_SCHEMA.md         # Mongoose Schemas, Indexes & JSON Examples
│   ├── SRS.md                     # IEEE 830 Software Requirements Specification
│   ├── API_DOCUMENTATION.md       # RESTful API Endpoints & Payloads
│   └── IMPLEMENTATION_ROADMAP.md  # 15-Phase Implementation Blueprint
├── client/                        # React 19 + Vite Frontend SPA
│   ├── src/
│   │   ├── components/            # UI, Editor, Dashboard & Review Components
│   │   ├── context/               # Auth & Theme Contexts
│   │   ├── pages/                 # Route Views (Workspace, Dashboard, History)
│   │   └── services/              # API Client Services
│   └── package.json
├── server/                        # Node.js + Express ES Modules Backend
│   ├── config/                    # Database & Environment Setup
│   ├── controllers/               # Auth, Review, History, Report Controllers
│   ├── middleware/                # JWT, Rate Limit, Error Handling
│   ├── models/                    # Mongoose Data Models (User, Review, Issue)
│   ├── services/                  # Gemini AI, Static Analyzer, Scoring
│   └── server.js
├── .gitignore                     # Git ignore rules
├── .env.example                   # Environment configuration template
└── README.md                      # Project master documentation
```

---

## Installation & Local Setup

### Prerequisites
- Node.js $\ge 20.x$
- npm $\ge 10.x$
- MongoDB Atlas cluster URI or local MongoDB instance
- Google Gemini API Key ([Get an API key](https://aistudio.google.com/))

### 1. Clone the Repository
```bash
git clone https://github.com/Abhishekpal9598/backend.git AI-Code-Review
cd AI-Code-Review
```

### 2. Configure Environment Variables
Copy the example environment file into both `server/` and `client/`:
```bash
cp .env.example server/.env
```

Populate the `server/.env` file with your credentials:
```ini
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
MONGO_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/aicode_review?retryWrites=true&w=majority
JWT_SECRET=replace_with_a_secure_random_string_min_32_chars
REFRESH_TOKEN_SECRET=replace_with_another_secure_random_string
GEMINI_API_KEY=AIzaSy...your_gemini_api_key
```

### 3. Install Dependencies
```bash
# Install backend dependencies
cd server
npm install

# Install frontend dependencies
cd ../client
npm install
```

---

## Development Commands

```bash
# Run Backend API (from server/ directory)
cd server
npm run dev

# Run Frontend Client (from client/ directory)
cd client
npm run dev
```

The frontend will be available at `http://localhost:5173` and the API server at `http://localhost:5000`.

---

## Testing Strategy

- **Unit & Integration Tests**: Run Vitest on the server and client:
  ```bash
  # Run backend test suite
  cd server && npm test

  # Run frontend component tests
  cd client && npm test
  ```
- **API Functional Tests**: Use Postman or Supertest to verify routes against `docs/API_DOCUMENTATION.md`.

---

## Deployment Guide

- **Frontend on Vercel**: Connect the repository, set the root directory to `client/`, and configure `VITE_API_BASE_URL` to point to the production backend.
- **Backend on Render**: Deploy `server/` as a Node.js Web Service, set `NODE_ENV=production`, and configure all environment variables from `server/.env`.
- **Database on MongoDB Atlas**: Ensure network access allows incoming connections from Render's IP addresses and TLS 1.3 is enforced.

---

## Documentation Index

For comprehensive technical specifications, refer to the documentation in `/docs`:
- [Product Requirements Document (PRD)](docs/PRD.md)
- [Technical Requirements Document (TRD)](docs/TRD.md)
- [Application Flow & Diagrams (APP_FLOW.md)](docs/APP_FLOW.md)
- [UI/UX Design System (UI_UX.md)](docs/UI_UX.md)
- [Database Schema & Models (DATABASE_SCHEMA.md)](docs/DATABASE_SCHEMA.md)
- [Software Requirements Specification (SRS)](docs/SRS.md)
- [REST API Documentation (API_DOCUMENTATION.md)](docs/API_DOCUMENTATION.md)
- [15-Phase Implementation Roadmap (IMPLEMENTATION_ROADMAP.md)](docs/IMPLEMENTATION_ROADMAP.md)
