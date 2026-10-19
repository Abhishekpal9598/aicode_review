# UI/UX Design System & Specification Document (UI_UX.md)

## Project Name: AI Code Review
**Project Title**: Intelligent AI-Powered Code Analysis & Review Platform  
**Document Version**: 1.0.0  
**Design Theme**: Cybernetic Charcoal & Obsidian IDE (Developer-Centric Dark Theme)  
**Status**: Design System Approved  

---

## 1. Design Philosophy & Unique Developer Identity

The user interface of **AI Code Review** is crafted exclusively for software engineers, security researchers, and computer science students. It adopts a **high-density, low-glare, dark cybernetic developer aesthetic** inspired by modern code editors (VS Code, JetBrains Fleet, Linear, and GitHub’s code review workbench).

### Strict Differentiation from Resume/HR Analyzers
- **No pastel or generic enterprise SaaS cards**: We reject rounded corporate cards, bubbly gradients, and consumer-oriented illustrations.
- **IDE Density & Spatial Economy**: Layouts maximize horizontal and vertical screen real estate for code inspection, featuring fixed gutter margins, collapsible panels, split-pane viewports, and tabular data density.
- **Monospaced Utility**: Technical metadata (line numbers, hash IDs, complexity notations, memory footprints) uses crisp monospaced typography with syntax-highlighted accents.

---

## 2. Complete Design System & Design Tokens

### 2.1 Color Palette
The color system utilizes a **Deep Charcoal & Slate Foundation** paired with **Electric Indigo** primary accents and strict semantic telemetry hues.

| Token Name | Hex Code | Purpose & Application |
|---|---|---|
| `--bg-canvas` | `#0A0D12` | Deepest black-charcoal canvas background for entire app viewport |
| `--bg-surface-primary` | `#111620` | Primary content panels, editor surrounding frames, sidebar background |
| `--bg-surface-secondary` | `#18202F` | Elevated cards, modal dialogs, toolbar overlays, dropdown menus |
| `--bg-surface-tertiary` | `#222D42` | Hover states, active tab backgrounds, gutter borders |
| `--border-subtle` | `#263248` | Gutter lines, divider borders, panel splitters (`1px solid`) |
| `--border-focus` | `#6366F1` | Active input borders, focused editor frames, highlighted tabs |
| `--text-primary` | `#F1F5F9` | High-contrast body text, code characters, headings (Slate 100) |
| `--text-secondary` | `#94A3B8` | Secondary descriptions, file metadata, timestamp labels (Slate 400) |
| `--text-muted` | `#64748B` | Disabled items, keyboard shortcuts, line number gutters (Slate 500) |
| `--brand-primary` | `#6366F1` | Primary CTA buttons, active sidebar highlights, selection rings (Indigo 500) |
| `--brand-glow` | `rgba(99, 102, 241, 0.25)` | Subtle ambient backdrops for active cards and focus states |
| `--brand-accent` | `#8B5CF6` | Secondary accent, AI suggestion indicators (Violet 500) |
| `--status-critical` | `#EF4444` | Critical security alerts, buffer overflows, score $<40$ (Red 500) |
| `--status-critical-bg` | `rgba(239, 68, 68, 0.12)` | Critical issue card background, diff removal hunk background |
| `--status-warning` | `#F59E0B` | Medium severity, code smells, score $60-74$ (Amber 500) |
| `--status-warning-bg` | `rgba(245, 158, 11, 0.12)` | Warning issue card background, advisory banner |
| `--status-success` | `#10B981` | Passed checks, score $\ge 90$, diff addition hunk (Emerald 500) |
| `--status-success-bg` | `rgba(16, 185, 129, 0.12)` | Clean audit badge background, diff insertion highlight |
| `--status-info` | `#38BDF8` | Best practice advice, style suggestions, syntax notes (Sky 400) |
| `--status-info-bg` | `rgba(56, 189, 248, 0.12)` | Info chip background |

### 2.2 Typography Scale
- **Headings & Body Font**: `Inter`, `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, sans-serif.
- **Code & Monospace Font**: `'JetBrains Mono'`, `'Fira Code'`, `Consolas`, monospace with `font-feature-settings: "calt" 1`.

| Level / Role | Font Family | Size | Weight | Line Height | Tracking |
|---|---|---|---|---|---|
| **Display / H1** | Inter | `28px` (`1.75rem`) | `700` (Bold) | `1.2` | `-0.02em` |
| **Section Title / H2** | Inter | `20px` (`1.25rem`) | `600` (SemiBold) | `1.3` | `-0.01em` |
| **Card Header / H3** | Inter | `16px` (`1.0rem`) | `600` (SemiBold) | `1.4` | `0` |
| **Body Regular** | Inter | `14px` (`0.875rem`) | `400` (Regular) | `1.5` | `0` |
| **Body Small / Meta** | Inter | `12px` (`0.75rem`) | `500` (Medium) | `1.4` | `0.01em` |
| **Code Editor Body** | JetBrains Mono | `13px` (`0.8125rem`) | `400` / `500` | `1.6` | `0` |
| **Code Badge / Tag** | JetBrains Mono | `11px` (`0.6875rem`) | `600` (SemiBold) | `1.2` | `0.02em` |

### 2.3 Spacing & Elevation System
- **Spatial Grid**: Strict 4px / 8px incremental scale (`p-1` = 4px, `p-2` = 8px, `p-3` = 12px, `p-4` = 16px, `p-6` = 24px, `p-8` = 32px).
- **Border Radius**: Subtle, industrial radius standards:
  - Small elements (Badges, buttons): `4px` (`rounded-sm` / `rounded`)
  - Panels and cards: `6px` (`rounded-md`)
  - Modal windows: `8px` (`rounded-lg`)
- **Shadow Tokens**:
  - `shadow-subtle`: `0 1px 2px rgba(0, 0, 0, 0.5)`
  - `shadow-elevated`: `0 4px 16px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05)`
  - `shadow-modal`: `0 20px 40px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(99, 102, 241, 0.2)`

---

## 3. Global Layout Architecture

The application adopts a **persistent sidebar + sticky contextual toolbar + responsive workstation** frame.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  TOP APPLICATION BAR (60px)                                                            │
│  [Logo: AI Code Review]  [Breadcrumb: Workspace > C++ Engine]       [User Avatar]     │
├─────────────┬──────────────────────────────────────────────────────────────────────────┤
│ SIDEBAR     │ CONTEXTUAL WORKSPACE HEADER (48px)                                       │
│ (240px)     │ [Lang Dropdown: Python] [File: buffer.py] [Chars: 1,420] [Analyze (CTA)]│
│             ├────────────────────────────────────────┬─────────────────────────────────┤
│ [Dashboard] │                                        │                                 │
│ [Workspace] │  MONACO CODE EDITOR                    │  ANALYSIS RESULTS PANEL         │
│ [History]   │  (55% Width, Full Height)              │  (45% Width, Scrollable)        │
│ [Reports]   │  • Syntax Highlighting                 │  • Score Gauge: 84 / 100 [B]    │
│ [Settings]  │  • Line Numbers & Minimap              │  • Categorized Tabs:            │
│             │  • Gutter Markers for Flaws            │    [All] [Bugs] [Security]      │
│ ─────────── │                                        │  • Issue Cards with Solutions   │
│ [Quick New] │                                        │  • "Open Side-by-Side Diff" CTA │
│ [API Health]│                                        │                                 │
└─────────────┴────────────────────────────────────────┴─────────────────────────────────┘
```

---

## 4. Key Screen Layouts & Detailed Specifications

### 4.1 Global Sidebar Navigation
- **Dimensions**: Fixed 240px width on desktop ($\ge 1024\text{px}$), collapsible to a 64px icon-only rail, and transforms to a slide-over sheet on mobile.
- **Visual Style**: `--bg-surface-primary` with a 1px solid `--border-subtle` right border.
- **Items**:
  - Brand identity header: Hexagonal code icon with an Indigo electric pulse + "AI Code Review".
  - Main nav items:
    - `Dashboard` (Icon: `LayoutDashboard`)
    - `Review Workspace` (Icon: `Code2`) - with active indicator badge.
    - `Review History` (Icon: `History`)
    - `Quality Reports` (Icon: `FileBarChart2`)
    - `Settings & API` (Icon: `Settings`)
  - Bottom widget: Active Gemini API status indicator (Green ping dot) and current user session badge.

### 4.2 Dashboard Analytics View
- **Summary Metrics Strip**: 4 compact KPI tiles:
  1. *Total Code Reviews*: Formatted integer with historical delta (`+14% this week`).
  2. *Mean Quality Score*: Visual circular ring gauge displaying average score with grade badge.
  3. *Critical Security Flaws Found*: Red-highlighted count displaying prevented vulnerabilities.
  4. *Performance Fixes Applied*: Cyan-highlighted count showing algorithmic optimizations.
- **Charts & Graphs Grid**:
  - *Left (60%)*: Quality Score Progression Area Chart (Recharts) with an indigo gradient fill, tracking scores over date ranges.
  - *Right (40%)*: Multi-axis Radar Chart breaking down scores across 5 dimensions: Bug Safety, Security Hygiene, Runtime Efficiency, Idiomatic Cleanliness, and Maintainability.
- **Recent Reviews Table**: High-density table showing: Title, Language icon, LOC count, Detected issues count, Final Score badge, and "Open Review" quick action button.

### 4.3 Code Review Workspace
The heart of the application, engineered for maximum ergonomics:
- **Top Command Strip (Toolbar)**:
  - **Language Select Dropdown & Smart Detection**:
    - **Auto Detect (Default)**: Automatically identifies language from code syntax or file extension. Displays detected language pill (e.g., `Auto: Python`).
    - **Manual Selection**: Direct selection from 6 supported languages (`Python`, `JavaScript`, `TypeScript`, `Java`, `C`, `C++`), freezing selection against code changes.
    - **Dynamic Status Indicator Badges**:
      - `Auto Detected: [Language]` (Blue badge with `Sparkles` icon): Active when language is auto-detected with high or medium confidence.
      - `Manually Selected: [Language]` (Indigo badge with `Lock` icon): Active when developer manually selects a language.
      - `Detection Uncertain` (Amber badge with `AlertTriangle` icon): Active when code is ambiguous; displays a banner guiding user to confirm or choose a language manually.
  - **Upload Source File Trigger**: `UploadCloud` icon button opening native file dialog or accepting direct drag-and-drop; automatically resolves language from file extension.
  - **Buffer Telemetry**: Displays Line count, Character count, and File Size in real time.
  - **Clear / Reset Buffer Button**: Danger-styled outline button with confirmation popover.
  - **Analyze Code (Primary CTA)**: High-visibility Indigo button with keyboard shortcut tooltip (`Ctrl + Enter` / `Cmd + Enter`).
- **Editor Canvas**:
  - Full-height instance of Monaco Editor configured with customized dark charcoal colors matching `--bg-canvas`.
  - Line numbers rendered in muted slate (`#64748B`), with active line number highlighted in vibrant indigo (`#818CF8`).
  - Active line gutter highlight rendered with subtle translucent border.

### 4.4 Analysis Results & Findings Panel
Once analysis finishes, the right panel populates with rich, interactive review cards:
- **Header Score Card**:
  - Large circular radial progress meter showing final quality score (0–100) and letter grade (`A`, `B`, `C`, `D`, `F`).
  - Executive summary text detailing code health in 2 concise sentences.
- **Category Filter Tabs**:
  - `All Issues (8)`
  - `Bugs & Logic (3)` (Red dot)
  - `Security (2)` (Shield icon)
  - `Performance (2)` (Lightning icon)
  - `Best Practices (1)` (Sparkles icon)
- **Interactive Issue Card Specification**:
  - **Top Row**: Severity badge (`CRITICAL` in red, `HIGH` in orange, `MEDIUM` in amber, `LOW` in blue) + Category tag + Line Range anchor (`Line 42 - 48`).
  - **Title**: Clear, technical synopsis (e.g., `Unbounded Buffer Copy (Potential Stack Overflow)` or `Unindexed O(n²) Array Search in Nested Loop`).
  - **Explanation**: Clean typography detailing the root cause and why it matters in production.
  - **Actions**:
    - "Jump to Line in Editor" (Smooth-scrolls the Monaco Editor to line 42 and flashes the line decoration).
    - "Show Recommended Fix" (Expands an inline code diff preview with copy-to-clipboard button).

### 4.5 Side-by-Side Diff Comparison View
- **Trigger**: Clickable "Inspect Full Side-by-Side Diff" button located in the analysis header.
- **Presentation**: Fullscreen or large modal modal backdrop (`z-50`).
- **Editor**: Uses `MonacoDiffEditor` split horizontally into two panes:
  - *Left Pane*: "Original Code" (Read-only, highlighted with subtle red deletion hunks).
  - *Right Pane*: "AI-Optimized Production Code" (Read-only, highlighted with vibrant green insertion hunks).
- **Diff Controls**:
  - Next/Previous change navigation buttons.
  - "Copy Optimized Code" button with instant success checkmark animation.
  - "Close Diff Viewer" (`Esc` key binding).

### 4.6 Security & Performance Analyzers
- **Security Audit View**:
  - Flags CVE/CWE classifications (e.g., `CWE-120: Buffer Copy without Checking Size of Input`, `CWE-798: Use of Hard-coded Credentials`).
  - Direct guidance on environment variable injection and secure parameterization.
- **Performance Audit View**:
  - Big-O complexity badge (e.g., `Time: O(N²) -> Recommended: O(N log N)`).
  - Memory consumption estimates and flags for unnecessary heap allocations or blocking synchronous calls.

---

## 5. Responsive Breakpoint Adaptations

| Viewport Width | Layout Adaptations |
|---|---|
| **Desktop ($\ge 1280\text{px}$)** | Full 2-column workspace side-by-side (55% editor / 45% results). Persistent 240px sidebar. Full diff viewer enabled. |
| **Laptop ($1024\text{px} - 1279\text{px}$)** | 2-column workspace with 50%/50% split. Sidebar collapsed to 64px icon-only rail by default (expandable on hover). |
| **Tablet ($768\text{px} - 1023\text{px}$)** | Single-column stacked workspace with sticky top tab toggle between `[Code Editor]` and `[Analysis Results]`. Drawer sidebar. |
| **Mobile ($< 768\text{px}$)** | Vertical mobile layout. Monaco editor adjusts with minimap disabled to conserve bandwidth and touch area. Floating action button for analysis trigger. Hamburger navigation. |

---

## 6. Comprehensive Component Specifications

### 6.1 Buttons
- **Primary Action (Analyze Code)**:
  - Background: `#6366F1` (Indigo 500)
  - Hover: `#4F46E5` (Indigo 600) + subtle 8px blur glow (`rgba(99, 102, 241, 0.4)`)
  - Active: `#4338CA`
  - Text: White, font-weight 600, 14px.
  - Disabled: Opacity 50%, cursor not-allowed.
- **Secondary / Outline Action (Upload / Diff)**:
  - Background: `#18202F`, Border: `1px solid #263248`
  - Hover: Background `#222D42`, Border `#3B82F6`
  - Text: `#F1F5F9`, font-weight 500.

### 6.2 Severity Badges
- Built using pill shape (`rounded-full px-2.5 py-0.5 text-xs font-mono font-semibold`):
  - **CRITICAL**: Background `rgba(239, 68, 68, 0.15)`, Border `1px solid rgba(239, 68, 68, 0.4)`, Text `#F87171`
  - **HIGH**: Background `rgba(249, 115, 22, 0.15)`, Border `1px solid rgba(249, 115, 22, 0.4)`, Text `#FB923C`
  - **MEDIUM**: Background `rgba(245, 158, 11, 0.15)`, Border `1px solid rgba(245, 158, 11, 0.4)`, Text `#FBBF24`
  - **LOW**: Background `rgba(59, 130, 246, 0.15)`, Border `1px solid rgba(59, 130, 246, 0.4)`, Text `#60A5FA`
  - **INFO / BEST PRACTICE**: Background `rgba(168, 85, 247, 0.15)`, Border `1px solid rgba(168, 85, 247, 0.4)`, Text `#C084FC`

### 6.3 Loading, Error & Empty States
- **Analysis In-Progress State**:
  - The "Analyze Code" button transitions into an animated pulse with a dual-ring spinner.
  - Results panel renders 3 skeleton issue cards featuring animated shimmering gradients (`#18202F` to `#222D42`).
  - Status indicator displays cycling stage text:
    `"Scanning for security patterns..."` $\to$ `"Evaluating Big-O complexity..."` $\to$ `"Generating refactored recommendations..."`.
- **Empty State (Workspace - No Code Analyzed Yet)**:
  - Central illustration: Minimalist vector wireframe of a terminal cursor with prompt icon.
  - Headline: "Ready for Code Inspection"
  - Subhead: "Paste your code snippet or upload a source file (.py, .ts, .cpp, etc.) and hit Analyze to start a senior-level AI code review."
- **Empty State (Review History - No Past Reviews)**:
  - Headline: "No Review History Found"
  - Subhead: "Completed code reviews will appear here automatically with scores and audit trails."
  - CTA Button: "Start First Review"
- **Error State (API Timeout or Gemini Rate Limit)**:
  - Amber/Red warning card with warning triangle icon.
  - Message: "The AI analysis engine is experiencing high traffic or the payload timed out. Your code is preserved in the editor."
  - Action: "Retry Analysis" button.
