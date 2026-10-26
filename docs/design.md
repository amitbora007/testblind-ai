# TestBlind AI — UI/UX Design System & Experience Specification

**Document Version:** 1.0.0
**Design Reference:** Dark TraceAI Studio Benchmark (`references/aitool.jpeg`)
**Design Lead:** Senior UI/UX Architect
**Design System Name:** BlindShield Design System (OLED / Deep Slate Edition)

---

## 1. Visual Identity & Creative Direction

### 1.1 Aesthetic Philosophy
TestBlind AI is a mission-critical developer and QA platform. The design is inspired directly by the **TraceAI Studio** reference image: deep midnight-slate backgrounds, crisp high-contrast data visualization, luminescent status cues, and dense, structured layouts optimized for software engineers and QA architects.

Key tenets:
1. **Developer-First Precision:** Data density without visual clutter. Metrics, stack traces, AST diffs, and execution logs must be immediately readable without unnecessary decoration.
2. **Deterministic Color Semantics:** Color carries functional meaning. Green is strictly verified pass/killed mutant; red is failed/surviving blindspot; amber is skipped; orange is blocked; purple/violet is AI-generated/synthetic.
3. **Restraint & Dignity:** No generic AI visual clichés (no superfluous gradient blobs, no ungrounded particle animations, no emojis masquerading as icons). All iconography utilizes crisp SVG icons (Lucide React).
4. **Verified Evidence Separation:** Visual hierarchy strictly demarcates unverified AI suggestions from verified, cryptographically logged test execution runs.

---

## 2. Design Tokens & Color Palette

### 2.1 Color Tokens

```css
:root {
  /* Surface & Background Hierarchy */
  --color-canvas-base: #0B1120;       /* Ultra-deep slate for root canvas */
  --color-canvas-subtle: #0F172A;     /* Primary workspace background */
  --color-card-bg: #1E293B;           /* Primary container and card surface */
  --color-card-elevated: #243048;     /* Hover and elevated dialog surface */
  --color-sidebar-bg: #0D1526;        /* Fixed left navigation sidebar */
  --color-border-subtle: #334155;     /* Structural divider and card border */
  --color-border-highlight: #475569;  /* Focused card and active input border */

  /* Text & Content Hierarchy */
  --color-text-primary: #F8FAFC;      /* High-contrast titles, headers, code */
  --color-text-secondary: #94A3B8;    /* Labels, descriptions, table headers */
  --color-text-muted: #64748B;        /* Timestamps, breadcrumb dividers */
  --color-text-disabled: #475569;     /* Inactive buttons and inputs */

  /* Semantic Statuses (Matched to TraceAI Studio Reference) */
  --color-status-passed: #10B981;     /* Emerald Green: Test Passed / Mutant Killed */
  --color-status-failed: #EF4444;     /* Coral Red: Test Failed / Incident Unresolved */
  --color-status-skipped: #F59E0B;    /* Amber: Test Skipped / Partial Warning */
  --color-status-blocked: #F97316;    /* Vivid Orange: Blocked / Environment Timeout */
  --color-status-ai: #8B5CF6;         /* Luminescent Violet: AI Insight / Synthetic Gen */
  --color-status-primary: #3B82F6;    /* Electric Blue: Primary CTA / Active Tab */

  /* Evidence Quality Badges */
  --badge-verified-bg: rgba(16, 185, 129, 0.15);
  --badge-verified-border: #10B981;
  --badge-verified-text: #34D399;

  --badge-ai-draft-bg: rgba(139, 92, 246, 0.15);
  --badge-ai-draft-border: #8B5CF6;
  --badge-ai-draft-text: #C084FC;

  --badge-unexecuted-bg: rgba(245, 158, 11, 0.15);
  --badge-unexecuted-border: #F59E0B;
  --badge-unexecuted-text: #FBBF24;
}
```

### 2.2 Typography System
- **Primary Interface Font:** `Inter`, `IBM Plex Sans`, or system sans-serif (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`).
- **Code & Terminal Font:** `JetBrains Mono`, `Fira Code`, or `ui-monospace`.

| Token | Font Size | Line Height | Weight | Usage |
| :--- | :--- | :--- | :--- | :--- |
| `text-display` | 30px (1.875rem) | 36px | 700 (Bold) | Dashboard hero numbers, primary metric values |
| `text-h1` | 24px (1.5rem) | 32px | 600 (Semibold) | Page titles (e.g. "Dashboard", "Test Cases") |
| `text-h2` | 18px (1.125rem) | 26px | 600 (Semibold) | Card titles, section headers |
| `text-h3` | 15px (0.9375rem) | 22px | 600 (Semibold) | Table headers, modal titles |
| `text-body` | 14px (0.875rem) | 20px | 400 (Regular) | Primary table cells, descriptions |
| `text-small` | 12px (0.75rem) | 16px | 500 (Medium) | Metric sub-labels, badge tags, timestamps |
| `text-mono` | 13px (0.8125rem) | 18px | 400 (Regular) | Code snippets, stack traces, scenario IDs (`SC-1023`) |

---

## 3. Component Architecture & Reference Screen Breakdown

### 3.1 TraceAI Studio Dashboard Layout
The primary dashboard implements a pixel-faithful recreation of `references/aitool.jpeg`:

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ┌───────────────┐ ┌──────────────────────────────────────────────────────────────────────────────────┐ │
│ │  TraceAI      │ │ Dashboard                                                     Last 30 Days [v]   │ │
│ │  Studio       │ ├──────────────────────────────────────────────────────────────────────────────────┤ │
│ │               │ │ [Test Cases Overview]  [Requirement Coverage]  [Test Scenarios]  [AI Insights]   │ │
│ │ [x] Dashboard │ │  Total: 1,250           Total Req: 320          Total Runs: 450   Flaky Tests: 15│ │
│ │ [ ] Test Cases│ │  Automated: 850 (68%)   Covered: 295 (92%)      Passed: 380       Suggestions: 8 │ │
│ │ [ ] Reqmts    │ ├──────────────────────────────────────────────────────────────────────────────────┤ │
│ │ [ ] Scenarios │ │ [Test Case Execution Status (Last 30 Days)]  │ [Requirement Coverage Analysis]   │ │
│ │ [ ] Runs      │ │  Weekly Stacked Bars:                         │  Donut: Fully: 60%, Part: 25%,   │ │
│ │ [ ] Reports   │ │  (Passed, Failed, Skipped, Blocked)           │         Untested: 10%, Obs: 5%   │ │
│ │ [ ] AI Insights├──────────────────────────────────────────────────────────────────────────────────┤ │
│ │               │ │ [Recent Test Scenarios]                                                          │ │
│ │ [Settings]    │ │  SC-1023 | User Login Flow | REQ-55 | (v) Passed | 1m 20s | AI Confidence: 98% │ │
│ └───────────────┘ └──────────────────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

#### Detailed Breakdown of Dashboard Elements:
1. **Left Navigation Sidebar:**
   - Width: 240px (desktop), collapsible to 64px icon bar on tablet, slide-over drawer on mobile.
   - Brand Header: Cyan-to-Purple icon + "TraceAI Studio / TestBlind AI" wordmark.
   - Navigation Items:
     - Dashboard (`LayoutDashboard` icon) — Active state with solid electric-blue indicator pill.
     - Test Cases (`CheckSquare` icon)
     - Requirements (`FileText` icon)
     - Test Scenarios (`GitFork` / `Workflow` icon)
     - Execution Runs (`PlayCircle` icon)
     - Reports (`BarChart3` icon)
     - AI Insights (`Sparkles` / `BrainCircuit` icon with subtle violet glow)
     - Settings (`Settings` icon anchored to bottom)
2. **Top Metric Cards Grid (4 Columns):**
   - **Card 1: Test Cases Overview**
     - Left: "Total: 1,250" in display bold. Subtext: "Automated: 850", "Manual: 400".
     - Right: Mini 3D/two-tone vertical bar chart with "68% Automation Rate" label and blue checklist icon.
   - **Card 2: Requirement Coverage**
     - Left: "Total Req: 320". Subtext: "Covered: 295", "Untested: 25".
     - Right: Radial/Donut gauge showing "92% Coverage" with cyan-to-purple gradient arc and linked document icon.
   - **Card 3: Test Scenarios Executed**
     - Left: "Total Runs: 450". Subtext: "Passed: 380", "Failed: 70".
     - Right: Smooth green SVG trend sparkline with circular start/end markers and milestone flag icon.
   - **Card 4: AI-Driven Insights**
     - Metrics: "Flaky Tests Predicted: 15", "Optimization Suggestions: 8".
     - Right: Luminescent neon violet glowing AI brain icon with pulse backdrop.
3. **Mid-Section Visualization Grid (2 Columns, 7:5 ratio):**
   - **Column 1: Test Case Execution Status (Last 30 Days)**
     - Stacked bar chart broken down across weeks.
     - Legend pills at top: `Passed` (Emerald), `Failed` (Coral Red), `Skipped` (Amber), `Blocked` (Orange).
     - Hover tooltips detailing counts per category.
   - **Column 2: Requirement Coverage Analysis**
     - Multi-segment donut chart with center cutout displaying "320 Total".
     - Legend labels: `Fully Covered` (60% Blue), `Partially Covered` (25% Purple), `Not Covered` (10% Orange), `Obsolete` (5% Grey).
4. **Bottom Data Table: Recent Test Scenarios**
   - Header: Scenario ID, Name, Associated Req, Status, Execution Time, AI Confidence.
   - Rows:
     - `SC-1023` | `User Login Flow` | `REQ-55` | `(v) Passed` (Emerald pill) | `1m 20s` | `98%` (High Confidence badge)
     - `SC-1022` | `User Login Flow` | `REQ-55` | `(v) Passed` (Emerald pill) | `1m 20s` | `98%` (High Confidence badge)
   - Row interaction: Hover highlight (`bg-slate-700/40`), click opens side-drawer with raw execution traces and AST mutation graphs.

---

## 4. Workflow Screen Specifications

### 4.1 AI Test Gap Discovery Screen
- **Header:** Repository Selector, Branch dropdown, "Run Gap Analysis" primary action.
- **AST Blindspot Map:** Visual tree or interactive file table highlighting modules with high cyclomatic complexity and unexercised mutation branches.
- **Mutation Matrix:** Filterable table displaying mutated files, operator type (`AOR`, `ROR`, `LCR`), code diff preview, and mutation survival status.
- **Kill-Rate Progress Gauge:** Visual counter showing baseline vs AI-augmented mutation score.
- **Synthesized Tests Review Panel:** Split-view editor showing generated tests, targeted surviving mutants, and "Verify & Promote" button.

### 4.2 Incident-to-Regression Test Screen
- **Intake Form:**
  - Incident Title and Severity selector.
  - Raw Traceback & Log Input: Textarea with auto-detection of language and stack trace parser.
  - Source File Anchor: Path and commit hash selector.
- **Diagnosis & Hypothesis Card:** AI-generated summary of failure mechanism, invariant violation, and proposed reproduction strategy.
- **Dual-State Verification Console:**
  - Side-by-side terminal runners:
    - **Run on Buggy Code:** Must yield exit code != 0 with matching stack trace.
    - **Run on Fixed Code:** Must yield exit code == 0 with all assertions passing.
  - Prominent "Verified Reproduction" shield badge locked with timestamp and execution hash.

### 4.3 Standalone Code Playground
- **Side-by-Side Dual Editor Layout:**
  - Left: Implementation Code (e.g. Python function / TypeScript module).
  - Right: Unit Tests / Synthesized Tests.
- **Top Toolbar:** Language selector (Python, TypeScript, Go), Test Framework selector (`pytest`, `jest`), "Inject Mutations" button, "Synthesize Test" button, "Run Sandbox" CTA.
- **Bottom Output Drawer:** Real-time terminal output, pass/fail indicators, mutation kill logs, execution time (ms).

---

## 5. Responsive Behavior & Breakpoints

TestBlind AI is built for responsive resilience using Tailwind CSS and modern CSS container queries:

| Breakpoint | Target Devices | Layout Adaptation Strategy |
| :--- | :--- | :--- |
| **`desktop` (>= 1280px)** | Desktop monitors (1080p, 1440p, 4K) | Full persistent 240px sidebar, 4-column metric grid, 2-column chart grid, full 6-column data tables. |
| **`laptop` (1024px - 1279px)** | Laptops, small desktop screens | Collapsible sidebar (64px icon bar), 4-column metric grid, stacked chart grid (1 column each). |
| **`tablet` (768px - 1023px)** | iPads, Surface tablets | Collapsible sidebar drawer, 2x2 metric card grid, stacked charts, horizontally scrollable data tables. |
| **`mobile` (< 768px)** | Smartphones (iPhone, Android) | Hamburger drawer or fixed bottom navigation bar, single-column stacked metric cards, card-based test scenario views replacing wide tables. |

---

## 6. Accessibility & Keyboard Navigation (WCAG 2.1 AA)

- **Color Contrast:** All body text meets or exceeds 4.5:1 contrast against `#0F172A` and `#1E293B`. Status badges use both distinct colors AND distinct SVG icons to prevent color-only communication.
- **Focus Indicators:** Explicit, highly visible focus rings (`ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-900`) on all interactive buttons, tabs, table rows, and editor containers.
- **Keyboard Shortcuts:**
  - `Cmd/Ctrl + Enter`: Run Test / Execute Sandbox.
  - `Cmd/Ctrl + K`: Global Command Palette (switch project, jump to incident, search test case).
  - `Esc`: Close drawers and modal overlays.
- **Screen Reader Support:** ARIA live regions (`role="status" aria-live="polite"`) for background execution updates, and ARIA labels on all icon-only buttons.

---

## 7. Implemented Component Catalog & Responsive Verification (Phase 2 Baseline)

The BlindShield design system has been fully implemented in `frontend/src/`:

### 7.1 Reusable Component Catalog
- **Primitives (`src/components/ui/`):**
  - `Button`: Primary, secondary, outline, ghost, danger, AI variants with loading spinners.
  - `Input` & `Select`: Dark styled inputs with accessible labels, icons, error states, and focus rings.
  - `Card`: `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`.
  - `Badge` & `StatusPill`: High-contrast badges and semantic status pills (Passed, Failed, Skipped, Blocked, AI Suggested, Verified).
  - `Table`: Responsive table with sticky headers, hover highlights, and inspect actions.
  - `Tabs`: Accessible tab navigation with keyboard support.
  - `Dialog`: Accessible modal dialog with backdrop blur, Escape listener, and focus trapping.
  - `NotificationToast`: Dismissible toast notifications with status icons.
  - `States`: Standardized `LoadingState`, `SkeletonCard`, `EmptyState`, and `ErrorState`.
- **Application Shell (`src/components/layout/`):**
  - `BrandLogo`: TraceAI Studio by TestBlind AI logo with cyan-to-purple gradient mark.
  - `Sidebar`: 11 navigation routes, collapsible desktop mode (240px <-> 68px), and mobile slide-over drawer.
  - `Header`: Breadcrumbs, environment switcher, search palette trigger, date picker ("Last 30 Days"), notifications, profile badge.
  - `AppLayout`: Responsive layout manager.
- **TraceAI Studio Dashboard Screen (`src/pages/DashboardPage.tsx`):**
  - 4 top metric cards: Test Cases Overview, Requirement Coverage, Test Scenarios Executed, AI-Driven Insights.
  - Middle charts: 12-week stacked bar chart + requirement coverage donut chart.
  - Bottom table: Recent Test Scenarios with row-click scenario inspection dialog.
  - Interactive Component State Harness: live toggling between Normal Data, Loading Skeleton, Empty State, Error State, Sample Dialog, and Toasts.

### 7.2 Verified Responsive Viewport Benchmarks
All viewports verified in real browser (Google Chrome Headless):
- **Desktop (1440x900):** [`references/screenshots/desktop_1440.png`](file:///home/amit.bora/Downloads/ai/TestBlind%20AI/references/screenshots/desktop_1440.png) — Pixel-perfect alignment with benchmark image.
- **Laptop (1024x768):** [`references/screenshots/laptop_1024.png`](file:///home/amit.bora/Downloads/ai/TestBlind%20AI/references/screenshots/laptop_1024.png) — Fluid adaptation, 4-column metrics preserved.
- **Tablet (768x1024):** [`references/screenshots/tablet_768.png`](file:///home/amit.bora/Downloads/ai/TestBlind%20AI/references/screenshots/tablet_768.png) — 2x2 metric grid, sidebar transitions to hamburger drawer.
- **Mobile Standard (375x812):** [`references/screenshots/mobile_375.png`](file:///home/amit.bora/Downloads/ai/TestBlind%20AI/references/screenshots/mobile_375.png) — Single column card stack, touch-friendly tap targets (>44px).
- **Mobile Small (320x640):** [`references/screenshots/mobile_320.png`](file:///home/amit.bora/Downloads/ai/TestBlind%20AI/references/screenshots/mobile_320.png) — Zero horizontal overflow, wrapped header controls.

---

## 8. Phase 3 Implemented Screen Architecture & Verification Evidence

In Phase 3, all 13 production frontend screens were fully built, wired into the deep-linking client hash router (`App.tsx`), and verified across 5 viewport breakpoints using headless Google Chrome.

### 8.1 13 Production Screen Specifications

1. **Dashboard (`DashboardPage.tsx`):**
   - TraceAI Studio benchmark hierarchy with overview cards, 12-week execution bar chart, donut requirement coverage, recent test scenarios table, and interactive state toggling (normal, loading skeleton, empty, error, dialogs, toasts).
   - Prominent `DemoModeBanner` enforcing separation of simulated telemetry and verified evidence.
2. **Projects Catalog (`ProjectsPage.tsx`):**
   - Real-time search, framework filtering, project health cards, and interactive "Create Project" modal with repository URL validation.
3. **Repository Connection & Upload (`RepositoriesPage.tsx`):**
   - GitHub App OAuth connector, branch picker, drag-and-drop ZIP archive upload with 100MB file quota enforcement, and local `testblind-cli` instructions.
4. **Standalone Code Lab (`CodeLabPage.tsx`):**
   - Embedded `@monaco-editor/react` with VS Dark theme.
   - Multi-language support (Python/pytest, TypeScript/Vitest, Go/testing).
   - Input tabs: Source Code, Existing Tests, Target Invariants.
   - Separate right-hand inspection panels: AI Blindspot Suggestions, Generated Tests, and Container Sandbox Execution Results.
   - Responsive layout: Desktop split-view (side-by-side 50/50) and mobile stacked layout.
5. **AI Test Gap Discovery (`GapDiscoveryPage.tsx`):**
   - AST mutation matrix table with filter buttons for ROR (Relational), AOR (Arithmetic), LCR (Logical), and BSR (Bound Shift) operators.
   - Surviving mutant inspection drawer with AST diff viewer and synthesized regression tests.
6. **Incident-to-Regression Test Generation (`IncidentAnalysisPage.tsx`):**
   - Real incident ingestion intake modal (P0/P1/P2 severity, stack traces, reproduction preconditions).
   - Dual-state verification console: State A (Buggy Codebase, Expect RED) vs State B (Fixed Codebase, Expect GREEN).
7. **Test Cases Repository (`TestCasesPage.tsx`):**
   - Filterable test catalog by framework (pytest, vitest, go), status, and suite.
   - Interactive Test Case Creation Modal with code snippet builder.
   - Real client-side JSON export trigger.
8. **Test Scenarios Matrix (`TestScenariosPage.tsx`):**
   - End-to-end integration scenario chains linked to requirement codes (REQ-101 .. REQ-104).
   - Step-by-step pipeline visualizer and scenario creation modal.
9. **Execution Runs Console (`ExecutionRunsPage.tsx`):**
   - Historical CI and playground execution table with trigger source, duration, and test counts.
   - Slide-over terminal log drawer displaying airgapped container runner output.
10. **Test Health & Audit Reports (`ReportsPage.tsx`):**
    - Aggregated mutation kill rates, multi-layer code coverage bars, and flakiness rating breakdown.
    - Export triggers generating actual CSV and JSON downloads in the browser.
11. **AI Test Intelligence & Insights (`AiInsightsPage.tsx`):**
    - Flaky test predictor (unseeded random detection, async sleep jitter).
    - Redundant test pruning (zero mutation kill differential detection).
    - Boundary gap optimizer with one-click test synthesis.
12. **Integrations Fabric (`IntegrationsPage.tsx`):**
    - Connection cards and configuration modals for GitHub, GitLab, Slack, and Jira.
    - Airgapped CLI runner token generator (`testblind-cli`) with one-click token rotation and clipboard copy.
13. **Team & Workspace Settings (`TeamSettingsPage.tsx`):**
    - RBAC member management (Owner, Admin, Engineer, Viewer) with invite modal.
    - Ephemeral container runner security quotas (CPU vCPU slider, RAM MB, 60s hard timeout, `--network=none`, `--read-only`, non-root UID 10001).
    - Workspace API keys generator and audit log.

### 8.2 Phase 3 Browser Verification Screenshots
Captured with Google Chrome Headless and stored in `references/screenshots/phase3/`:
- [`desktop_1440_dashboard.png`](file:///home/amit.bora/Downloads/ai/TestBlind%20AI/references/screenshots/phase3/desktop_1440_dashboard.png) — 1440x900 Benchmark TraceAI Dashboard
- [`desktop_1440_code_lab.png`](file:///home/amit.bora/Downloads/ai/TestBlind%20AI/references/screenshots/phase3/desktop_1440_code_lab.png) — 1440x900 Split-panel Monaco Code Lab
- [`mobile_375_code_lab.png`](file:///home/amit.bora/Downloads/ai/TestBlind%20AI/references/screenshots/phase3/mobile_375_code_lab.png) — 375x812 Stacked mobile Code Lab layout
- [`desktop_1440_gap_discovery.png`](file:///home/amit.bora/Downloads/ai/TestBlind%20AI/references/screenshots/phase3/desktop_1440_gap_discovery.png) — 1440x900 AST Mutation Matrix
- [`desktop_1440_incidents.png`](file:///home/amit.bora/Downloads/ai/TestBlind%20AI/references/screenshots/phase3/desktop_1440_incidents.png) — 1440x900 Dual-State Incident Verification
- [`desktop_1440_test_cases.png`](file:///home/amit.bora/Downloads/ai/TestBlind%20AI/references/screenshots/phase3/desktop_1440_test_cases.png) — 1440x900 Test Case Catalog
- [`desktop_1440_execution_runs.png`](file:///home/amit.bora/Downloads/ai/TestBlind%20AI/references/screenshots/phase3/desktop_1440_execution_runs.png) — 1440x900 Runner Execution Console
- [`desktop_1440_reports.png`](file:///home/amit.bora/Downloads/ai/TestBlind%20AI/references/screenshots/phase3/desktop_1440_reports.png) — 1440x900 Mutation & Coverage Analytics
- [`desktop_1440_ai_insights.png`](file:///home/amit.bora/Downloads/ai/TestBlind%20AI/references/screenshots/phase3/desktop_1440_ai_insights.png) — 1440x900 AI Flakiness & Gap Recommendations
- [`desktop_1440_integrations.png`](file:///home/amit.bora/Downloads/ai/TestBlind%20AI/references/screenshots/phase3/desktop_1440_integrations.png) — 1440x900 Integrations & CLI Token Generator
- [`desktop_1440_team_settings.png`](file:///home/amit.bora/Downloads/ai/TestBlind%20AI/references/screenshots/phase3/desktop_1440_team_settings.png) — 1440x900 RBAC & Container Security Quotas
- [`mobile_320_reports.png`](file:///home/amit.bora/Downloads/ai/TestBlind%20AI/references/screenshots/phase3/mobile_320_reports.png) — 320x568 Ultra-narrow mobile verification

---

## 9. Phase 5 Experience Specifications & Ingestion States

### 9.1 Honest Unconfigured Setup States
When external credentials (`GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`) are absent from the environment, TestBlind AI never simulates or implies an active connection. The interface renders:
- High-contrast `Setup Required` status pill (amber token).
- Clear instruction panel highlighting required environment variables.
- Explicit notice that server restart is required to bind active OAuth / App hooks.

### 9.2 Safe Ingestion Feedback & Security Alerts
- **Progress Tracking:** Live percentage indicators and animated progress bars during multipart ZIP upload.
- **Defensive Error Cues:** Immediate red alerts on Zip Slip path traversal attempts (`../../../../etc/passwd`), invalid magic byte signatures, or oversized uploads.
- **Project Structure Metadata:** Upon successful extraction, displays language chips, detected test runner badges, and scrollable extracted file manifests.

### 9.3 Semantic Evidence Distinction in Code Lab
To prevent developer confusion between synthetic proposals and verified execution evidence, Code Lab components display distinct badge variants:
- **`Source Analysis (Unexecuted)` (Outline):** Structural AST parsing without test execution.
- **`AI Proposal (Unexecuted)` (Purple):** Generated boundary test proposals awaiting sandbox execution.
- **`Verified Sandbox Run (Sealed)` (Emerald Green):** Confirmed test execution logs sealed with SHA-256 cryptographic provenance hashes.

---

## 10. Phase 7 AI Test Gap Discovery Design Specifications

### 10.1 Gap Discovery Experience Architecture
The Test Gap Discovery interface (`GapDiscoveryPage.tsx`) provides software engineers with an empirical, interactive environment to unmask test suite blindspots:

1. **Live Backend vs Demo Indicator:**
   - When connected to the live FastAPI + PostgreSQL backend and runner engine, renders an emerald status strip with a pulsing live signal and current execution run metadata.
   - When operating offline or without projects, renders a high-contrast amber `DemoModeBanner` with an explicit notice of simulated telemetry.

2. **Mutation Testing KPI Cards:**
   - **Total AST Mutants:** Counter displaying mutants injected across ROR, AOR, LCR, and BSR operator families.
   - **Killed by Suite:** Counter and kill rate percentage (Emerald green).
   - **Surviving Blindspots:** High-severity counter (Coral red) highlighting unasserted invariants.
   - **Mutation Score:** High-contrast purple metric calculating $\text{Killed} / (\text{Total} - \text{Equiv})$.

3. **Operator Filter Tabs & Status Dropdown:**
   - Tab pills for `ALL`, `ROR`, `AOR`, `LCR`, `BSR` with instant filter response.
   - Status dropdown filtering by `All Statuses`, `Surviving Only`, `Killed Only`, `Timeout Only`, and `Equivalent Only`.

4. **AST Semantic Diff Modal:**
   - Displays original source token (`-` in red) vs mutated token (`+` in green).
   - Dynamic explanation card explaining why the mutant survived existing tests and citing the exact missing invariant boundary.
   - For survived mutants, allows one-click "Synthesize Killing Test" invoking LLM generation with dual-state sandbox verification.

5. **Dual-State Verification Status Badging:**
   - **`Dual-State Verified Killer` (`StatusPill status="verified"`):** Test passed Gate 1 (pristine baseline) and Gate 2 (mutant killing). Rendered with emerald border and displayed alongside an immutable SHA-256 evidence hash.
   - **`AI Suggestion (Unexecuted)` (`StatusPill status="ai_suggested"`):** Candidate test synthesized but not yet certified through sandbox execution.
   - **`Execution Failure` (`StatusPill status="failed"`):** Candidate test that failed on baseline unmutated code, rejecting AI hallucinations before promotion.



