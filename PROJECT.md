# Project: Verso — Tournament Management Platform

## Architecture
Verso is a modern, minimalist, anti-slop tournament management platform engineered as an unconstrained alternative to Tournify. It supports arbitrary participant counts with automated round-robin (Berger) and knockout scheduling, dynamic sport rules, passwordless secret-URL role-based access, and real-time reactive data sync.

### High-Level System Layers
1. **Algorithmic Engine (`src/engine/`)**: Pure TypeScript mathematical engines:
   - `berger.ts`: Deterministic Berger round-robin pairings for any $N$ (odd/even) with bye insertion.
   - `knockout.ts`: Single-elimination tree generator with 3rd-place playoff and qualification DAG routing.
   - `standings.ts`: Recursive tiebreaker engine (Points -> Head-to-Head mini-league -> Matches Won -> Set Diff -> Point Diff).
   - `scheduler.ts`: Pitch & time constraint scheduler preventing player concurrency.
   - `scoring.ts`: Dynamic rule validation & point matrix evaluation based on custom terminology and win conditions.
2. **Convex Reactive Backend (`convex/`)**:
   - 10 reactive tables: `tournaments`, `sportRules`, `days`, `pitches`, `stages`, `groups`, `players`, `matches`, `qualificationRules`, `slides`.
   - Real-time mutations, queries, and optimistic client updates.
   - Client provider with mock/offline fallback (`src/lib/convex-client.ts`) for deterministic offline development and testing.
3. **Dynamic Sport & Scoring Wizard (`src/components/wizard/`)**:
   - Dynamic terminology engine for singular/plural units ("Set"/"Sety", "Głowa"/"Głowy", "Gem"/"Gemy").
   - Dynamic prompt interpolation, decider tiebreak config, win-by-2 margin enforcement, and live match preview card.
4. **Role-Based Passwordless Portals (`src/pages/`)**:
   - Organizer Admin Hub (`/[slug]/admin/[adminSecret]`): Complete tournament command center with localStorage token caching.
   - Personalized Player Terminal (`/[slug]/p/[playerSecret]`): Personal schedule, live countdown, pitch assignment, conditional score submission.
   - Referee Terminal (`/[slug]/referee/[refereeSecret]`): Pitch-side tactile quick scorekeeper with 15s undo.
   - Public Spectator Portal (`/[slug]`): Live schedule, standings with tiebreaker tooltips, interactive bracket, participant directory.
   - Venue TV Slideshow Kiosk (`/[slug]/present`): Fullscreen auto-cycling kiosk with auto-hiding controls.
5. **Showcase Seed ("Mistrzostwa 1v1 FSS")**:
   - Full 9-player, 5-date, 2-pitch, 40-match tournament restoration with exact scoring matrix.
6. **Luxury Anti-Slop Motion & Cloudflare Production Build (`src/styles/`, `vite.config.ts`, `public/_redirects`)**:
   - Obsidian dark canvas (`#09090b`), hairline borders (`border-white/10`), strict Geist typography.
   - Emil Kowalski button press physics (`scale(0.97)`), GSAP transitions (`@gsap/react`), SPA routing fallback for Cloudflare Pages.

---

## Feature Inventory
Every feature identified during the Survey phase is enumerated below and mapped to a specific milestone.

| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Baseline Workspace & Tooling Scaffolding | Git init, package.json, Vite, TS, Vitest, Tailwind, GSAP | M1 | survey 1 |
| 2 | Pure TypeScript Berger Round-Robin Engine | Pairing generator for arbitrary $N$ with byes ($N=9 \implies 36$ matches) | M1 | survey 2, R3 |
| 3 | Single-Elimination Knockout Bracket Generator | Tree generation with 3rd place match & group qualification DAG | M1 | survey 2, R3 |
| 4 | Recursive Tiebreaker Standings Engine | Points -> H2H mini-table -> Matches Won -> Set Diff -> Point Diff | M1 | survey 2, AC |
| 5 | Pitch & Time Scheduling Algorithm | Multi-day, multi-pitch scheduling with rest intervals and no overlap | M1 | survey 2, R3 |
| 6 | Dynamic Scoring & Win-Condition Evaluator | Validates match scores based on target points, decider, win-by-2 | M1 | survey 2, R2 |
| 7 | Algorithmic Engine Unit Test Suite | Comprehensive Vitest suite validating 100% correctness of engines | M1 | survey 1, AC |
| 8 | Convex Database Schema (10 Tables) | Strict schema validators and composite indexes in `convex/schema.ts` | M2 | survey 2, R1 |
| 9 | Reactive Tournament Queries & Mutations | Create, fetch, update settings, verify admin token in Convex | M2 | survey 2, R1 |
| 10 | Reactive Player Management | Player CRUD, bulk add, check-in toggle, secret code generation | M2 | survey 2, R1 |
| 11 | Reactive Match Scheduling & Score Updates | Match generation, score reporting with permissions, bracket advance | M2 | survey 2, R1 |
| 12 | Reactive Standings & Stage Advancement | Live standings calculation and stage progression triggers in Convex | M2 | survey 2, R1 |
| 13 | Client Convex Provider & Offline Mock Fallback | Seamless data client supporting live Convex and offline mock mode | M2 | survey 1, R1 |
| 14 | Dynamic Sport Configuration Wizard | Presets (Table Tennis, Padel, Football, E-sport, Custom) | M3 | survey 3, R2 |
| 15 | Dynamic Terminology Formatter | Singular/Plural interpolation ("Set"/"Sety", "Głowa"/"Głowy") | M3 | survey 3, R2 |
| 16 | Dynamic Localized Question Prompts | Prompts: "Do ilu punktów gra się [Singular]?", "Do ilu [Plural]..." | M3 | survey 3, R2 |
| 17 | Decider Tiebreak & Win-by-2 Configuration | Decider threshold/points at 1:1 and win-by-2 margin toggles | M3 | survey 3, R2 |
| 18 | Player Score Submission Permission Toggle | Master switch stored in tournament settings | M3 | survey 3, R2 |
| 19 | Live Match Card Rule Preview Mockup | Real-time visual mockup card reacting to wizard input changes | M3 | survey 3, R2 |
| 20 | Organizer Admin Hub Route & Security | `/[slug]/admin/[adminSecret]` with token verification | M4 | survey 3, R4 |
| 21 | Admin LocalStorage Token Auto-Rehydration | Caches `verso_admin_${slug}` in localStorage for seamless return | M4 | survey 3, R4 |
| 22 | Admin Participant Manager & Check-In Desk | Interactive player roster with check-in toggle and slot indexing | M4 | survey 3, R4 |
| 23 | Admin Schedule Matrix & Slot Editor | Pitch and time assignment grid with rest conflict warnings | M4 | survey 3, R4 |
| 24 | Admin Scorekeeper & Walkover Tool | Direct score override and walkover handler | M4 | survey 3, R4 |
| 25 | Secret Link Sharing Center | One-click copyable links for players and referees with toasts | M4 | survey 3, R4 |
| 26 | Personalized Player Terminal Route | `/[slug]/p/[playerSecret]` identity header and personal schedule | M4 | survey 3, R4 |
| 27 | Player Next Match Spotlight & Countdown | Real-time countdown timer `HH:MM:SS` to next match and pitch | M4 | survey 3, R4 |
| 28 | Player Bye Round Status Card | Clean resting card when player has an assigned round bye | M4 | survey 3, R4 |
| 29 | Player Conditional Score Submission | Interactive submission drawer if allowed; read-only lock if disabled | M4 | survey 3, R4 |
| 30 | Referee Pitch-Side Scorekeeper Route | `/[slug]/referee/[refereeSecret]` with tactile buttons & 15s undo | M4 | survey 3, R4 |
| 31 | Public Spectator Schedule View | `/[slug]` live schedule with day/pitch filters and pulsing status | M4 | survey 3, R4 |
| 32 | Public Spectator Standings Table | Standings with tiebreaker tooltips explaining rank differences | M4 | survey 3, R4 |
| 33 | Public Spectator Playoff Bracket View | Interactive SVG/CSS bracket tree with winner highlighting | M4 | survey 3, R4 |
| 34 | Public Spectator Participant Directory | Player cards with seed badges and match statistics | M4 | survey 3, R4 |
| 35 | Preloaded "Mistrzostwa 1v1 FSS" Seed Data | 9 players (Tomasz Borówka slot 8), 5 dates, 2 pitches, 40 matches | M5 | survey 2, R5 |
| 36 | One-Click Seed Restoration in Admin | Admin button to restore full FSS tournament with confirmation | M5 | survey 3, R5 |
| 37 | FSS Sets Scoring Matrix Enforcement | 2:0 gives 2-0 pts, 2:1 gives 2-1 pts in standings calculations | M5 | survey 2, R5 |
| 38 | Venue TV Slideshow Kiosk Route | `/[slug]/present` auto-cycling standings, matches, announcements | M5 | survey 3, R4 |
| 39 | Kiosk Timer, Controls & Auto-Hide | Progress indicator, play/pause, keyboard shortcuts, auto-hiding bar | M5 | survey 3, R4 |
| 40 | Dark-Tech Minimalist Luxury Styling | Obsidian canvas, hairline `border-white/10`, Geist typography | M6 | survey 3, R6 |
| 41 | Emil Kowalski Tactile Micro-Interactions | Scale(0.97) button active physics, origin-aware popovers | M6 | survey 3, R6 |
| 42 | GSAP Layout & Page Transitions | Smooth `@gsap/react` transforms with auto-cleanup on unmount | M6 | survey 3, R6 |
| 43 | Cloudflare Pages SPA Routing Fallback | `public/_redirects` routing `/* /index.html 200` | M6 | survey 3, R7 |
| 44 | Production Vite Build & Bundle Optimization | Clean `npm run build` with zero TypeScript or linting errors | M6 | survey 1, R7 |
| 45 | Git Repository Commit History | Meaningful atomic commit history for all milestones | M6 | survey 1, R7 |
| 46 | Opaque-Box E2E Testing Suite (Tiers 1-4) | Category-Partition, BVA, Pairwise, Real-World Workload tests | E2E Track | survey 2/3 |
| 47 | E2E Test Suite Runner & TEST_READY.md | Automated E2E verification test harness and runner | E2E Track | survey 2/3 |
| 48 | Final E2E Pass & Adversarial Hardening | Pass 100% E2E tests + Tier 5 Challenger coverage hardening | Final | survey 2/3 |
| 49 | Forensic Integrity Audit | Systematic authenticity audit verifying clean implementation | Final | instructions |

---

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| E2E | E2E Testing Track | Requirement-driven opaque-box test suite (Tiers 1-4) + runner + `TEST_READY.md` | none | IN_PROGRESS |
| M1 | Algorithmic Core & Scaffolding | Git init, package.json, Vitest, pure TS engines (Berger, Knockout, Tiebreakers, Scheduler, Scoring) + 100% unit tests | none | PLANNED |
| M2 | Convex Reactive Backend | Convex schema (10 tables), queries/mutations, reactive client provider + offline mock fallback | M1 | PLANNED |
| M3 | Dynamic Sport Wizard | Terminology engine, dynamic prompts, win conditions, tiebreak config, player submission toggle, live preview | M1, M2 | PLANNED |
| M4 | Role-Based Secret Portals | Organizer Hub (localStorage cache), Player Terminal (countdown & submission), Referee Terminal (undo), Spectator Portal | M2, M3 | PLANNED |
| M5 | Showcase Seed (FSS) & Venue Presenter | "Mistrzostwa 1v1 FSS" (9 players, 5 dates, 40 matches, 2:0/2:1 scoring) + Venue TV Slideshow Kiosk | M4 | PLANNED |
| M6 | Anti-Slop Motion & Production Build | GSAP transitions, Emil Kowalski polish, hairline styling, Cloudflare SPA fallback, Vite build & Git commits | M5 | PLANNED |
| Final | Final Acceptance & Adversarial Audit | 100% E2E test pass, Tier 5 Challenger coverage hardening, Forensic Auditor veto check | E2E, M6 | PLANNED |

---

## Interface Contracts

### 1. `src/engine/berger.ts`
```typescript
export interface PlayerSlot {
  id: string;
  name: string;
  slotIndex: number; // 0 to N-1
}

export interface BergerMatch {
  round: number; // 1-indexed (1 to N for odd, 1 to N-1 for even)
  matchInRound: number; // 1-indexed
  player1Slot: number;
  player2Slot: number;
  isBye: boolean;
}

export interface BergerRound {
  roundNumber: number;
  matches: BergerMatch[];
  byePlayerSlot?: number;
}

export function generateBergerSchedule(playerCount: number): BergerRound[];
```
- **Guarantees for $N=9$**: Returns exactly 9 rounds, 4 non-bye matches per round (36 total), exactly 1 bye per round, each distinct pair meets once.

### 2. `src/engine/standings.ts`
```typescript
export interface MatchResultInput {
  player1Id: string;
  player2Id: string;
  sets: { s1: number; s2: number }[];
  status: "pending" | "in_progress" | "completed";
  winnerId?: string;
}

export interface PlayerStanding {
  playerId: string;
  rank: number;
  played: number;
  won: number;
  lost: number;
  points: number;
  setsWon: number;
  setsLost: number;
  setDifference: number;
  pointsWon: number;
  pointsLost: number;
  pointDifference: number;
  tiebreakerExplanation?: string;
}

export function calculateStandings(
  playerIds: string[],
  matches: MatchResultInput[],
  pointsRule: "2_1_matrix" | "standard_3_1_0" = "2_1_matrix"
): PlayerStanding[];
```
- **Tiebreaker order**: Points -> Head-to-Head (mini-league among tied subset) -> Matches Won -> Set Difference -> Point Difference.

### 3. `src/engine/knockout.ts`
```typescript
export interface KnockoutSlot {
  slotId: string;
  sourceType: "seed" | "group_rank" | "winner_of" | "loser_of";
  sourceRef: string; // e.g. "1. Grupa A", "SF1_winner"
  playerId?: string;
}

export interface KnockoutMatch {
  id: string;
  roundName: "quarterfinals" | "semifinals" | "third_place" | "final";
  slot1: KnockoutSlot;
  slot2: KnockoutSlot;
  winnerPlayerId?: string;
}

export function generateKnockoutBracket(
  qualifierCount: number,
  includeThirdPlace: boolean
): KnockoutMatch[];
```

### 4. `src/engine/scoring.ts`
```typescript
export interface SportRulesConfig {
  preset: "table_tennis" | "padel" | "football" | "esport" | "custom";
  singularUnit: string; // e.g. "Set", "Głowa"
  pluralUnit: string; // e.g. "Sety", "Głowy"
  targetPointsPerUnit: number;
  unitsToWinMatch: number;
  hasDeciderTiebreak: boolean;
  deciderThreshold: number; // e.g. 1 (meaning at 1:1)
  deciderPoints: number; // e.g. 15
  winByTwo: boolean;
}

export function validateMatchScore(
  sets: { s1: number; s2: number }[],
  rules: SportRulesConfig
): { isValid: boolean; isMatchCompleted: boolean; winner?: 1 | 2; error?: string };
```

### 5. `convex/schema.ts`
Tables:
- `tournaments`: `slug`, `name`, `adminSecret`, `sportRulesId`, `allowPlayerScoreSubmission`, `createdAt`.
- `sportRules`: `singularUnit`, `pluralUnit`, `targetPointsPerUnit`, `unitsToWinMatch`, `hasDeciderTiebreak`, `deciderPoints`, `winByTwo`, `pointsRule`.
- `days`: `tournamentId`, `date` (YYYY-MM-DD), `order`.
- `pitches`: `tournamentId`, `name`, `order`.
- `stages`: `tournamentId`, `type` ("group" | "knockout"), `name`, `order`.
- `groups`: `stageId`, `name`.
- `players`: `tournamentId`, `name`, `secretCode`, `groupSlotIndex`, `checkedIn`.
- `matches`: `tournamentId`, `stageId`, `groupId`, `dayId`, `pitchId`, `time`, `roundNumber`, `player1Id`, `player2Id`, `sets`, `status`, `winnerId`.
- `qualificationRules`: `tournamentId`, `sourceGroupId`, `sourceRank`, `targetMatchId`, `targetSlot`.
- `slides`: `tournamentId`, `rotationIntervalSeconds`, `announcementText`, `activeSlides`.

---

## Code Layout
```
d:\Projects\Verso\
├── .agents/                      # Agent orchestration metadata only
├── convex/                       # Convex backend schema, mutations & queries
│   ├── schema.ts
│   ├── tournaments.ts
│   ├── players.ts
│   ├── matches.ts
│   ├── standings.ts
│   ├── seed.ts
│   └── slides.ts
├── public/                       # Static public assets
│   ├── _redirects                # Cloudflare Pages SPA fallback: /* /index.html 200
│   └── favicon.svg
├── src/                          # Frontend React SPA
│   ├── components/               # Reusable UI components
│   │   ├── ui/                   # Atoms: Button, Card, Badge, Modal, Tooltip, Input
│   │   ├── wizard/               # R2 Sport & Scoring Wizard
│   │   ├── standings/            # Standings table with tiebreaker indicators
│   │   ├── bracket/              # Interactive Knockout Bracket
│   │   ├── schedule/             # Match schedule list & calendar filters
│   │   └── kiosk/                # Fullscreen presenter slide cycling & ticker
│   ├── engine/                   # Pure TypeScript algorithmic engines
│   │   ├── berger.ts             # Berger round-robin engine
│   │   ├── knockout.ts           # Knockout DAG generator
│   │   ├── standings.ts          # Standings & recursive tiebreakers
│   │   ├── scheduler.ts          # Pitch & rest scheduler
│   │   ├── scoring.ts            # Scoring validator & terminology interpolator
│   │   └── __tests__/            # Comprehensive Vitest unit test suites
│   ├── lib/                      # Utilities & Convex client wrapper
│   │   ├── convex-client.ts      # Reactive Convex / offline mock client
│   │   ├── formatters.ts         # Time, countdown, terminology formatters
│   │   └── motion.ts             # GSAP animation helpers & tokens
│   ├── pages/                    # Role-based route components
│   │   ├── Home.tsx              # Landing / tournament creation wizard
│   │   ├── SpectatorPortal.tsx   # /[slug]
│   │   ├── AdminHub.tsx          # /[slug]/admin/[adminSecret]
│   │   ├── PlayerTerminal.tsx    # /[slug]/p/[playerSecret]
│   │   ├── RefereeTerminal.tsx   # /[slug]/referee/[refereeSecret]
│   │   └── VenuePresenter.tsx    # /[slug]/present
│   ├── App.tsx                   # Route provider
│   ├── main.tsx                  # React DOM entry point
│   └── index.css                 # Tailwind & Swiss luxury token styling
├── tests/                        # E2E opaque-box test suite
│   ├── runner.ts                 # E2E test runner
│   ├── tier1_feature.test.ts
│   ├── tier2_boundary.test.ts
│   ├── tier3_pairwise.test.ts
│   └── tier4_workloads.test.ts
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── vitest.config.ts
```
