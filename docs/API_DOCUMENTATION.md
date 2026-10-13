# API Documentation (API_DOCUMENTATION.md)

## Project Name: AI Code Review
**Project Title**: Intelligent AI-Powered Code Analysis & Review Platform  
**Document Version**: 1.0.0  
**Base URL**: `/api/v1`  
**Protocol**: HTTPS (TLS 1.3)  
**Content-Type**: `application/json` (or `multipart/form-data` for file uploads)  
**Status**: Specification Approved  

---

## 1. API Architecture & Conventions

### 1.1 Standard Response Envelopes
All REST endpoints return predictable, standardized JSON envelopes.

#### Success Response Envelope (HTTP 200, 201)
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2026-03-11T10:00:00.000Z",
    "page": 1,
    "limit": 10,
    "total": 42
  }
}
```

#### Error Response Envelope (HTTP 4xx, 5xx)
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Input code exceeds maximum allowed size of 1 MB.",
    "details": [
      {
        "field": "code",
        "issue": "String must contain at most 1000000 character(s)"
      }
    ]
  }
}
```

### 1.2 Authentication Mechanism
Authenticated routes require either:
1. An `access_token` JWT provided automatically via an `HttpOnly`, `SameSite=Strict` cookie.
2. An `Authorization: Bearer <jwt_token>` HTTP header (for programmatic / mobile clients).

---

## 2. Authentication Routes (`/api/v1/auth`)

### 2.1 User Registration
- **Endpoint**: `POST /api/v1/auth/register`
- **Access**: Public
- **Description**: Creates a new developer account.

#### Request Body
```json
{
  "name": "Alex Mercer",
  "email": "alex.mercer@codeforge.dev",
  "password": "SecurePassword123!"
}
```

#### Success Response (`201 Created`)
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "66f1b0a1e4b02a1122334455",
      "name": "Alex Mercer",
      "email": "alex.mercer@codeforge.dev",
      "role": "developer",
      "preferences": {
        "editorTheme": "charcoal-obsidian",
        "tabSize": 2,
        "defaultLanguage": "python"
      },
      "createdAt": "2026-03-11T10:00:00.000Z"
    }
  }
}
```

---

### 2.2 User Login
- **Endpoint**: `POST /api/v1/auth/login`
- **Access**: Public
- **Description**: Verifies credentials, sets `access_token` in `HttpOnly` cookie, and returns user profile.

#### Request Body
```json
{
  "email": "alex.mercer@codeforge.dev",
  "password": "SecurePassword123!"
}
```

#### Success Response (`200 OK`)
*(Sets Cookie: `access_token=eyJhbGci...; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=900`)*
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "66f1b0a1e4b02a1122334455",
      "name": "Alex Mercer",
      "email": "alex.mercer@codeforge.dev",
      "role": "developer"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

### 2.3 User Logout
- **Endpoint**: `POST /api/v1/auth/logout`
- **Access**: Authenticated
- **Description**: Clears authentication cookies and invalidates the active session.

#### Success Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "message": "Logged out successfully."
  }
}
```

---

### 2.4 Get Current User Profile (`Me`)
- **Endpoint**: `GET /api/v1/auth/me`
- **Access**: Authenticated
- **Description**: Validates session and returns the logged-in user profile.

#### Success Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "66f1b0a1e4b02a1122334455",
      "name": "Alex Mercer",
      "email": "alex.mercer@codeforge.dev",
      "role": "developer",
      "avatarUrl": null,
      "preferences": {
        "editorTheme": "charcoal-obsidian",
        "tabSize": 2,
        "defaultLanguage": "python"
      }
    }
  }
}
```

---

## 3. User & Analytics Routes (`/api/v1/users`)

### 3.1 Get Dashboard Statistics
- **Endpoint**: `GET /api/v1/users/stats`
- **Access**: Authenticated
- **Description**: Aggregates telemetry across all completed reviews for the user.

#### Success Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "overview": {
      "totalReviews": 28,
      "averageQualityScore": 84.5,
      "totalBugsDetected": 41,
      "criticalSecurityIssues": 6,
      "performanceBottlenecks": 19
    },
    "scoreHistory": [
      { "date": "2026-03-01", "averageScore": 76 },
      { "date": "2026-03-05", "averageScore": 81 },
      { "date": "2026-03-10", "averageScore": 88 }
    ],
    "languageDistribution": [
      { "language": "python", "count": 14 },
      { "language": "typescript", "count": 8 },
      { "language": "c", "count": 4 },
      { "language": "java", "count": 2 }
    ],
    "severityBreakdown": {
      "critical": 6,
      "high": 15,
      "medium": 24,
      "low": 32,
      "info": 18
    }
  }
}
```

---

## 4. Code Review Routes (`/api/v1/reviews`)

### 4.1 Create & Analyze Review (Direct Submission)
- **Endpoint**: `POST /api/v1/reviews`
- **Access**: Authenticated
- **Rate Limit**: 10 calls / min
- **Description**: Submits code string for hybrid static and Gemini AI analysis.

#### Request Body
```json
{
  "title": "quickSort.py",
  "language": "python",
  "code": "def quicksort(arr):\n    if len(arr) <= 1:\n        return arr\n    pivot = arr[len(arr) // 2]\n    left = [x for x in arr if x < pivot]\n    middle = [x for x in arr if x == pivot]\n    right = [x for x in arr if x > pivot]\n    return quicksort(left) + middle + quicksort(right)"
}
```

#### Success Response (`201 Created`)
```json
{
  "success": true,
  "data": {
    "reviewId": "66f1b1b2e4b02a1122334466",
    "title": "quickSort.py",
    "language": "python",
    "status": "completed",
    "overallScore": 82,
    "grade": "B",
    "summary": "Clean implementation of Quicksort, but exhibits unnecessary memory allocations due to 3 full list comprehensions per recursive call.",
    "timeComplexity": "O(N log N)",
    "spaceComplexity": "O(N)",
    "metrics": {
      "bugScore": 95,
      "securityScore": 100,
      "performanceScore": 70,
      "maintainabilityScore": 85,
      "issueCounts": {
        "critical": 0,
        "high": 0,
        "medium": 1,
        "low": 1,
        "info": 0
      }
    },
    "issues": [
      {
        "id": "66f1b1d4e4b02a1122334488",
        "category": "performance",
        "severity": "MEDIUM",
        "title": "Redundant Multiple List Iterations",
        "description": "The function performs three sequential passes over arr to partition into left, middle, and right arrays, tripling allocation overhead.",
        "lineStart": 5,
        "lineEnd": 7,
        "originalSnippet": "left = [x for x in arr if x < pivot]\nmiddle = [x for x in arr if x == pivot]\nright = [x for x in arr if x > pivot]",
        "suggestedSnippet": "left, middle, right = [], [], []\nfor x in arr:\n    if x < pivot: left.append(x)\n    elif x == pivot: middle.append(x)\n    else: right.append(x)",
        "explanation": "Combining the partition into a single iteration reduces array allocations and cuts loop iterations from 3N to N."
      }
    ],
    "suggestedCode": "def quicksort(arr):\n    if len(arr) <= 1:\n        return arr\n    pivot = arr[len(arr) // 2]\n    left, middle, right = [], [], []\n    for x in arr:\n        if x < pivot:\n            left.append(x)\n        elif x == pivot:\n            middle.append(x)\n        else:\n            right.append(x)\n    return quicksort(left) + middle + quicksort(right)",
    "refactoringRationale": "Consolidated 3 separate list comprehensions into a single loop pass to optimize cache locality and memory allocations."
  }
}
```

---

### 4.2 Upload Source File for Analysis
- **Endpoint**: `POST /api/v1/reviews/upload`
- **Access**: Authenticated
- **Content-Type**: `multipart/form-data`
- **Description**: Ingests `.c`, `.cpp`, `.java`, `.py`, `.js`, or `.ts` file ($\le 1\text{ MB}$) and triggers analysis.

#### Form Data Fields:
- `file`: `(binary UTF-8 source file)`
- `language`: `(optional, auto-detected from extension if omitted)`

---

### 4.3 Get Review By ID (Complete Deep Dive)
- **Endpoint**: `GET /api/v1/reviews/:id`
- **Access**: Authenticated (owner only)
- **Description**: Retrieves original code, complete analysis results, issues, and diff data.

#### Success Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "review": {
      "id": "66f1b1b2e4b02a1122334466",
      "title": "quickSort.py",
      "language": "python",
      "rawCode": "...",
      "lineCount": 8,
      "createdAt": "2026-03-11T10:15:00.000Z"
    },
    "analysis": {
      "overallScore": 82,
      "grade": "B",
      "summary": "...",
      "timeComplexity": "O(N log N)",
      "spaceComplexity": "O(N)",
      "suggestedCode": "..."
    },
    "issues": [ ... ]
  }
}
```

---

### 4.4 Delete Review
- **Endpoint**: `DELETE /api/v1/reviews/:id`
- **Access**: Authenticated (owner only)
- **Description**: Deletes a review and its child `AnalysisResult` and `ReviewIssue` records.

#### Success Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "message": "Review and associated analysis records deleted successfully."
  }
}
```

---

## 5. Security & Performance Specialized Routes

### 5.1 Get Isolated Security Vulnerabilities
- **Endpoint**: `GET /api/v1/reviews/:id/security`
- **Access**: Authenticated
- **Description**: Filters findings strictly to category `'security'` with CWE/OWASP mapping.

#### Success Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "reviewId": "66f1b1b2e4b02a1122334466",
    "securityScore": 30,
    "vulnerabilities": [
      {
        "id": "66f1b1d4e4b02a1122334488",
        "severity": "CRITICAL",
        "title": "Stack Buffer Overflow via Unbounded strcpy",
        "ruleId": "CWE-120",
        "lineStart": 6,
        "lineEnd": 6,
        "explanation": "strncpy restricts the copy to the allocated buffer capacity."
      }
    ]
  }
}
```

---

### 5.2 Get Isolated Performance Bottlenecks
- **Endpoint**: `GET /api/v1/reviews/:id/performance`
- **Access**: Authenticated
- **Description**: Filters findings strictly to category `'performance'` with Big-O estimates.

---

## 6. Review History & Archive Routes (`/api/v1/history`)

### 6.1 List & Search Review History
- **Endpoint**: `GET /api/v1/history`
- **Access**: Authenticated
- **Query Parameters**:
  - `page`: Integer (default: 1)
  - `limit`: Integer (default: 10, max: 50)
  - `search`: String (query over title / filename)
  - `language`: Enum (`c`, `cpp`, `java`, `python`, `javascript`, `typescript`)
  - `grade`: Enum (`A`, `B`, `C`, `D`, `F`)
  - `sortBy`: `createdAt` | `overallScore` (default: `createdAt`)
  - `order`: `asc` | `desc` (default: `desc`)

#### Success Response (`200 OK`)
```json
{
  "success": true,
  "data": [
    {
      "id": "66f1b1b2e4b02a1122334466",
      "title": "quickSort.py",
      "language": "python",
      "lineCount": 8,
      "overallScore": 82,
      "grade": "B",
      "criticalCount": 0,
      "totalIssues": 2,
      "createdAt": "2026-03-11T10:15:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1
  }
}
```

---

### 6.2 Batch Delete Reviews
- **Endpoint**: `DELETE /api/v1/history/batch`
- **Access**: Authenticated
- **Description**: Deletes multiple reviews simultaneously.

#### Request Body
```json
{
  "reviewIds": [
    "66f1b1b2e4b02a1122334466",
    "66f1b1b2e4b02a1122334477"
  ]
}
```

---

## 7. Report Generation & Export Routes (`/api/v1/reports`)

### 7.1 Export Formatted Report
- **Endpoint**: `GET /api/v1/reports/:reviewId/export`
- **Access**: Authenticated
- **Query Parameter**: `format=markdown` | `json`

#### Markdown Export Sample Output (`format=markdown`):
```markdown
# AI Code Review Report: quickSort.py
- **Language**: Python
- **Overall Score**: 82 / 100 (Grade B)
- **Date**: 2026-03-11

## Executive Summary
Clean implementation of Quicksort, but exhibits unnecessary memory allocations.

## Complexity
- **Time**: O(N log N)
- **Space**: O(N)

## Identified Issues
### [MEDIUM] Redundant Multiple List Iterations (Lines 5-7)
The function performs three sequential passes over arr...
```
