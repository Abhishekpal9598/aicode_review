# PHASE 21: RENDER BACKEND PRODUCTION DEPLOYMENT REPORT

**Project**: AI Code Review — Intelligent AI-Powered Code Analysis & Review Platform  
**Target Directory**: `c:\Users\Abhishek Pal\OneDrive\Desktop\aiCode review`  
**Execution Phase**: Phase 21 — Render Backend Production Deployment  
**Repository**: `https://github.com/Abhishekpal9598/aicode_review.git` (`main` branch)  
**Date**: October 19, 2026  
**Status**: **PRE-DEPLOYMENT AUDIT COMPLETE — AWAITING LIVE RENDER SERVICE URL**  

---

## 1. Pre-Deployment Configuration Audit

An exhaustive source inspection of the backend service (`server/`) was conducted against the verified `main` branch:

| Component | Verified Setting | Source File | Status |
|---|---|---|---|
| **Repository Root** | `server` | `server/package.json` | **VERIFIED** |
| **Start Command** | `npm start` (`node src/server.js`) | `server/package.json:8` | **VERIFIED** |
| **Build Command** | `npm install` | `server/package.json` | **VERIFIED** |
| **Node Engine** | Node.js 20+ LTS | Runtime environment | **VERIFIED** |
| **Port Handling** | Binds to `env.PORT` (assigned by Render) | `server/src/server.js:6` | **VERIFIED** |
| **Reverse Proxy** | `trust proxy: 1` enabled | `server/src/app.js:15` | **VERIFIED** |
| **CORS Policy** | Origin restricted to `CLIENT_URL` with credentials | `server/src/app.js:23` | **VERIFIED** |
| **Health Check 1** | `GET /api/health` (rate-limited) | `server/src/app.js:55` | **VERIFIED** |
| **Health Check 2** | `GET /api/v1/health` (DB & AI telemetry, 2s cached) | `server/src/routes/health.routes.js:8` | **VERIFIED** |
| **MongoDB Atlas** | Exponential backoff reconnect, connection pooling | `server/src/config/db.js` | **VERIFIED** |
| **Gemini AI Engine** | `@google/genai` with automatic secret redaction | `server/src/services/gemini.service.js` | **VERIFIED** |

---

## 2. Render Web Service Configuration

To deploy the backend to Render, use the following verified specifications:

- **Service Type**: Web Service
- **Repository**: `https://github.com/Abhishekpal9598/aicode_review.git`
- **Branch**: `main`
- **Root Directory**: `server`
- **Runtime**: `Node`
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Auto-Deploy**: Yes (triggers on pushes to `main`)

---

## 3. Production Environment Variables

The table below documents every environment variable parsed by `server/src/config/env.js`.

> [!WARNING]
> **No Secret Exposure Rule**: Never print or commit actual credentials. Values must be entered directly into the **Environment** tab on the Render Dashboard.

| Variable Name | Required? | Source Code Validation / Constraints | Purpose & Format Example |
|---|---|---|---|
| `NODE_ENV` | **REQUIRED** | Must be strictly `'production'` | Enables production security mode and disables dev fallbacks |
| `PORT` | Auto | Parsed by Render automatically | Render dynamically assigns and binds to `$PORT` |
| `CLIENT_URL` | **REQUIRED** | Valid URL string (no trailing slash) | Frontend origin for CORS allowlist (e.g. `https://your-app.vercel.app` or temporary `http://localhost:5173` until Vercel is launched) |
| `MONGODB_URI` | **REQUIRED** | Must start with `mongodb://` or `mongodb+srv://` | MongoDB Atlas connection string (`mongodb+srv://<user>:<password>@cluster.mongodb.net/aicode_review?retryWrites=true&w=majority`) |
| `JWT_SECRET` | **REQUIRED** | $\ge 32$ chars, Shannon entropy $\ge 3.0$ bits/char, $\ge 10$ unique chars, no default/placeholder substrings | Cryptographically secure token signing key |
| `JWT_EXPIRES_IN` | Optional | Defaults to `'15m'` | Access token lifetime (e.g. `15m`) |
| `REFRESH_TOKEN_SECRET`| Optional | Min 32 characters | Optional refresh token signing key |
| `REFRESH_TOKEN_EXPIRES_IN`| Optional | Defaults to `'7d'` | Refresh token lifetime |
| `GEMINI_API_KEY` | **REQUIRED** | Min 1 character (Google AI Studio key) | Powers AI code analysis (e.g. `AIzaSy...`) |
| `GEMINI_MODEL` | Optional | Defaults to `'gemini-3.5-flash'` | Google Gemini model identifier |
| `GEMINI_TIMEOUT_MS` | Optional | Positive integer between 1 and 30000 (default: `30000`) | Network timeout threshold for AI calls |
| `TRUST_PROXY` | Optional | Defaults to `1` | Configures Express to trust single reverse proxy hop (Render) |
| `HEALTH_RATE_LIMIT_MAX`| Optional | Defaults to `60` | Max requests per minute per IP for public health endpoints |

### Secure `JWT_SECRET` Generation Command
Run this command locally in your terminal to generate a compliant production secret (never commit the output):
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 4. MongoDB Atlas Infrastructure Checklist

Before initiating the Render deployment, verify the MongoDB Atlas cluster configuration:

1. **Database Name**: Confirm target database name is `aicode_review`.
2. **Network Access Whitelist**:
   - In MongoDB Atlas Console $\rightarrow$ **Security** $\rightarrow$ **Network Access**.
   - Verify `0.0.0.0/0` (Allow Access from Anywhere) is present so dynamic Render IP addresses are not blocked.
3. **Database User & Permissions**:
   - In **Security** $\rightarrow$ **Database Access**.
   - Verify user has `readWriteAnyDatabase` or `readWrite` on `aicode_review`.
4. **Password Rotation**:
   - Verify the rotated password for `abhipal895_db_user` is correctly URL-encoded if it contains special characters, and placed into `MONGODB_URI` in the Render dashboard.

---

## 5. Step-by-Step Render Deployment Guide

1. Log in to [dashboard.render.com](https://dashboard.render.com/).
2. Click **New +** $\rightarrow$ **Web Service**.
3. Select **Build and deploy from a Git repository**.
4. Choose `Abhishekpal9598/aicode_review`.
5. Enter the service settings:
   - **Name**: `aicode-review-api`
   - **Region**: Choose closest to your database (e.g., Frankfurt or Oregon)
   - **Branch**: `main`
   - **Root Directory**: `server`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free or Starter
6. Navigate to **Environment Variables** and enter the variables listed in Section 3.
7. Click **Create Web Service**.
8. Wait for the build and deployment logs to display:
   ```
   ==> Starting service with 'npm start'
   AI Code Review API is running on port 10000
   Environment: production
   MongoDB connection established to Atlas
   ```

---

## 6. Post-Deployment Live Verification Protocol

Once Render assigns your live service URL (`https://<service-name>.onrender.com`), the following verification suite must be executed:

### Verification Commands

```bash
# 1. Root Metadata Endpoint
curl -s https://<service-name>.onrender.com/ | jq .

# 2. Phase 1 Health Endpoint
curl -s https://<service-name>.onrender.com/api/health | jq .

# 3. Phase 2 Health Endpoint (DB & Gemini Telemetry)
curl -s https://<service-name>.onrender.com/api/v1/health | jq .

# 4. CORS Verification
curl -i -X OPTIONS https://<service-name>.onrender.com/api/v1/health \
  -H "Origin: https://your-app.vercel.app" \
  -H "Access-Control-Request-Method: GET"

# 5. Security & Rate Limiting Verification
# Verify RateLimit headers are returned in responses
curl -i https://<service-name>.onrender.com/api/v1/health
```

### Expected Success Responses

1. **`GET /api/v1/health`**:
   ```json
   {
     "success": true,
     "message": "AI Code Review API is running",
     "status": "healthy",
     "database": {
       "connected": true
     },
     "ai": {
       "configured": true,
       "model": "gemini-3.5-flash"
     }
   }
   ```
2. **`GET /api/health`**:
   ```json
   {
     "success": true,
     "message": "AI Code Review API is running",
     "status": "healthy"
   }
   ```

---

## 7. Current Deployment Status & Next Action

- **Pre-Deployment Readiness**: **100% COMPLETE & VERIFIED**.
- **Source Code Status**: Fully committed and synchronized with GitHub `main` branch.
- **Next Action**: Create the Web Service in Render using the configuration above, input the environment variables, and provide the live Render service URL to complete Phase 21 live verification.
