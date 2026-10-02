# PROJECT_CONTEXT.md

> Single-file handover context for an AI assistant continuing this project.
> Written at the end of a working session on **2 October 2026**.
> Labels used throughout: `[IMPLEMENTED]` `[IN PROGRESS]` `[PLANNED]` `[PROPOSED]` `[REJECTED]` `[BLOCKED]` `[UNKNOWN]`

---

## 1. Project Identity

| | |
|---|---|
| **Project name** | PSM Morning Review / Magppie Monitoring Review (backend package `psm-morning-review-api`, frontend `psm-morning-review-web`) |
| **Project type** | Internal business-operations dashboard suite — Express REST API + React SPA reading live Zoho CRM |
| **Current status** | Live in production on Vercel. Substantial uncommitted correctness work in the working tree. |
| **Primary purpose** | Give Magppie's daily stand-up ("morning review") meetings one accurate, period-filterable view of the whole order journey, read live from Zoho CRM |
| **Vision** | One reconcilable chain from raw lead → qualified lead → order → design → factory → dispatch → installation → AMS, where every board's numbers agree with every other board's |
| **Main objective (current)** | Make every card's number correct and reconcilable across boards, without renaming or adding cards |
| **Target users** | Magppie internal staff — PSM team, sales managers, design team, factory/dispatch/installation leads. Reviewed daily in stand-ups. |
| **Target use cases** | Daily stand-up review; finding stuck orders; per-period reporting (day / week / month / last month / specific month / quarter / year / custom range); drilling from a card into the underlying CRM records |
| **Development stage** | Mature and deployed; currently in a correctness-remediation phase |

**Organisation (verified from live Zoho):** SUNROOOF LUMINARIES PRIVATE LIMITED, `zgid 60038775297`, timezone `Asia/Kolkata`, Zoho One Enterprise, 54 seats.

---

## 2. Executive Project Summary

**What it does.** It renders ~9 dashboards ("boards"), each a funnel of cards. Every card is a count of CRM records at or through a step of the business journey. Clicking a card opens a popup listing the underlying records with per-card columns, filters, search, a pie breakdown and a weekly view.

**Why it exists.** The business runs daily stand-ups off Zoho CRM. Zoho's own views could not answer "how many orders entered revision last month" because `Deals.Stage` is a *snapshot* — it says where a record is now, with no date. Teams were reading different numbers from different boards.

**What problem it solves.** It makes the journey *dated and reconcilable*. The key discovery driving the current architecture: **Zoho already keeps dated stage-history (field-tracker) modules that nothing in the original codebase read.**

| Module | Tracks | Notes |
|---|---|---|
| `Lead_Status_History` | `Leads.Lead_Status` | Pre Sales is fully dateable |
| `Opportunity_Stage_History` | `Contacts.Stage` | Dates S6 + Handover only |
| `DealHistory` | `Deals.Stage`, `Designer_Name`, `Product_Type`, both revision reasons | Design is fully dateable |

Each row is one dated period in one stage: `Potential_Name`/`Full_Name`, `Stage`, `Modified_Time` (= when it ENTERED), `Moved_To__s` (`null` = still there), `Duration_Days`.

**How it works.** Browser → Express → Zoho CRM v8 REST → in-memory transform → JSON → React. There is **no database**. Two in-memory cache layers (a Zoho read cache and an HTTP response cache) plus a background warm-up make repeat loads instant.

**What makes it distinctive.**
1. **No persistent store of any kind.** Zoho CRM is the only system of record. This is a locked, repeatedly-restated constraint.
2. **Blueprint-derived truth.** The CRM's own Blueprints (process definitions) were read and used to validate stage→card mappings.
3. **Every card ships its own formula.** A "Show Formula" panel is *generated from the same config the counting uses*, so it cannot drift from the code.
4. **Flow + stock on one card.** Cards show both "entered this stage during the period" and "sitting here right now".

---

## 3. Current State

### 3.1 Implemented and working `[IMPLEMENTED]`

- All 9 boards render and all API endpoints return 200 across 10 timeframes and 4 city filters.
- Live Zoho integration (OAuth refresh-token flow), two cache layers, background warm-up.
- Deployed to Vercel, serving production, region `bom1` (Mumbai).
- Per-card "Show Formula" panel generated from config.
- Records popup with per-card column sets, filters, search, pie chart, weekly view.
- Backend tests: **10/10 pass** (`node --test src/services/*.test.js`).

### 3.2 Completed this session, **uncommitted** `[IMPLEMENTED]`

All of the following is in the working tree, verified on localhost, **not committed and not pushed**:

1. **Pre Design re-based onto the dated stage ledger.** Every card now counts *distinct orders that entered its stage during the period*, with the live queue beside it.
2. **Sales S1–S6 corrected** to map to exactly six named `Client_Status` values.
3. **Sales S6 + Handover re-based** onto `Opportunity_Stage_History`.
4. **"Last month" + month picker added to the Sales board's own filter bar.**
5. **Payment stage double-count fixed** (`Payment Awaited` / `Payment Approvals`).
6. **Popup record-resolution bug fixed on both Sales and Pre Design.**
7. **Formula panel corrected** — it was printing a `Created Time` filter on three cards that are not creation-scoped.
8. **Warm-up fixes** — it was silently 401-ing under auth, and warming the wrong (paged) ledger.
9. **CORS moved before auth** so preflight is not rejected.
10. **Docker image + graceful shutdown** (`backend/Dockerfile`, `.dockerignore`, SIGTERM handling in `server.js`).
11. **Bulk Read fast path** (`backend/src/services/bulkLedger.js`) — 3 requests instead of 140.

### 3.3 Partially implemented `[IN PROGRESS]`

- **Month picker rollout.** Present on: the universal `PeriodFilter` (Pre Sales, AMS, Factory, Installation), Design (own bar), Sales (own bar, added this session). **Not yet verified on: Measurements, Factory, Dispatch, Decision Queue.**

### 3.4 Blocked `[BLOCKED]`

- **Persistent self-hosted backend via Tailscale Funnel.** Everything except public exposure is done. Blocked on a single admin UAC prompt to install the Tailscale MSI (installer exit code 1602 = elevation cancelled).

### 3.5 Known broken / incorrect `[IN PROGRESS]`

- **S1–S5 cannot be dated.** They read `Client_Status`, which **no Zoho history module tracks**. They remain snapshot + creation-window and will under-report for past periods. Not fixable in code.
- **"EP prep · Planned" can never fill.** Its only stage value `EPT` appears **0 times in 28,025 history rows**.
- **2,575 orders (~33% of the module) sit at stage `None`** and appear on no card. Count is now published; the orders are still uncounted by design.
- One order at `Site follow up done` is on no board.

### 3.6 What to do next

1. Commit and push the working tree (conventional commits, explicit staging).
2. Check the four remaining boards for the month picker.
3. Decide the S6-vs-ladder field inconsistency (§21).

---

## 4. Complete Requirements

### 4.1 Functional
- Nine boards: Pre Sales, Sales, Design (Pre Design + Post Design sub-tabs), Measurements/PDI, Factory & Standup, Dispatch, Installation, AMS, Decision Queue.
- Universal period filter on **every** board: Daily, Weekly, Monthly, **Last month**, Quarterly, **Pick a month**, Custom range.
- City filter: All / Delhi (DEL) / Hyderabad (HYD) / Others (expandable to one city).
- PSM filter on Pre Sales.
- Every card clickable → records popup with per-card columns.
- "Show Formula" on every board, showing the real calculation.
- Current date shown top-right in the PSM header, large font.
- `Site Not Ready Reason` column on the Installation "started" table.
- Time-in-status formatted as `1 day + 6h 49m` everywhere it appears.

### 4.2 Business rules
- **Sunrooof projects must be excluded everywhere** (matched on name and `Product_Type`, regex `/sun\s*ro+f/i`).
- Test records excluded (name contains "test").
- **S1–S6 map to exactly these six `Client_Status` values** — user-specified, authoritative:

| Rung | Current Status value |
|---|---|
| S1 | Not Yet Validated |
| S2 | Only Validated |
| S3 | Validated But Design Open |
| S4 | Design Open + Price Open |
| S5 | Design Closed + Price Open |
| S6 | Principally Closed |

- Post-design begins at blueprint stage **`Assign Post - Designer`** and runs to **`PDI Payment Done`** (user instruction).
- Sales "Handover to design" counts **clients**; Design intake counts **orders**. Measured fan-out: **1 client ≈ 2.12 orders**. The two can never be equal and must never be summed.
- `None` is Zoho's empty stage — counted on no card, but its count must be stated.

### 4.3 UI/UX
- **Card names are frozen.** No card may be renamed, added or deleted. (Restated by the user multiple times.)
- Layout and card shape stay as they are.
- No horizontal page scroll; works at 1500px and 375px.
- Red highlighting is per-card and threshold-based, never invented where no limit is agreed.

### 4.4 Technical / architecture
- Files under 500 lines.
- Validate input at system boundaries.
- Read a file before editing it.
- Never commit secrets or `.env`.
- Never add a `Co-Authored-By` trailer unless `.claude/settings.json` sets `attribution.commit` (**it does not**).
- Stage files explicitly — **never `git add .`**.

### 4.5 Data / security
- **Zoho CRM must remain the only persistent source of CRM data.** Transient in-memory processing is allowed.
- Backend-only env vars, never exposed to the frontend: `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN`, `ZOHO_ACCOUNTS_URL`, `ZOHO_API_DOMAIN`.
- Never log CRM row contents, customer data, full payloads or OAuth secrets — operational metadata only.
- Never expose stack traces or env vars to clients.
- CORS must never be `*`.

### 4.6 Performance
- Monthly board load under ~4s cold target; cached thereafter.
- Measured production: ~17–18s cold, ~0.7s warm.
- Measured local persistent backend: ~11.5s cold, **0.02–0.13s warm**.

---

## 5. Complete Conversation / Decision History

Chronological summary of what shaped the project.

### 5.1 Board-building phase
- Installation Review redesigned; `Site Not Ready Reason` column added.
- Per-card table/column specs produced for the Pre-Design funnel (in chat first, then implemented): each card got its own columns instead of all 22+ cards sharing one of three fixed sets.
- Time-in-status standardised to `1 day + 6h 49m`.
- Sunrooof exclusion applied dashboard-wide.
- "Show Formula" button added. **Correction:** the first version shipped the button with no content; the user objected sharply and it was rebuilt to generate real formulas from config.
- Post-design counting corrected to the Orders blueprint block (`Assign Post - Designer` → `PDI Payment Done`) on user instruction.
- "Last month" + custom month picker added to the universal filter.

### 5.2 Performance programme (Phases 1–8D)
- **Diagnosed:** the DealHistory bottleneck is structural — Zoho caps `per_page` at 200, refuses page 11+ (`DISCRETE_PAGINATION_LIMIT_EXCEEDED`), so 27,997 rows = 140 pages of which 130 are serial `page_token` hops.
- **Bulk Read** (`POST /crm/bulk/v8/read`) proven semantically equivalent: the 1,466-row difference is **100% orphan rows with NULL `Potential_Name`**, which `indexByRecord()` already discards. 2,413/2,413 first-send timestamps identical.
- **Geography proven decisive:** adding `"regions": ["bom1"]` to `vercel.json` took production 53.4s → 17.4s. `[IMPLEMENTED, committed]`
- **Serverless proven unable to share caches:** 6 concurrent requests = 4–6 independent misses.
- **Persistent process proven to coalesce:** 1 user = 6 users = 51 Zoho requests.
- **Corrections made during this phase (important — do not repeat the mistakes):**
  - A `_comment_regions` key broke the Vercel deploy — `vercel.json` has a `$schema` and rejects unknown top-level keys.
  - An audit finding was wrong because a constant's *name* (`ALL_HISTORY = 2020-01-01`) was taken as evidence of its *span*; DealHistory actually only spans 2025-09-24 → 2026-10-01.
  - A 15s bulk timeout caused a **regression** (30.2s vs 21s) because the fallback is sequential; raised to 25s after measuring Zoho serialises bulk jobs at ~3.5s each.
  - `criteria` on a GET against the **history** modules is **accepted and silently ignored** — a dangerous trap. It *does* work on `Contacts/search` (verified: bogus value → 204, real value → only that value).

### 5.3 Hosting investigation — all abandoned
Fly.io → Oracle Cloud → finally **local machine + Tailscale Funnel**. See §22.

### 5.4 Blueprint discovery phase
All 9 CRM Blueprints read (read-only, nothing modified). See §12.4. Key outcomes:
- The active Orders blueprint has **71 states / 402 transitions** and covers the entire business.
- The stage graph is **cyclic** — `Order Booked`, `Revision Required`, `Hold`, `Query to SM` are reachable from nearly every state. Therefore **any logic assuming monotonic stage rank is unsound.**
- The dedicated **"Post Design" blueprint is INACTIVE** and models post-design as **five parallel workstreams**, not a chain.
- `Override_Stage` decides which blueprint governs an order; with "Post Design" inactive, orders with `Override_Stage = true` are governed by **no blueprint**.

### 5.5 Data-correctness audit — the central finding
> **Every Pre Sales / Sales / Pre Design card scoped its period by when the record was *created*, then tested a current stage.** It should count records that *entered the stage* during the period.

Evidence (board vs dated ledger, September 2026):

| Board · Card | Truth | Board showed |
|---|---|---|
| Sales · Principally Closed (S6) | 73 | **0** (and 0 in *every* month) |
| Sales · Handover to design | 22 | **0** |
| Pre Design · Revision requested | 308 entries / 206 orders | **0** |
| Pre Design · Query to SM | 82 | 11 |
| Pre Design · Under design | 29 | 0 |

**User decisions on the fix (authoritative):**
1. *"Re-base, and keep the live queue beside it"* — flow is the headline, stock sits beside it.
2. *"Keep excluding [the `None` orders], but state the count."*

### 5.6 Self-corrections made during implementation (do not undo)
- First implementation counted each order's **first-ever** stage entry → 120 for September. This silently dropped repeat offenders. Changed to **distinct orders with ≥1 entry inside the window** → 180. The repeat offender is exactly the case someone must act on.
- First `sitting` implementation derived the queue from whichever contacts the period happened to load → **312 for August, 297 for September** for the same "right now" question. Replaced with a dedicated query. Now stable at 7 / 336 across all periods.
- The Pre Design popup bug was the *same* defect already fixed on Sales, missed on the first pass. Found by a systematic sweep, not by inspection.
- A reported "120 of 180" popup discrepancy was a **false alarm** — a measurement artifact from clicking before React re-rendered. Clean opens read 180 throughout.

---

## 6. Architecture

### 6.1 Deployed architecture `[IMPLEMENTED]`

```
Browser (React SPA, Vercel static)
        │ HTTPS, same origin
        ▼
Vercel rewrite  /api/(.*) → /api/index
        ▼
api/index.js  →  createApp()  (Express, region bom1 / Mumbai)
        │
   ┌────┴─────────────────────────┐
   │ dashboardCache (HTTP layer)  │  keyed reportingDay:path?query
   │ ReadCache (Zoho read layer)  │  30 min TTL, in-flight coalescing
   └────┬─────────────────────────┘
        ▼
Zoho CRM v8 REST  +  Bulk Read API
```

**Critical property:** `backend/src/server.js` **never runs in production**. Vercel imports `createApp()` from `api/index.js`. Anything that depends on a long-lived process (warm-up, cache sharing, single-flight) is therefore **ineffective on Vercel** — this is the entire motivation for the persistent-backend work.

### 6.2 Proposed persistent architecture `[BLOCKED]`

```
Vercel (React frontend)
        │ HTTPS
        ▼
Tailscale Funnel (*.ts.net)     ← BLOCKED: needs admin UAC to install
        ▼
Local machine — persistent Node process
   L1 cache · single-flight · warm-up
        ▼
Zoho CRM
```

Verified working locally: 10 concurrent cold users → **exactly 1 Bulk Read job** (26,543 rows, 5.0s), 1 miss + 9 shared. Warm: 0.02–0.13s at every concurrency 1→10.

**Architectural conflict found and resolved:** Phase 10 (auth required) + Phase 16 (don't modify the API client) + Phase 17 (cross-origin Vercel→backend) are **mutually exclusive**. `frontend/src/lib/api.js` does a bare `fetch` with no `Authorization` header, and browsers do not show Basic-auth prompts for cross-origin subresource requests — measured: **401**. Resolution: serve the frontend from the Funnel too (`app.js` already serves `frontend/dist`), giving one origin, no CORS, and a native browser prompt. `[PROPOSED]`

### 6.3 Data flow for a dated card

```
Zoho DealHistory ──(Bulk Read, fallback to paged)──► rows
        ▼ indexByRecord()
Map<recordId, { entries: [{stage, stageKey, enteredAt, movedTo, days}] }>
        ▼ datedStageCard()
count   = distinct orders with ≥1 entry into the card's stages inside tf
sitting = orders whose CURRENT stage is one of the card's stages
```

### 6.4 Caches
- **`readCache.js`** — Zoho page cache, 30 min TTL, module-level `Map` with a `pending` map for in-flight coalescing.
- **`dashboardCache.js`** — Express middleware response cache keyed `reportingDay:path?query`, own `pending` map. Only a real HTTP request can populate it (this is why warm-up warms over HTTP).
- **`bulkLedger.js`** — module-level single-flight (`inFlight`) + a short result-sharing window + a circuit breaker (3 failures → 5 min cooldown).

### 6.5 Background processes
- **`warmCache.js`** — fires 3s after boot, then every 25 min (just inside the 30 min TTL). Learns the Stage picklist from the org, performs source reads, then warms 5 endpoints over HTTP. Disabled with `WARM_CACHE=off`. **Ineffective on Vercel** (no long-lived process).

---

## 7. Technology Stack

### Backend
| Item | Version | Notes |
|---|---|---|
| Node.js | v24.18.0 local; Vercel reports 24.x | ESM (`"type": "module"`) |
| Express | ^4.21.2 | |
| cors | ^2.8.5 | |
| dotenv | ^16.4.7 | |
| fflate | ^0.8.3 | In-memory ZIP for Bulk Read. Pure JS. |
| xlsx | ^0.18.5 | Factory stand-up spreadsheets |

**All five dependencies are pure JavaScript — no native bindings.** Verified to run unmodified on ARM64/aarch64.

### Frontend
| Item | Version |
|---|---|
| React / react-dom | ^19.0.0 |
| Vite | ^6.2.0 |
| @vitejs/plugin-react | ^4.4.1 |
| lucide-react | ^0.468.0 |

No router — state-based tab switching. `React.lazy` for board code-splitting.

### Infrastructure
- Vercel (hosting + serverless function, region `bom1`).
- Docker 29.8.1 / Docker Desktop 4.93.0 (local only; image builds, not deployed).
- `node:24-alpine` base image + `dumb-init` for SIGTERM delivery.

### Not used
No database, no ORM, no Redis, no message queue, no test framework beyond Node's built-in `node --test`, no TypeScript, no CSS framework (hand-written CSS).

---

## 8. Project Structure

```
Monitoring_review/
├── api/index.js              Vercel entry → createApp(). The ONLY production entry.
├── backend/
│   ├── Dockerfile            [uncommitted] node:24-alpine, dumb-init, non-root
│   ├── .dockerignore         [uncommitted]
│   └── src/
│       ├── server.js         Local/container entry + graceful shutdown. NOT used on Vercel.
│       ├── app.js            createApp(): cors → basicAuth → caches → routes → static
│       ├── config/
│       │   ├── env.js        All settings in one place
│       │   ├── journey.js    ★ THE STAGE MAP — single source of stage→card meaning
│       │   ├── salesFunnel.js ★ S1–S6 ladder, city buckets, Est. closure helpers
│       │   ├── cardFormula.js ★ Generates "Show Formula" from the same config
│       │   ├── crmNames.js   Canonical stage/designer names; learns stored-vs-label values
│       │   ├── dispatchViews.js, psmTargets.js, roster.js
│       ├── lib/
│       │   ├── cache/{readCache,dashboardCache,reportingDay}.js
│       │   └── {dataStore,fallbacks,http}.js
│       ├── middleware/basicAuth.js
│       ├── routes/{index,sales,presales,factory,operations}.js
│       └── services/         ~30 modules; board builders + Zoho readers
├── frontend/src/
│   ├── app/DashboardApp.jsx  Board switching, lazy loading, popup wiring
│   ├── components/
│   │   ├── PeriodFilter.jsx  Universal period filter (incl. month picker)
│   │   ├── design/{PreDesignFlow,PostDesignFlow,PreEfficiency,PostDesignBoard}.jsx
│   │   ├── sales/{SalesBoard,SalesFilters,SalesPerformance,SalesRecordsPopup,...}.jsx
│   │   ├── presales/, installation/, dispatch/, factory/, ams/, decision/, formula/
│   ├── hooks/useDashboard.js Data fetching hook
│   ├── lib/api.js            API base URL only (VITE_API_URL)
│   └── styles/               ~20 hand-written CSS files
├── docs/architecture/dashboard-system-design.md
├── docs/{pdi-review,post-design}.md
├── DESIGN.md, PRODUCT.md, README.md
└── vercel.json
```

### Most important files
| File | Why |
|---|---|
| `backend/src/config/journey.js` | The one place a Zoho stage is given a meaning. Replaced three disagreeing copies. |
| `backend/src/services/preDesignBoard.js` | Largest board builder (~1000 lines). Holds `datedStageCard`. |
| `backend/src/services/salesFunnelBoard.js` | Sales board; holds the dated S6/Handover cards. |
| `backend/src/services/stageLedger.js` | `getStageLedger`, `indexByRecord`, `ALL_HISTORY` |
| `backend/src/services/bulkLedger.js` | Bulk Read fast path + fallback + breaker + single-flight |
| `backend/src/config/cardFormula.js` | Formula generation — must stay in step with the counting |

---

## 9. Database

**There is no database.** `[IMPLEMENTED — by deliberate, locked decision]`

- Zoho CRM is the only persistent store.
- No SQL, no NoSQL, no Redis, no object storage, no on-disk CRM cache.
- All processing is in Node process memory and is discarded when the request/process ends.
- The Bulk Read ZIP is unzipped in memory and dropped.

### Runtime files written to disk (not CRM data, not committed)
| File | Contents |
|---|---|
| `backend/.data/.zoho_token.json` | Cached OAuth access token |
| `backend/.data/` lead/deal caches | Fallback caches |
| `backend/.data/factory/*.xlsx` | Factory stand-up spreadsheets (local input files) |

All are gitignored and excluded from the Docker image.

### Zoho modules read
| Module | Role |
|---|---|
| `Leads` | Raw leads — Pre Sales |
| `Contacts` | Qualified leads — Sales (`Client_Status` ladder, `Stage` process) |
| `Deals` (API name for Potentials) | Orders — Design, Factory, Dispatch, Installation. 7,726 records. 282 fields. |
| `DealHistory` | Dated order stage ledger. ~28,025 rows. Spans 2025-09-24 → 2026-10-01. |
| `Opportunity_Stage_History` | Dated contact stage ledger |
| `Lead_Status_History` | Dated lead status ledger |
| `Visit_Module` | 10,901 records — installation/AMS visits |
| `AMS_Complaints`, `CustomModule9`, `CustomModule10` | AMS / complaints |

### Known data facts (measured)
- 7,726 orders; **2,575 (33%) at stage `None`**; 0 with a blank stage.
- 67 distinct live `Deals.Stage` values; 97 ever used in history.
- `Client_Status` over 2,119 contacts created since 2026-06-01: **1,308 blank**, 315 Dead, 190 S3, 113 S2, 75 S4, 65 Closed, **42 S1**, 9 S5, 2 S6.
- **`Client_Status` stores different values than it displays** — a real trap:

| Displayed | Stored |
|---|---|
| Principally Closed | `Hot` |
| Design Closed + Price Open | `Warm` |
| Design Open + Price Open | `50` |
| Validated But Design Open | `Cold` |
| Dead | `Drop` |
| Closed | `Won` |

The REST API returns **display** values, so matching on display text works today.

---

## 10. API

All routes are mounted under `/api` by `app.js`. All are `GET`. All return `200` with a shaped payload even on upstream failure (a `notice` field carries the error; the board renders with zeros rather than breaking).

### Common query parameters
| Param | Values |
|---|---|
| `timeframe` | `daily`, `this-week`, `weekly`, `monthly`, `last-month`, `month:YYYY-MM`, `quarterly`, `yearly`, `custom:YYYY-MM-DD:YYYY-MM-DD` |
| `city` | `all`, `DEL`, `HYD`, `OTHER`, or one city name |
| `psm` | Pre Sales only |

### Endpoints
| Path | Purpose |
|---|---|
| `/api/health` | `{status, source}`. **Exempt from auth** (host health check). Never touches Zoho. |
| `/api/zoho/lead-fields` | Lead field metadata. Returns 502 on failure. |
| `/api/dashboard` | Pre Sales board |
| `/api/sales-funnel` | Sales board — `leadGeneration`, `salesPerformance`, `weeks`, `buckets`, `records` |
| `/api/sales-efficiency` | Efficiency margin section |
| `/api/pre-design-funnel` | Pre Design — `preDesign`, `preEfficiency`, `records` |
| `/api/post-design-funnel` | Post Design — `postDesign.cards`, `model`, `records` |
| `/api/installation-board`, `/api/dispatch-board`, `/api/factory-standup`, `/api/ams-dashboard`, `/api/pdi-dashboard`, `/api/decision-queue` | Respective boards |
| `/api/design-dashboard`, `/api/sales-dashboard`, `/api/post-design-dashboard`, `/api/installation-dashboard`, `/api/dispatch-dashboard`, `/api/factory-dashboard`, `/api/lead-reassignments` | Additional/legacy board endpoints `[UNKNOWN — not individually audited this session]` |

### Response invariants (enforced, test these after changes)
1. `card.count === card.ids.length`
2. **Every id a card quotes must resolve against the board's `records` array.** (Broken twice this session; both fixed.)
3. `card.byCity` counts sum to `card.count`.
4. Post-design sub-card `sitting` values sum to the parent card's `sitting`.
5. Card `count` never negative; no `NaN`/`Infinity`/`"undefined"` anywhere in any payload.

**A verification script that checks all five across 4 boards × 7 timeframes exists as a pattern in the session history and currently reports 0 issues.** Re-create and run it after any card-logic change.

### Response cache
Only these paths are in the middleware's cache set (others do the work and throw it away): `/pre-design-funnel`, `/sales-efficiency`, `/sales-funnel`, `/ams-dashboard`, `/dashboard`.

---

## 11. UI / UX

### Boards (sidebar order)
Pre Sales Review · Sales Review · Design Dashboard (Pre/Post sub-tabs) · Measurements · Factory & Standup · Dispatch Review · Installation Review · AMS Review · Decision Queue.

### Sales board sub-tabs
Lead generation (default) · Sales performance · Weekly view · Efficiency margin.

### Filter bars — **two different implementations, a known inconsistency**
1. `components/PeriodFilter.jsx` — the universal one. Buttons: Daily / Weekly / Monthly / **Last month** / Quarterly, plus a 24-month `<select>` and a Custom popover.
2. `components/sales/SalesFilters.jsx` — the Sales board's **own** bar: Yesterday / This week / This month / **Last month** / This quarter / This year + month `<select>`. It sends the same `last-month` and `month:YYYY-MM` values so the two cannot drift.

The Design board also renders its own period controls (`DesignDashboard.jsx` / `PdiDashboard.jsx`).

### Card anatomy
```
LABEL
<count>  orders            ← flow: entered this stage during the period
<N> here now               ← stock: sitting here right now (quieter styling)
₹<value>                   ← only where money is real (Order booked)
<delta> vs <previous>
BY CITY  [DEL] [HYD] [OTH]
```

### Records popup (`SalesRecordsPopup.jsx`)
- Opens on **Pie chart** view by default; List is a toggle.
- Per-card column sets (`TABLES.*`, `PRE_COLUMNS`, post-design column maps).
- Filters: SM, designer, stage, city, revisions band, product, salesperson, value band — each dropdown counts over what the *other* filters leave.
- Paged list: 25 rows + "Show 25 more of N".
- Record links open the record in Zoho CRM.

### Two columns that are frequently confused
| Column | Clock starts | Answers |
|---|---|---|
| **Time in status** | When the order entered the stage it is on **now** (resets on every move) | "How long has this been stuck?" |
| **Requested on** | At the event the column is named after (`createdAt` on Requests; `revisionAskedOn` on Revision requested). Shows the date **plus** its age. | "When did this come in?" |

Both render `Not recorded` rather than `0` when the ledger has no history.

### Red thresholds (per card, in hours)
```
requests     24h   (unclaimed for a day)
underDesign  48h   (no movement for two days)
```
A card with no agreed limit shows the figure plainly — **never invent a threshold.**

### Elapsed-time format
`1 day + 6h 49m`. Days separated by `+` because `1d 6h` reads as one quantity while the day count is what decides lateness. Below a day, days are dropped; below an hour, only minutes.

### Visual language
Hand-written CSS, CSS custom properties (`--accent`, `--ink-2`, `--line`, `--muted`, `--surface`), `lucide-react` icons, tabular-nums for figures, tone classes (`tone-teal`, `tone-blue`, …).

---

## 12. Business Logic

### 12.1 The core counting rule `[IMPLEMENTED on Pre Design + Sales S6/Handover]`
> **A card counts the DISTINCT records that ENTERED one of its stages during the selected period, counted once however many times they entered — plus the live queue sitting there now.**

Rationale for "distinct, ≥1 entry in window" over the two alternatives:
- Counting **every entry** inflates: September had 308 entries into a revision stage but only **206 orders**.
- Counting the **first-ever entry only** deflates to 142 and drops exactly the repeat offenders who need action.

### 12.2 Card sources
| Card type | Source |
|---|---|
| Pre Design — all except Requests / Revision done | `DealHistory` via `datedStageCard` |
| Pre Design — Total new requests | Orders **created** in the period (creation IS the event here — correct as-is) |
| Pre Design — Revision done | Derived: carries a revision count and is no longer on a revision stage. Zoho records no "revision done" value. |
| Sales — S1..S5 | `Client_Status` **snapshot** — cannot be dated |
| Sales — S6, Handover | `Opportunity_Stage_History` (dated) + a dedicated queue query |
| Sales — Order Booked | `Actual_Closure_Date` — already a real date; **deliberately left alone** |
| Post Design | `DealHistory`; headline = queue, `entered` = flow (opposite emphasis to Pre Design) |

### 12.3 Exclusions applied everywhere
`isRealDeal` / `isRealRecord`: name must not contain "test"; `Product_Type`/`Product_Requirement` must not match `/sun\s*ro+f/i`.

### 12.4 Blueprint reference (read-only, verified 1–2 Oct 2026)

**9 blueprints; 6 active. 8 readable — the Contacts one returns `INTERNAL_ERROR` on 4 consecutive attempts (a Zoho-side fault, not permissions).**

| Module | Blueprint | Status | States | Entry criteria |
|---|---|---|---|---|
| Leads | Lead nurturing process | Active | 9 / 54 edges | — |
| Potentials | **Order Stages** | **Active** | **71 / 402** | `Override_Stage = false` |
| Contacts | Opportunity Stage | Active | `[UNKNOWN]` | — |
| CustomModule9 | Installation Visit Flow | Active | 2 / 1 | `Record_Type = Installation` |
| CustomModule10 | Complaint Flow - Installation | Active | 14 / 42 | `Record_Type = Complaint AND Complaint_From = Installation Team` |
| CustomModule10 | AMS/Complaint Flow | Active | 14 / 41 | — |
| Tasks | Task Process Management | Inactive | 5 | `Priority = Highest` |
| Potentials | **Post Design** | **Inactive** | 7 / 30 | `Stage = "Assign Post - Designer" AND Override_Stage = true` |
| Potentials | Booking Post-Process | Inactive | 23 / 22 | `Post_Booking_Process = true` |

**Order Stages spine (the whole business in one blueprint):**
```
None → Form Filled → Designer Assigned → Sent for Approval → Price Discussion
  → Pending AVP Approval → Payment Awaited → Order Booked
  → Handover to Post Design → Assign Post - Designer → Request for Site Visit
  → Align First Measurement → First Measurement Done → First Measurement Approved
  → Design Approval → Design Approved After First Meaurement
  → Prep. E&P Drawings → Request for E&P Marking → E/P Marking Aligned → E/P Marking Done
  → Mood Board Request → Mood Board Approved → Prep. of 3D → 3D Approved
  → Prep. of Sign-off & Production Drawing → Sent for Design Approval
  → Handover to Factory → Create MPP → Material Procurement
  → Request E/P Checking → Align E/P Visit → E/P Checking Done
  → Request Visit for PDI → Align PDI → PDI Done → Prepare PDI
  → Send PDI Drawings to Factory → Create Production Set → Start Production
  → Sent for PDI payment Approval → PDI Payment Done
  → Site Approved for Dispatch → (First Dispatch | Full Dispatch | Split Dispatch)
  → Start First Installation → Wall cladding → First Installation Done
  → Sent for 2nd Dispatch Approval → 2nd Dispatch Approved → 2nd Dispatch Done
  → Start Second Installation → Second Installation Done → Final Handover
```

**Four universal escape hatches** present on nearly every state: `Hold`, `Order Booked`, `Revision Required`, `Query to SM`. Counts built from history **must account for records bouncing through these**.

**"Post Design" (inactive) models post-design as five interconnected parallel tracks**, not a chain:
`Assign Post - Designer → { EPT | First Measurement | Mood Board/3D | Production Drawing | PDI }`

**CRM spelling errors that must be matched verbatim:** `Modd Board`, `First Dipatch Done`, `Design Approved After First Meaurement`, `PDI Verifiction`, `Precourement`, `Qualified/ Drawings Awiated`, `Est_Closoure_Date`.

### 12.5 Payment stage assignment (blueprint-settled)
- `Payment Awaited` → **pre-design "Order booked"** (blueprint: `Payment Awaited → Order Booked`, i.e. pre-booking).
- `Payment Approvals` → **post-design "Payment pending"** (blueprint: `PD Approvals → Payment Approvals → Handover to Factory`).
- Previously both were on both cards, double-counting 11 orders across two boards. `[FIXED]`

---

## 13. Workflows

### 13.1 Request lifecycle
```
GET /api/<board>?timeframe=&city=
  → dashboardCache middleware: hit? return. pending? await. else:
  → route handler: Promise.all of Zoho reads (each .catch()'d independently)
  → ReadCache: hit / coalesce / fetch
  → board builder: filter → date → bucket → cityCard → attach formulas
  → JSON response, cached
```
**Rule:** every optional read is individually `.catch()`'d. Losing one read costs the cards built from it, never the board.

### 13.2 Zoho auth
Refresh-token → access-token exchange, token cached on disk (`.data/.zoho_token.json`) and in memory. No interactive OAuth.

### 13.3 Bulk Read
```
POST /crm/bulk/v8/read {module: DealHistory, fields: [...]}
  → poll every 1s (ceiling 25s, env ZOHO_BULK_TIMEOUT_MS)
  → download ZIP → fflate unzipSync in memory → parse CSV → discard
Fallback on DEFINITE failure only (HTTP error, network, malformed ZIP,
missing column, implausibly small result < 1,000 rows).
Circuit breaker: 3 failures → 5 min cooldown → straight to paged walk.
```
**Do not shorten the 25s ceiling.** Measured: Zoho serialises bulk jobs at ~3.5s each; a 15s ceiling fired on jobs that were about to succeed and, because the fallback is sequential, produced a **30.2s run against a 21s baseline**.

### 13.4 Warm-up cycle
```
boot + 3s, then every 25 min:
  learnStages() → source reads (orders, window ledger, full ledger via Bulk,
                  pre-design orders, complaints)
  → warmEndpoints(): 5 real HTTP requests through this server's own stack
     (sends Basic auth header when sign-in is configured)
```
Measured: source reads 9.9–15.7s, endpoint warm 6.6–7.6s, first real user afterwards **0.04s**.

### 13.5 Graceful shutdown
`SIGTERM`/`SIGINT` → stop warm-up timer → `server.close()` → drain in-flight requests → exit 0. 25s backstop (`SHUTDOWN_GRACE_MS`). Verified on ARM64 container: exit 0 in 1s.

---

## 14. Integrations

### Zoho CRM `[IMPLEMENTED]`
| | |
|---|---|
| API | Zoho CRM v8 REST, `https://www.zohoapis.in` |
| Accounts | `https://accounts.zoho.in` |
| Auth | OAuth2 refresh-token grant |
| Scopes held | `ZohoCRM.modules.ALL`, `settings.ALL`, `users.ALL`, `org.ALL`, `bulk.ALL`, `notifications.ALL`, `ZohoBooks.fullaccess.all`, `ZohoInventory.FullAccess.all` |
| **Scope NOT held** | **COQL** — this is why boards page instead of querying |
| Data exchanged | Read-only. The dashboard **never writes to Zoho.** |

**Hard API limits (measured, not documented guesses):**
- `per_page` capped at 200.
- Page 11+ rejected: `DISCRETE_PAGINATION_LIMIT_EXCEEDED`.
- Beyond 2,000 records only an opaque `next_page_token`, walked serially.
- `ids` parameter accepts up to 100 ids per call.
- `criteria` **works** on `Contacts/search` (verified empirically) but is **accepted and silently ignored** on the history modules.

### Zoho MCP server `[IMPLEMENTED — assistant tooling only]`
A connected MCP server reaches the same org and **has COQL**. Useful for an AI assistant to explore and verify. **It is not a runtime dependency** — the dashboard cannot call it. Other MCP servers (`claude-flow`, `flow-nexus`, `ruv-swarm`, GitHub) were failing to connect during the session.

### Vercel `[IMPLEMENTED]`
Git-push deploys. `regions: ["bom1"]`. `maxDuration: 60`.

### Tailscale `[BLOCKED]`
Not installed. Would provide a public HTTPS `*.ts.net` URL for a locally hosted backend.

---

## 15. Configuration

### Backend environment (`backend/.env`, gitignored)
| Variable | Purpose | Required |
|---|---|---|
| `ZOHO_CLIENT_ID` | `<SECRET>` | Yes |
| `ZOHO_CLIENT_SECRET` | `<SECRET>` | Yes |
| `ZOHO_REFRESH_TOKEN` | `<SECRET>` | Yes |
| `ZOHO_ACCOUNTS_URL` | e.g. `https://accounts.zoho.in` | Yes |
| `ZOHO_API_DOMAIN` | e.g. `https://www.zohoapis.in` | Yes |
| `ZOHO_ORG_ID` | Org id | No |
| `ZOHO_LEADS_MODULE` | Default `Leads` | No |
| `ZOHO_DASHBOARD_TIMEZONE` | Default `Asia/Kolkata` | No |
| `PORT` | Default `4010`; `8080` used locally/container | No |
| `HOST` | Default `127.0.0.1` dev, `0.0.0.0` production | No |
| `CORS_ORIGIN` | Comma-separated. **Never `*`.** | No |
| `DASHBOARD_USER` / `DASHBOARD_PASSWORD` | HTTP Basic sign-in. Both must be set to enable. **Currently commented out** (user asked for no login locally). | No |
| `WARM_CACHE` | `off` disables warm-up | No |
| `ZOHO_BULK_TIMEOUT_MS` | Default `25000` | No |
| `SHUTDOWN_GRACE_MS` | Default `25000` | No |
| `DATA_DIR` | Default `.data`, `/tmp/psm-morning-review` on Vercel | No |
| `FACTORY_PLANNING_FILE` / `FACTORY_DISPATCH_FILE` / `FACTORY_CHI_FILE` | Spreadsheet paths | No |

### Frontend
| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Empty (default) = same origin. Set only when the API is hosted elsewhere. **No trailing `/api`.** |

### Gitignored
`.env`, `.env.*` (except `.env.example`), `backend/.data/`, `*.xlsx`, legacy runtime JSON caches, `node_modules/`, `dist/`, `.claude/settings.local.json`.

---

## 16. Authentication & Authorization

- **Mechanism:** HTTP Basic (`middleware/basicAuth.js`), optional. Enabled only when both `DASHBOARD_USER` and `DASHBOARD_PASSWORD` are set.
- **Comparison:** `crypto.timingSafeEqual` with a length check.
- **Scope:** protects the whole app — API *and* the SPA shell.
- **Exemption:** `/api/health` always passes (host health checks).
- **Ordering (fixed this session):** CORS runs **before** auth, because a browser's preflight `OPTIONS` carries no credentials; behind the auth check it 401'd and the real request was never sent.
- **Current state:** `[IMPLEMENTED but DISABLED]` — the user asked to remove the login for local use. The credentials remain in `.env`, commented out.
- **No roles, no permissions, no user accounts, no sessions, no JWT.** It is one shared credential.

**Security note that must not be lost:** Basic auth is required before any public exposure (Tailscale Funnel is public internet). With it off, anyone with the URL reads live CRM data.

---

## 17. Dependencies

| Dependency | Version | Where | Notes |
|---|---|---|---|
| express | ^4.21.2 | `app.js`, all routes | |
| cors | ^2.8.5 | `app.js` | Must run before basicAuth |
| dotenv | ^16.4.7 | `config/env.js` | |
| fflate | ^0.8.3 | `bulkLedger.js` | `unzipSync` in memory. Pure JS → ARM-safe. |
| xlsx | ^0.18.5 | `factoryMapper.js` | Local spreadsheets |
| react / react-dom | ^19.0.0 | frontend | |
| vite | ^6.2.0 | build | |
| @vitejs/plugin-react | ^4.4.1 | build | |
| lucide-react | ^0.468.0 | icons | |

No dev dependencies. No test framework — Node's built-in `node --test`.

---

## 18. Deployment & Infrastructure

### Current production `[IMPLEMENTED]`
- **Vercel**, static frontend + one serverless function.
- `api/index.js` → `createApp()`. `backend/src/server.js` is **not** executed.
- Region `bom1` (Mumbai) — the single biggest performance win (53.4s → 17.4s).
- `maxDuration: 60`, `includeFiles: "backend/src/**"`.
- Deploys on git push.
- Measured: ~17–18s cold, ~0.7s warm.
- **Limitation:** no long-lived process, so warm-up, cache sharing and single-flight do not work.

### Built but not deployed `[IMPLEMENTED, unused]`
- `backend/Dockerfile`: `node:24-alpine`, `dumb-init` as PID 1, `npm ci --omit=dev`, source only, `USER node`, `HEALTHCHECK` against `/api/health`, `EXPOSE 8080`.
- **ARM64 verified:** builds (281 MB), runs `aarch64`, Node v24.21.0 arm64, fflate + bulkLedger load, container reports healthy, SIGTERM → exit 0.
- **Peak RSS with the entire working set resident: 101 MB** (baseline 63 MB).

### Blocked plan `[BLOCKED]`
Local machine (LENOVO 83JC, Windows 11 Home SL 10.0.26200, 23.7 GB RAM, Ryzen 7 7435HS 8C/16T) + Tailscale Funnel.
- **Blocker:** Tailscale MSI needs an admin UAC prompt. `winget install --id Tailscale.Tailscale` → installer exit **1602**.
- **Also required (not changed — reporting only, per instruction):** the machine sleeps after **5 minutes idle on AC** (`STANDBYIDLE` = `0x12c`). Needs `powercfg /change standby-timeout-ac 0` and a lid-close action change, both as Administrator.
- Nothing yet restarts Node or Funnel after a Windows reboot.

### Rollback
The Vercel Lambda remains the rollback path. `api/index.js` and `vercel.json` must not be removed.

---

## 19. Testing

- **Automated:** 10 tests, all passing. `backend/src/services/pdiReview.test.js`, `postDesignBoard.test.js`, `backend/src/lib/cache/cache.test.js`. Run with `node --test src/services/*.test.js`. **There is no `npm test` script** — adding one would be an improvement.
- **No frontend tests. No E2E tests. No CI.**
- **Manual/scripted validation used this session (recommended to re-create):**
  1. Status sweep — 5 boards × 10 timeframes × 4 cities.
  2. Payload sanity — recursive hunt for `NaN`/`Infinity`/`"undefined"`/`Invalid Date`.
  3. Consistency sweep — the five invariants in §10.
  4. Ledger reconciliation — board numbers decomposed against raw ledger counts.
  5. Browser checks — console errors, popup row counts, layout at width.
- **Untested areas:** all frontend components; the legacy `*-dashboard` endpoints; Factory/Dispatch/Installation/AMS/Decision Queue board logic (not audited this session).

---

## 20. Known Bugs & Issues

| # | Issue | Status | Severity | Root cause | Fix / workaround |
|---|---|---|---|---|---|
| 1 | S1–S5 under-report for past periods | `[BLOCKED]` | High | `Client_Status` is tracked by **no** Zoho history module | Not fixable in code. Needs field tracking enabled in Zoho, or re-basing the ladder onto `Contacts.Stage`. |
| 2 | "EP prep · Planned" is permanently 0 | `[IMPLEMENTED — documented, not fixed]` | Low | Its only value `EPT` appears 0 times in 28,025 history rows; it belongs to the **inactive** Post Design blueprint | Documented in `journey.js`. Will work by itself if that blueprint is activated. |
| 3 | 2,575 orders at stage `None` on no card | `[IMPLEMENTED — by decision]` | Medium | `None` is Zoho's empty stage *and* the blueprint's entry state | User decided: keep excluding, state the count. Now published as `unstagedThisPeriod` / `unstagedModule`. |
| 4 | 1 order at `Site follow up done` on no board | `[PENDING]` | Trivial | Blueprint state with no card | Unfixed. |
| 5 | Contacts "Opportunity Stage" blueprint detail returns `INTERNAL_ERROR` | `[BLOCKED]` | Low | Zoho-side fault — the list endpoint returns it fine, the other 8 details load | Use `Opportunity_Stage_History` observed transitions instead. |
| 6 | S6 reads `Contacts.Stage` while S1–S5 read `Client_Status` | `[IMPLEMENTED — needs a decision]` | Medium | Only `Contacts.Stage` is tracked | A contact can be S2 by `Client_Status` and Principally Closed by `Stage`. See §21. |
| 7 | Stage graph is cyclic; `STAGE_RANKS`-style monotonic logic is unsound | `[PENDING]` | Medium | Blueprint allows `Order Booked` / `Revision Required` from ~every state | Not yet remediated wherever rank logic survives. |
| 8 | Pre Design funnel no longer partitions | `[IMPLEMENTED — by design]` | Low | Requests is creation-dated; all other cards are event-dated over the whole module | Metadata corrected to say so; `share` removed from dated cards (frontend null-guards it). |
| 9 | Vercel cannot share caches or warm up | `[BLOCKED]` | High (perf) | Serverless has no long-lived process | Persistent backend — blocked on Tailscale. |

### Fixed this session
- Popup showed fewer rows than the card counted — **on both Sales and Pre Design** (card ids pointed at records the payload didn't carry).
- Formula panel printed a `Created Time` filter on three cards that aren't creation-scoped.
- `sitting` changed with the selected period (312 vs 297 for the same "right now" question).
- Warm-up silently 401'd under auth and reported a cheerful `0.0s`.
- Warm-up pre-fetched the full ledger via the 140-page paged walk while the route read it via Bulk (21.2s → 15.7s).
- CORS preflight rejected by auth.
- S1 absorbed 1,308 blank statuses (reported 1,350 when the answer was 42).

---

## 21. Decisions & Constraints

### Locked — do not reverse

| Decision | Status | Reason | Alternatives rejected |
|---|---|---|---|
| **Zoho CRM is the only persistent store. No database of any kind.** | Locked | Repeatedly restated by the user; CRM data is private | Redis, Upstash, Vercel KV/Blob, Postgres, MySQL, MongoDB, Supabase, S3, Firestore — all explicitly forbidden |
| **Card names, keys and layout are frozen** | Locked | Users know the board; this work changes *what feeds* a card, never what it is called | Renaming to clarify semantics |
| **Flow leads, stock sits beside it** (Pre Design, Sales S6/Handover) | Locked (user chose) | Flow is comparable across boards and responds to the period buttons | Stock-only (the old behaviour); flow-only |
| **`None` orders stay off every card, with the count published** | Locked (user chose) | An order with no stage set has not reached a step | Counting them under "Designer assignment pending"; silent exclusion |
| **Count distinct orders entering during the window, once each** | Locked | 308 entries vs 206 orders vs 142 first-entries — only the middle answers the business question | Every-entry (inflates); first-entry-only (drops repeat offenders) |
| **`Order Booked` stays dated by `Actual_Closure_Date`** | Locked | Already a real date; a different and valid definition from stage entry (30 vs 54 for Sept) | Re-basing it onto the stage ledger |
| **25s Bulk Read ceiling** | Locked | A 15s ceiling caused a measured regression (30.2s vs 21s) | Shorter timeouts |
| **`regions: ["bom1"]` in vercel.json** | Locked, committed | 53.4s → 17.4s | Default US region |
| **No `Co-Authored-By` trailer on commits** | Locked | `.claude/settings.json` has no `attribution.commit` | — |
| **Never `git add .`** | Locked | User instruction | — |
| **Blueprints are read-only** | Locked | User instruction: read and learn, never modify. Post Design must **remain Inactive**. | Activating Post Design |

### Open decision needing the user
**#6 — S6 now reads `Contacts.Stage` while S1–S5 read `Client_Status`.** A contact can legitimately appear as "Only Validated / S2" in the popup's Current-stage column while sitting on the Principally Closed card. Options: (a) keep it — S6 accurate, mildly inconsistent with the rungs below *(recommended)*; (b) revert S6 to snapshot and accept 0 every month.

---

## 22. Rejected Ideas

| Idea | What it would have done | Why rejected | Reconsider? |
|---|---|---|---|
| **Fly.io hosting** | Persistent backend | Abandoned by the user mid-investigation. Never committed — no `fly.toml` was ever written. `flyctl` sits unauthenticated at `~/.fly/`. | No |
| **Oracle Cloud Always Free** | Free ARM VM in Mumbai | Abandoned. Blocked on an unverifiable tenancy + immutable home region; A1 capacity is chronically exhausted. | No |
| **Render / Koyeb** | Managed hosting | Explicitly forbidden | No |
| **Redis / Upstash / any database / Vercel KV / Vercel Blob / S3 / Firestore / Supabase** | Shared cache or persistence | Violates the "Zoho is the only persistent store" constraint | **No — never propose these** |
| **Paid infrastructure of any kind** | — | Explicit: zero cost | No |
| **Vercel frontend + cross-origin backend with Basic auth** | Keep Vercel frontend, auth the Funnel backend | **Technically impossible** — browsers don't prompt for Basic auth on cross-origin subresource requests; measured 401 | Only with an API-client change (currently forbidden) |
| **S1 absorbing blank statuses** | Simpler ladder | Made S1 read 1,350 when the answer was 42 | No |
| **Counting first-ever stage entry only** | Avoid double counting | Dropped repeat offenders — exactly the records needing action | No |
| **Deriving `sitting` from the period's loaded records** | Cheaper than a second query | Gave two answers to the same "right now" question | No |
| **"Ever reached this stage" membership rule** | Flow measurement via membership | Made popups read wrong: "Designer assigned" opened 297 orders of which 231 sat at Sent for Approval | Superseded by the dated rule |

---

## 23. Coding & Development Conventions

### Observed in the codebase (follow these)
- **Comments explain *why*, with measured numbers.** The codebase documents the data that justified a decision ("MEASURED: 308 entries, 206 orders, 142 first-entries"). Match this density — it is the house style and the reason the code is maintainable.
- Comments record what a thing **used to do and why it changed**, especially where a naïve reading would reverse the fix.
- One source of truth per concept; `journey.js` exists specifically because three files once disagreed.
- ESM everywhere, named exports.
- Files under 500 lines (CLAUDE.md rule; `preDesignBoard.js` now exceeds it at ~1000 — **a known violation**).
- Dynamic `import()` inside background work so one module's failure cannot stop boot.
- Every optional read individually `.catch()`'d with a logged reason and a safe fallback.
- Errors to the client are generic; detail is logged server-side only.

### Git
- **Conventional commits**: `feat(scope):`, `fix(scope):`, `perf(scope):`, `refactor(scope):`, `docs(scope):`.
- Separate commits per logical change — the user has asked for this explicitly and more than once.
- Stage files explicitly.
- Target repo: `https://github.com/Magppie1234/PSM_Morning_review1234.git`, branch `main`. Git user `Vaibhav20k`.

### Naming
- Backend: camelCase files for services, `camelCase` exports, SCREAMING_SNAKE for config tables.
- Frontend: PascalCase components, kebab-case CSS files, `lf-*` / `sf-*` / `sp-*` / `pd-*` / `srp-*` class prefixes by area.

---

## 24. AI Continuation Instructions

### Current objective
Make every card's number correct and reconcilable across boards **without renaming, adding or deleting any card.**

### State at handover
Pre Sales, Sales, Pre Design and Post Design audited. Pre Design and the two dateable Sales cards re-based onto dated ledgers. All consistency invariants pass. **Everything is uncommitted.**

### Immediate next task
**Commit and push the working tree** as separate conventional commits, staging explicitly. Suggested split:
1. `fix(sales): map S1-S6 to the six named Current Status values`
2. `fix(sales): date Principally Closed and Handover from the stage ledger`
3. `feat(sales): add Last month and a month picker to the Sales filter bar`
4. `fix(design): count pre-design cards by stage entry, not creation date`
5. `fix(journey): stop counting Payment Awaited and Payment Approvals twice`
6. `fix(popup): make every card id resolve against the records payload`
7. `fix(formula): stop claiming a Created Time filter on dated cards`
8. `perf(zoho): fetch Deal history through Bulk Read` (re-land `bulkLedger.js`)
9. `feat(ops): containerise the API and shut down gracefully`
10. `feat(filters): add Last month and a month picker to the universal filter`

### Files to inspect first
1. `backend/src/config/journey.js` — the stage map; read before touching any card.
2. `backend/src/services/preDesignBoard.js` — `datedStageCard`, the pattern to copy.
3. `backend/src/services/salesFunnelBoard.js` — `datedCard`, `sittingIn`, `datedRecords`.
4. `backend/src/config/salesFunnel.js` — the S1–S6 ladder and `UNSET_STAGE`.
5. `backend/src/config/cardFormula.js` — must stay in step with the counting.
6. `frontend/src/components/sales/SalesRecordsPopup.jsx` — how ids become rows.

### Must not change
Everything in §21 "Locked". In particular: no database, no card renames, Post Design blueprint stays Inactive, no `git add .`, no `Co-Authored-By`.

### Must not reintroduce
Everything in §22 — especially Redis/KV/any database, Fly/Oracle/Render/Koyeb, and S1 absorbing blanks.

### Validation required before claiming any card fix works
1. `node --check` the changed files; restart the backend.
2. Re-run the consistency sweep (the five invariants in §10) across ≥4 timeframes.
3. **Decompose against the raw ledger** — events → distinct records → after exclusions — and show the board reproduces it. Do not assert a number is right because it "looks better".
4. Check the browser: console errors, popup row count vs card count, layout.
5. Run `node --test src/services/*.test.js`.

### Known risks
- `preDesignBoard.js` is ~1000 lines, over the project's own limit.
- Changing a stage list in `journey.js` silently changes several boards at once.
- The frontend is built into `frontend/dist`, which the backend serves locally — **rebuild after any frontend change** or you will test stale code.
- Clicking a card in a scripted browser session before React re-renders produces false discrepancies (this happened; see §5.6).

### How to reason about future changes
Ask *which clock a number is on*: the record's creation, the event's date, or "right now". Most historical bugs in this project are a card silently mixing two of them.

---

## 25. Current Task / Active Work

**Task:** A debug sweep across Pre Sales, Sales and Design, fixing any bug found — including ones introduced during this session's remediation.

**Why:** The date-axis re-base touched every card on two boards; the user asked for a verification pass.

**Progress: complete.**

Completed steps:
1. Status sweep — 5 boards × 10 timeframes, 4 city filters → all 200, no `NaN`/`undefined`.
2. Consistency sweep → **found 18 broken cards on Pre Design** (card ids not resolving against `records`), the same defect already fixed on Sales.
3. Fixed by collecting dated-card records (including Sent for approval) into the payload.
4. Re-ran the sweep → **0 issues** across 4 boards × 7 timeframes.
5. Browser verification → no console errors; popup reads 180 everywhere; 25 rows + "Show 25 more of 155".
6. Tests → 10/10 pass.

Remaining: none for this task. **Blocker for the project: nothing is committed.**

---

## 26. Pending Work

### Completed
- Blueprint read of all 9 CRM blueprints (read-only).
- Data-correctness audit of Pre Sales, Sales, Pre Design, Post Design.
- Pre Design re-based onto the dated ledger with flow + stock.
- Sales S1–S6 corrected to the six named statuses.
- Sales S6 + Handover dated from `Opportunity_Stage_History`, with a period-independent queue.
- "Last month" + month picker on the Sales filter bar.
- Payment stage double-count removed.
- Popup id-resolution fixed on Sales **and** Pre Design.
- Formula panel corrected for dated cards.
- Warm-up auth + bulk-path fixes; CORS/auth ordering.
- Docker image + graceful shutdown; ARM64 verified.
- Bulk Read fast path with fallback, breaker and single-flight.
- Debug sweep; all invariants pass; tests pass.

### In Progress
- Nothing actively in flight.

### Pending
1. **Commit and push everything** (see §24).
2. Verify the month picker on **Measurements, Factory, Dispatch, Decision Queue**.
3. Resolve open decision #6 (S6 field inconsistency).
4. Audit the boards not yet examined: Installation, Dispatch, Factory, AMS, Measurements, Decision Queue.
5. Remediate any surviving monotonic stage-rank logic (the graph is cyclic).
6. Place the one `Site follow up done` order.
7. Split `preDesignBoard.js` under 500 lines.
8. Add an `npm test` script.

### Future
- Designer MIS board (own sidebar entry) — long-standing, unstarted.
- Formula content for the 6 boards that lack it (Dispatch, Installation, Measurements, Factory, AMS, Decision Queue).
- Add the COQL scope to the OAuth app — would collapse several multi-second reads into single queries.
- Phase 4 of the original plan: join the boards at the two handoffs (Leads→Contacts, Contacts→Deals) so they visibly reconcile.
- Phase 6: retire `Client_Status` S1–S6 inference, `STAGE_RANKS`, the empty `*_open/_received/_done` Deals fields, the `enteredDesign` heuristic.

### Blocked
- Persistent backend / Tailscale Funnel — needs one admin UAC prompt.
- Sleep + auto-restart configuration — needs Administrator.
- S1–S5 dating — needs Zoho field tracking on `Client_Status`.
- Contacts blueprint detail — Zoho-side `INTERNAL_ERROR`.

---

## 27. Known Assumptions

| Assumption | Why | Verified? | If wrong |
|---|---|---|---|
| `Modified_Time` on tracker rows = when the record **entered** the stage | The whole dated architecture rests on it | **Yes** — verified against live records; the `Moved_To__s = null` row matches `Deals.Stage` exactly | Every dated card would be wrong |
| The REST API returns **display** values for `Client_Status`, not stored values (`Hot`, `Warm`, `50`, `Cold`) | Observed in live distributions | **Yes**, empirically | All six rungs would stop matching |
| Bulk Read is semantically equivalent to the paged walk | Reconciled before adoption | **Yes** — the 1,466-row delta is 100% orphan rows already discarded | Counts would silently drift |
| `isRealDeal`/`isRealRecord` exclusions explain small gaps between board figures and raw ledger counts | Consistently reproduced | **Yes** — decomposition matched exactly | Numbers would be unexplained |
| Records beyond the ledger's earliest row have no history | Ledger spans 2025-09-24 → 2026-10-01 | Partially — the span is verified; handling of pre-span records is **not** systematically audited | Old orders could be silently dropped |
| The month picker exists on boards using the shared `PeriodFilter` | Those import it | Only partially — 4 boards unverified | Missing filters on those boards |

---

## 28. Known Limitations

- **No long-lived process in production.** Warm-up, cache sharing and single-flight are inert on Vercel.
- **No COQL scope.** All filtering is client-side after paging.
- **Zoho paging ceiling.** Large modules require serial `page_token` walks.
- **`Client_Status` is untracked**, so S1–S5 can never be period-accurate.
- **Cyclic stage graph** invalidates any "furthest stage reached" ranking.
- **No tests on the frontend or on 6 of 9 boards.**
- **No CI, no monitoring, no alerting, no backups** (nothing to back up — Zoho is the store).
- **Single shared credential**; no roles or per-user access.
- `preDesignBoard.js` exceeds the project's own 500-line limit.
- The Sales board and the Design board each maintain **their own** period filter bar, duplicating the universal one.

---

## 29. Security Considerations

- **Secrets** live only in `backend/.env` (gitignored) and the Vercel project environment. Never in the image, the repo, the frontend bundle, or logs. `.dockerignore` excludes `.env*`, tokens and CRM-derived caches.
- **The frontend must never receive** `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN`, `ZOHO_ACCOUNTS_URL`, `ZOHO_API_DOMAIN`.
- **CORS** is an explicit allow-list; `*` is forbidden. Verified: an allowed origin is echoed, an unrelated origin is not.
- **Auth is currently OFF** at the user's request. **This must be re-enabled before any public exposure** — Tailscale Funnel is public internet, and the API serves live customer data.
- `/api/health` is deliberately unauthenticated; it exposes only `{status, source}` and never touches Zoho.
- **Error responses are generic.** Stack traces, file paths and env values never reach the client.
- **Logging discipline:** operational metadata only. Never CRM rows, customer data, whole CSVs, full payloads or OAuth secrets. The generated dashboard password was deliberately never printed to a transcript.
- The container runs as non-root (`USER node`) with `dumb-init` as PID 1.
- **The dashboard never writes to Zoho** — all integration is read-only, which bounds the blast radius of any bug.

---

## 30. Important Files & Documentation

| Path | Purpose | Current or historical? |
|---|---|---|
| `backend/src/config/journey.js` | The stage→card map; the single source of meaning | **Current** |
| `backend/src/config/salesFunnel.js` | S1–S6 ladder, `UNSET_STAGE`, city buckets | **Current** |
| `backend/src/config/cardFormula.js` | Generates "Show Formula" from the counting config | **Current** |
| `backend/src/services/preDesignBoard.js` | Pre Design board + `datedStageCard` | **Current** |
| `backend/src/services/salesFunnelBoard.js` | Sales board + dated S6/Handover | **Current** |
| `backend/src/services/postDesignFunnel.js` | Post Design; note its headline/flow emphasis is inverted vs Pre Design | **Current** |
| `backend/src/services/stageLedger.js` | Ledger reader + `indexByRecord` | **Current** |
| `backend/src/services/bulkLedger.js` | Bulk Read; its header comment documents the reconciliation evidence | **Current, uncommitted** |
| `backend/src/services/zohoClient.js` | All Zoho reads, caching, `getContactsByIds`, `getContactsAtStage` | **Current** |
| `backend/src/services/warmCache.js` | Background warm-up | **Current, uncommitted** |
| `vercel.json` | Deployment config; `bom1` region | **Current** |
| `CLAUDE.md` (at `C:\Users\vkpal\CLAUDE.md`) | Project rules — commit attribution, file placement, line limits | **Current, authoritative** |
| `docs/architecture/dashboard-system-design.md` | Architecture doc | `[UNKNOWN]` — not read this session; may predate the dated-ledger work |
| `docs/post-design.md`, `docs/pdi-review.md` | Board docs | `[UNKNOWN]` — not read this session |
| `DESIGN.md`, `PRODUCT.md`, `README.md` | Root docs | `[UNKNOWN]` — not read this session |
| `C:\Users\vkpal\.claude\plans\stateless-seeking-honey.md` | The original 6-phase remediation plan | **Historical but largely realised** — Phases 1–3 done; 4–6 pending |

> **Note for the next AI:** the four `[UNKNOWN]` docs were not inspected during this session. They may describe the *pre*-dated-ledger architecture. Verify against the code before trusting them.

---

## 31. Final AI Handover Summary

**1. What is this project?**
An internal Magppie dashboard suite — Express API + React SPA — that reads live Zoho CRM and renders ~9 boards for daily stand-up reviews of the order journey from lead to installation.

**2. Current architecture?**
Browser → Vercel static SPA → `/api/*` rewrite → one serverless Express function in Mumbai (`bom1`) → Zoho CRM v8 REST + Bulk Read. Two in-memory caches. **No database** — Zoho is the only persistent store. A persistent self-hosted alternative is built and verified but blocked.

**3. What has been built?**
All 9 boards, live Zoho integration, caching, warm-up, per-card generated formula panels, record popups with per-card columns, universal period filtering including a month picker. This session added: Pre Design and two Sales cards re-based onto dated stage ledgers, the S1–S6 ladder corrected, Bulk Read, a Docker image, and a batch of correctness fixes.

**4. Currently being worked on?**
Just finished a debug sweep: found and fixed an 18-card popup defect on Pre Design, re-verified all invariants (0 issues), tests pass.

**5. What remains?**
Commit and push (nothing is committed). Then: month picker on 4 boards, audit the 6 unaudited boards, resolve the S6 field inconsistency, remediate cyclic-graph rank logic, and unblock the persistent backend.

**6. Locked decisions?**
No database, ever. Card names frozen. Flow leads with stock beside it. `None` orders excluded but counted. Distinct-orders-entering-in-window. `Order Booked` stays on `Actual_Closure_Date`. 25s bulk ceiling. `bom1`. No `Co-Authored-By`. Never `git add .`. Blueprints read-only — Post Design stays Inactive.

**7. Rejected approaches?**
Fly.io, Oracle Cloud, Render, Koyeb, Redis, Upstash, any database, Vercel KV/Blob, paid infrastructure, cross-origin Basic auth with an unmodified API client, S1 absorbing blanks, first-entry-only counting, period-dependent `sitting`.

**8. Known problems?**
S1–S5 can't be dated (`Client_Status` untracked). "EP prep · Planned" is structurally always 0. 2,575 orders at stage `None` on no card. S6 and the rungs below it now read different CRM fields. The stage graph is cyclic, so any surviving rank logic is unsound. Vercel can't share caches.

**9. Inspect first?**
`backend/src/config/journey.js`, then `preDesignBoard.js` (`datedStageCard`), `salesFunnelBoard.js` (`datedCard`), `salesFunnel.js` (S1–S6), `cardFormula.js`.

**10. Do next?**
Commit and push the working tree as ~10 separate conventional commits with explicit staging and **no `Co-Authored-By` trailer**. Then verify the month picker on Measurements, Factory, Dispatch and Decision Queue.

---

*End of PROJECT_CONTEXT.md*
