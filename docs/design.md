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

