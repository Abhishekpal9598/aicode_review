# Application Flow Document (APP_FLOW.md)

## Project Name: AI Code Review
**Project Title**: Intelligent AI-Powered Code Analysis & Review Platform  
**Document Version**: 1.0.0  
**Status**: Architecture Approved  

---

## 1. Global User Journey & System Map

The following state diagram outlines the top-level user lifecycle, from initial landing to workspace code review, report generation, and historical audits.

```mermaid
stateDiagram-v2
    [*] --> LandingPage: Public Visit
    LandingPage --> LoginPage: Click Login
    LandingPage --> RegisterPage: Click Get Started
    
    RegisterPage --> LoginPage: Account Created
    LoginPage --> Dashboard: Authenticated (JWT HttpOnly Cookie Set)
    
    Dashboard --> Workspace: "Start New Review"
    Dashboard --> History: "View All History"
    Dashboard --> Settings: "Account Settings"
    
    Workspace --> Analyzing: Submit Code / Upload File
    Analyzing --> ReviewDetail: Analysis Complete (Success)
    Analyzing --> Workspace: Analysis Failed (Show Toast & Diagnostics)
    
    ReviewDetail --> DiffComparison: "Inspect Side-by-Side Diff"
    ReviewDetail --> ReportExport: "Export PDF / Markdown / JSON"
    ReviewDetail --> History: "Return to All Reviews"
    
    History --> ReviewDetail: "Select Past Review"
    History --> Dashboard: Back to Dashboard
    
    Dashboard --> [*]: Logout (Invalidate Cookie)
```

---

## 2. Authentication Flow

### 2.1 User Registration & Login Sequence
Authentication relies on salted `bcrypt` password hashing, short-lived JWT access tokens, and persistent `HttpOnly` refresh cookies.

```mermaid
sequenceDiagram
    autonumber
    actor Dev as Developer (Browser)
    participant Client as React SPA (Vite)
    participant Server as Express Server
    participant DB as MongoDB Atlas

    Dev->>Client: Enters Email, Password, Name
    Client->>Server: POST /api/v1/auth/register
    Server->>DB: Check if email already exists
    alt Email exists
        Server-->>Client: 409 Conflict ("Email already in use")
        Client-->>Dev: Shows validation error
    else New User
        Server->>Server: Hash password with bcrypt (salt 12)
        Server->>DB: Insert User record
        Server-->>Client: 201 Created ("Registration successful")
        Client->>Client: Redirect to Login modal/page
    end

    Dev->>Client: Submits Login credentials
    Client->>Server: POST /api/v1/auth/login
    Server->>DB: Fetch user by email (+passwordHash)
    Server->>Server: Verify bcrypt compare
    alt Invalid Credentials
        Server-->>Client: 401 Unauthorized ("Invalid email or password")
        Client-->>Dev: Display error banner
    else Valid Credentials
        Server->>Server: Generate Access Token (15m) & Refresh Token (7d)
        Server-->>Client: Set HttpOnly Cookie (token), 200 OK { user profile }
        Client->>Client: Set AuthContext user state
        Client-->>Dev: Redirect to /dashboard
    end
```

---

## 3. Dashboard Navigation & Analytics Flow

The Dashboard provides immediate visibility into code quality telemetry, review volume, and defect distributions.

```mermaid
flowchart TD
    A[User lands on /dashboard] --> B{Authenticated?}
    B -- No --> C[Redirect to /login]
    B -- Yes --> D[Fetch Dashboard Stats: GET /api/v1/users/stats]
    
    D --> E[Render KPI Cards]
    E --> E1[Total Reviews Count]
    E --> E2[Average Quality Score 0-100]
    E --> E3[Total Security Vulnerabilities]
    E --> E4[Total Performance Bottlenecks]
    
    D --> F[Render Recharts Visualizations]
    F --> F1[Historical Score Progression Area Chart]
    F --> F2[Defect Category Radar Chart]
    F --> F3[Language Breakdown Bar Chart]
    
    D --> G[Render Recent Reviews Table]
    G --> H{User Action}
    H -->|Click 'New Review'| I[Navigate to /workspace]
    H -->|Click 'View Review'| J[Navigate to /reviews/:id]
    H -->|Click 'Full History'| K[Navigate to /history]
```

---

## 4. Code Review Workspace Flow (Editor & Ingestion)

The workspace supports both direct typing in the **Monaco Code Editor** and single-file drag-and-drop / file browser uploads.

```mermaid
flowchart TD
    Start[User opens /workspace] --> LoadEditor[Mount Monaco Editor with default template]
    LoadEditor --> Choice{Input Method}
    
    Choice -->|Type or Paste| PasteAction[Developer pastes or types code]
    Choice -->|File Upload| UploadAction[Click Upload / Drag File into Dropzone]
    
    UploadAction --> ValidateClient[Client File Check]
    ValidateClient -->|Size > 1MB| ErrSize[Show Error: File exceeds 1MB limit]
    ValidateClient -->|Invalid Extension| ErrExt[Show Error: Unsupported extension]
    ValidateClient -->|Valid .c, .cpp, .java, .py, .js, .ts| ReadFile[FileReader extracts UTF-8 string]
    
    ReadFile --> SetEditor[Populate Monaco Editor buffer]
    ReadFile --> AutoDetectLang[Auto-select language dropdown]
    
    PasteAction --> CheckLang[Select Language from Dropdown]
    SetEditor --> CheckLang
    
    CheckLang --> LiveStats[Update Realtime Stats: LOC, Char Count, Language Syntax]
    LiveStats --> Ready[Click 'Analyze Code' CTA button]
```

---

## 5. Dual-Layer AI Code Analysis Pipeline Flow

When the user clicks **"Analyze Code"**, the backend executes deterministic static checks before delegating deeper reasoning to Google Gemini.

```mermaid
sequenceDiagram
    autonumber
    actor Dev as Developer
    participant UI as Workspace UI (React)
    participant API as Review Controller (Express)
    participant Static as Static Heuristic Engine
    participant Gemini as Google Gemini 1.5 Pro
    participant DB as MongoDB Atlas

    Dev->>UI: Clicks "Analyze Code"
    UI->>UI: Set loading state: Animated pulse, spinner, progress stage
    UI->>API: POST /api/v1/reviews (payload: { code, language, title })
    
    Note over API: Step 1: Input Validation (Zod)
    alt Invalid Payload (LOC > 2500 or Empty)
        API-->>UI: 400 Bad Request ({ error: "Code length exceeds boundary" })
        UI-->>Dev: Display validation toast
    end

    API->>Static: Step 2: Run Regex & Lexical AST Scanners
    Static-->>API: Return Hardcoded secrets & unsafe memory calls

    API->>Gemini: Step 3: Invoke Gemini API with Structured Schema & Line References
    Note over Gemini: Analyzes Bugs, Security, Performance, Architectural Best Practices, Generates Refactored Code
    Gemini-->>API: Structured JSON Output (Bugs, Security, Performance, Refactored Code)

    Note over API: Step 4: Validate Gemini Output with Zod
    alt Schema Validation Fails
        API->>API: Apply normalizer fallback / retry
    end

    API->>API: Step 5: Merge Static + AI Findings & Deduplicate Overlaps
    API->>API: Step 6: Compute Mathematical Score (0-100) & Grade (A-F)
    
    API->>DB: Step 7: Persist CodeReview, AnalysisResult, and ReviewIssues
    DB-->>API: Saved successfully with _id

    API-->>UI: 201 Created ({ reviewId, score, issues, suggestedCode })
    UI->>UI: Redirect to /reviews/:id
    UI-->>Dev: Display complete interactive audit breakdown
```

---

## 6. Review Results & Side-by-Side Code Comparison Flow

The Review Results interface gives developers granular insight into every detected flaw and provides a side-by-side diff comparison for instant remediation.

```mermaid
flowchart TD
    Enter[User reaches /reviews/:id] --> Load[Load Analysis Summary]
    
    Load --> TopBanner[Display Score Badge: e.g., 88/100 Grade B]
    TopBanner --> MetricsBar[Issue Counters: Critical, High, Medium, Low]
    
    MetricsBar --> MainGrid[Interactive Workspace Layout]
    
    subgraph LeftPanel[Source Code Inspection]
        Editor[Monaco Editor with Line Gutter Markers]
    end
    
    subgraph RightPanel[Categorized Findings Tabs]
        Tabs[Tabs: All Issues | Bugs | Security | Performance | Best Practices]
        Tabs --> IssueList[Filterable Cards List]
        IssueList --> Card[Issue Card: Severity Badge, Title, Line Reference]
    end
    
    Card -->|Click 'Locate in Code'| ScrollLine[Monaco Editor jumps & highlights affected line]
    Card -->|Click 'View Solution'| ExpandSol[Displays rationale, impact, and patch snippet]
    
    MainGrid --> DiffCTA[Click 'Inspect Side-by-Side Diff' Button]
    DiffCTA --> ModalDiff[Open Monaco Diff Viewer Modal]
    
    ModalDiff --> DiffView[Original Code (Left) vs Improved Suggested Code (Right)]
    DiffView --> CopyBtn[Click 'Copy Refactored Code' button]
    CopyBtn --> Clipboard[Copied to Clipboard toast notification]
```

---

## 7. Review History & Archive Management Flow

Developers can revisit, search, filter, and purge historical code reviews.

```mermaid
flowchart TD
    Open[User navigates to /history] --> Fetch[GET /api/v1/reviews?page=1&limit=10]
    Fetch --> Render[Display Table with Search & Filter Bar]
    
    Render --> FilterActions{User Interaction}
    
    FilterActions -->|Search Bar| Query[Filter by filename or keyword]
    FilterActions -->|Language Dropdown| LangFilter[Filter by C, C++, Java, Python, JS, TS]
    FilterActions -->|Score Threshold| ScoreFilter[Filter by Grade: A, B, C, D, F]
    
    Query --> UpdateTable[Trigger debounced query fetch]
    LangFilter --> UpdateTable
    ScoreFilter --> UpdateTable
    
    UpdateTable --> Render
    
    Render --> RowAction{Row Actions}
    RowAction -->|Click Row / 'View'| ViewItem[Navigate to /reviews/:id]
    RowAction -->|Click 'Delete'| ConfirmModal[Show Delete Confirmation Modal]
    
    ConfirmModal -->|Confirm| SendDelete[DELETE /api/v1/reviews/:id]
    SendDelete --> RefreshTable[Optimistically remove row & refresh stats]
    ConfirmModal -->|Cancel| Dismiss[Close modal]
```

---

## 8. Reports & Export Workflow

Developers can generate and download audit documentation for homework submission, compliance records, or peer discussion.

```mermaid
flowchart TD
    Init[User clicks 'Export Report' on /reviews/:id] --> Options{Choose Format}
    
    Options -->|Markdown (.md)| GenMD[Generate structured Markdown with headings & code blocks]
    GenMD --> DownloadMD[Trigger client-side browser file download: review-audit.md]
    
    Options -->|JSON (.json)| GenJSON[Compile raw API schema & issues array]
    GenJSON --> DownloadJSON[Trigger browser download: review-data.json]
    
    Options -->|Print / PDF| GenPrint[Apply @media print styling: Clean white background, no sidebars]
    GenPrint --> BrowserPrint[Trigger window.print() system print / Save as PDF dialog]
```

---

## 9. Error Handling & Loading States

Every critical path handles transient failures, upstream timeouts, and invalid inputs gracefully.

```mermaid
stateDiagram-v2
    [*] --> IdleState: Workspace Ready
    IdleState --> Uploading: File Upload Dropped
    
    Uploading --> IdleState: File Validated
    Uploading --> ErrorBanner: File > 1MB or Unsupported Ext
    
    IdleState --> Submitting: User clicks 'Analyze Code'
    Submitting --> LoadingSkeleton: Display Pulse Skeletons & Stage Indicators
    
    LoadingSkeleton --> SuccessState: HTTP 201 Response
    LoadingSkeleton --> TimeoutError: Network or Gemini Timeout (> 25s)
    LoadingSkeleton --> RateLimitError: HTTP 429 (Max Reviews Reached)
    LoadingSkeleton --> ServerError: HTTP 500 / 503 Internal Error
    
    TimeoutError --> ErrorModal: "AI analysis timed out. Would you like to retry?"
    RateLimitError --> ToastNotice: "Review rate limit exceeded. Please wait 1 minute."
    ServerError --> ErrorModal: "Service error. Please verify input and try again."
    
    ErrorModal --> IdleState: Retry Action / Dismiss
    ToastNotice --> IdleState: Dismiss
    SuccessState --> [*]
```
