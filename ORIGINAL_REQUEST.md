# Original User Request

## 2026-09-27T11:52:06Z

Build **Verso** – a modern, minimalist, anti-slop tournament management platform and unconstrained alternative to Tournify (tournifyapp.com), designed for continuous creation and live management of sports and e-sports tournaments without participant caps. Verso features a reactive real-time Convex backend, dynamic custom sport & scoring rules, no-login secret URLs for organizers, players, referees, and audience, automated pitch scheduling, and Cloudflare Pages / Workers deployment.

Working directory: d:\Projects\Verso
Integrity mode: development

## Requirements

### R1. Data Architecture & Real-Time Convex Backend
Implement a reactive database schema and mutations/queries in Convex (`convex/`):
- `tournaments`: tournament metadata, unique slug, `adminSecret` token for passwordless management, sport configuration, permission flags (e.g. `allowPlayerScoreSubmission`).
- `sportRules`: dynamic sport & scoring unit config (singular and plural unit name e.g. "Set"/"Sety", target points per unit, units to win match, deciding tiebreak set threshold and points).
- `days`: support for multi-day tournaments (e.g. 5 distinct match dates).
- `pitches`: tables/fields/courts (e.g. "Stół 1", "Stół 2") with ordering.
- `stages` & `groups`: multi-stage structure (group stage, knockout stage, playoff).
- `players`: participants with `secretCode` for private links, assigned group slot index, and check-in status.
- `matches`: games with assigned slots/players, sets scores (`{ s1: number, s2: number }[]`), match status, pitch, day, and time.
- `qualificationRules`: routing graph connecting group rankings to playoff bracket slots.
- `slides`: big-screen venue presentation configuration (`slideshow` & `dias`).

### R2. Dynamic Sport & Scoring Configuration Wizard
Create an intuitive configuration wizard for sport and scoring parameters:
- User can pick a preset (Tenis stołowy, Padel, Piłka nożna, E-sport) or define a **Custom Sport**.
- Dynamic terminology input: Singular unit name (e.g. "Set", "Głowa", "Gem", "Połowa") and Plural unit name (e.g. "Sety", "Głowy", "Gemy", "Połowy").
- Dynamic prompts based on chosen unit name:
  - "Do ilu punktów gra się [Singular]?" (e.g. 20 pkt, 11 pkt).
  - "Do ilu [Plural] gra się, żeby wygrać mecz?" (e.g. 2 wygrane sety).
  - "Czy jest tiebreak / decydujący [Singular] przy stanie 1:1?" (e.g. tak, grany do 15 pkt).
- Tournament setting toggle: Allow/disallow players to submit or verify match scores directly from their player links.

### R3. Scheduling & Pairing Engines (Unlimited Participants)
- **Berger Round-Robin Engine**: Deterministic pairing generator for any number of players $N$ (odd or even), automatically generating byes when player count is odd (e.g. 9 players -> 9 rounds of 4 matches = 36 matches, exactly 1 bye per round).
- **Knockout Bracket Generator**: Single elimination bracket generator with optional 3rd place match and dynamic seeding from group stage `qualificationRules`.
- **Pitch & Time Scheduler**: Automated scheduling across available pitches/tables with configurable match duration and rest break intervals, ensuring no player has overlapping matches.

### R4. Passwordless Role-Based Routing & Views
- **Organizer Admin Hub** (`/[slug]/admin/[adminSecret]`): Full control over tournament settings, players, stage progression, schedule editing, and manual score entry. Automatically remembers admin token in local storage / cookie.
- **Personalized Player Terminal** (`/[slug]/p/[playerSecret]`): Dedicated player portal showing personal match schedule, opponent names, pitch assignments, upcoming countdown, past results, and optional score submission if enabled.
- **Referee Terminal** (`/[slug]/referee/[refereeSecret]`): Quick mobile-first pitch-side scorekeeper interface for referees.
- **Public Spectator Portal** (`/[slug]`): Live schedule, standings table with tiebreaker indicators, playoff bracket view, and participant directory.
- **Venue TV Slideshow** (`/[slug]/present`): Fullscreen kiosk display cycling automatically through live standings, current/upcoming matches, and organizer announcements.

### R5. Preloaded Showcase Seed ("Mistrzostwa 1v1 FSS")
Include a one-click or automatic seed restoring the exact structure from Tournify (`stGRzWFtFoZSfVTyt6LJ`):
- All 9 players: Antek Sadowski, Bartek Kalarus, Filip Kruszka, Filip Szata, Franek Herka, Igor Mądry, Leon Marycki, Michał Krzakiewicz, and **Tomasz Borówka** (unlocked on slot 8).
- All 5 tournament match dates (2026-10-02, 2026-10-03, 2026-10-04, 2026-10-16, 2026-10-17).
- Grupa A (36 matches) and Drabinka B (Semifinals, 3rd place, Final).
- Sets scoring matrix: 2:0 gives 2-0 pts, 2:1 gives 2-1 pts.

### R6. Minimalist Anti-Slop Aesthetics & Motion
- Editorial Swiss/Dark-Tech luxury aesthetic with high typographic discipline, crisp hairline borders (`border-white/10`), refined dark/light palette, zero tacky rainbow gradients or meaningless bouncing.
- Smooth layout transitions powered by GSAP (`@gsap/react`) adhering to GPU-accelerated transforms (`x`, `y`, `scale`, `opacity`).
- Fully responsive across desktop, tablet, and pitch-side mobile devices.

### R7. Cloudflare Pages & Git Repository Setup
- Production Vite build configured for seamless deployment to Cloudflare Pages / Workers.
- Git repository initialized with clean commits and documentation.

## Acceptance Criteria

### Data & Logic
- [ ] Berger algorithm unit tests verify 100% correctness for 9 players: exactly 9 rounds, 4 matches per round, 36 matches total, each player plays each other player once, exactly one bye per round.
- [ ] Sport wizard correctly stores dynamic singular/plural terminology ("Set"/"Sety") and dynamically enforces configured win conditions (e.g. best of 3, tiebreak to 15 points).
- [ ] Standings table properly applies recursive tiebreakers: Points -> Head-to-Head -> Matches Won -> Set Difference -> Point Difference.

### User Workflows & Access
- [ ] Admin can access dashboard via secret URL without email/password login and edit tournament configuration.
- [ ] Player accessing `/[slug]/p/[playerSecret]` sees only their personal schedule, pitch, and countdown.
- [ ] If player score submission is enabled in settings, player can submit scores; if disabled, interface is read-only.
- [ ] Venue presentation mode (`/[slug]/present`) cycles fullscreen slides at configured intervals.
- [ ] The seed button restores the full "Mistrzostwa 1v1 FSS" tournament with all 9 players, 5 dates, and 40 total matches.

### Build & Deployment
- [ ] `npm run build` succeeds with zero TypeScript or linting errors.
- [ ] Git repository is initialized with meaningful commit history.

## 2026-09-28T18:40:21Z

Build **Verso** – a modern, minimalist, anti-slop tournament management platform and unconstrained alternative to Tournify (tournifyapp.com), designed for continuous creation and live management of sports and e-sports tournaments without participant caps. Verso features a reactive real-time Convex backend, dynamic custom sport & scoring rules, no-login secret URLs for organizers, players, referees, and audience, automated pitch scheduling, and Cloudflare Pages / Workers deployment.

Working directory: d:\Projects\Verso
Integrity mode: development

## Status & Existing Progress
The algorithmic engines in `src/engine/` (`berger.ts`, `knockout.ts`, `scheduler.ts`, `scoring.ts`, `standings.ts`) have already been implemented and 100/100 Vitest tests have passed. Continue from here to complete the Convex backend, full React 19 frontend UI, and end-to-end integration.

## Requirements

### R1. Data Architecture & Real-Time Convex Backend
Implement a reactive database schema and mutations/queries in Convex (`convex/`):
- `tournaments`: tournament metadata, unique slug, `adminSecret` token for passwordless management, sport configuration, permission flags (e.g. `allowPlayerScoreSubmission`).
- `sportRules`: dynamic sport & scoring unit config (singular and plural unit name e.g. "Set"/"Sety", target points per unit, units to win match, deciding tiebreak set threshold and points).
- `days`: support for multi-day tournaments (e.g. 5 distinct match dates).
- `pitches`: tables/fields/courts (e.g. "Stół 1", "Stół 2") with ordering.
- `stages` & `groups`: multi-stage structure (group stage, knockout stage, playoff).
- `players`: participants with `secretCode` for private links, assigned group slot index, and check-in status.
- `matches`: games with assigned slots/players, sets scores (`{ s1: number, s2: number }[]`), match status, pitch, day, and time.
- `qualificationRules`: routing graph connecting group rankings to playoff bracket slots.
- `slides`: big-screen venue presentation configuration (`slideshow` & `dias`).

### R2. Dynamic Sport & Scoring Configuration Wizard
Create an intuitive configuration wizard for sport and scoring parameters:
- User can pick a preset (Tenis stołowy, Padel, Piłka nożna, E-sport) or define a **Custom Sport**.
- Dynamic terminology input: Singular unit name (e.g. "Set", "Głowa", "Gem", "Połowa") and Plural unit name (e.g. "Sety", "Głowy", "Gemy", "Połowy").
- Dynamic prompts based on chosen unit name:
  - "Do ilu punktów gra się [Singular]?" (e.g. 20 pkt, 11 pkt).
  - "Do ilu [Plural] gra się, żeby wygrać mecz?" (e.g. 2 wygrane sety).
  - "Czy jest tiebreak / decydujący [Singular] przy stanie 1:1?" (e.g. tak, grany do 15 pkt).
- Tournament setting toggle: Allow/disallow players to submit or verify match scores directly from their player links.

### R3. Scheduling & Pairing Engines (Unlimited Participants)
- **Berger Round-Robin Engine**: Deterministic pairing generator for any number of players $N$ (odd or even), automatically generating byes when player count is odd (e.g. 9 players -> 9 rounds of 4 matches = 36 matches, exactly 1 bye per round).
- **Knockout Bracket Generator**: Single elimination bracket generator with optional 3rd place match and dynamic seeding from group stage `qualificationRules`.
- **Pitch & Time Scheduler**: Automated scheduling across available pitches/tables with configurable match duration and rest break intervals, ensuring no player has overlapping matches.

### R4. Passwordless Role-Based Routing & Views
- **Organizer Admin Hub** (`/[slug]/admin/[adminSecret]`): Full control over tournament settings, players, stage progression, schedule editing, and manual score entry. Automatically remembers admin token in local storage / cookie.
- **Personalized Player Terminal** (`/[slug]/p/[playerSecret]`): Dedicated player portal showing personal match schedule, opponent names, pitch assignments, upcoming countdown, past results, and optional score submission if enabled.
- **Referee Terminal** (`/[slug]/referee/[refereeSecret]`): Quick mobile-first pitch-side scorekeeper interface for referees.
- **Public Spectator Portal** (`/[slug]`): Live schedule, standings table with tiebreaker indicators, playoff bracket view, and participant directory.
- **Venue TV Slideshow** (`/[slug]/present`): Fullscreen kiosk display cycling automatically through live standings, current/upcoming matches, and organizer announcements.

### R5. Preloaded Showcase Seed ("Mistrzostwa 1v1 FSS")
Include a one-click or automatic seed restoring the exact structure from Tournify (`stGRzWFtFoZSfVTyt6LJ`):
- All 9 players: Antek Sadowski, Bartek Kalarus, Filip Kruszka, Filip Szata, Franek Herka, Igor Mądry, Leon Marycki, Michał Krzakiewicz, and **Tomasz Borówka** (unlocked on slot 8).
- All 5 tournament match dates (2026-10-02, 2026-10-03, 2026-10-04, 2026-10-16, 2026-10-17).
- Grupa A (36 matches) and Drabinka B (Semifinals, 3rd place, Final).
- Sets scoring matrix: 2:0 gives 2-0 pts, 2:1 gives 2-1 pts.

### R6. Minimalist Anti-Slop Aesthetics & Motion
- Editorial Swiss/Dark-Tech luxury aesthetic with high typographic discipline, crisp hairline borders (`border-white/10`), refined dark/light palette, zero tacky rainbow gradients or meaningless bouncing.
- Smooth layout transitions powered by GSAP (`@gsap/react`) adhering to GPU-accelerated transforms (`x`, `y`, `scale`, `opacity`).
- Fully responsive across desktop, tablet, and pitch-side mobile devices.

### R7. Cloudflare Pages & Git Repository Setup
- Production Vite build configured for seamless deployment to Cloudflare Pages / Workers.
- Git repository initialized with clean commits and documentation.

## Acceptance Criteria

### Data & Logic
- [ ] Berger algorithm unit tests verify 100% correctness for 9 players: exactly 9 rounds, 4 matches per round, 36 matches total, each player plays each other player once, exactly one bye per round.
- [ ] Sport wizard correctly stores dynamic singular/plural terminology ("Set"/"Sety") and dynamically enforces configured win conditions (e.g. best of 3, tiebreak to 15 points).
- [ ] Standings table properly applies recursive tiebreakers: Points -> Head-to-Head -> Matches Won -> Set Difference -> Point Difference.

### User Workflows & Access
- [ ] Admin can access dashboard via secret URL without email/password login and edit tournament configuration.
- [ ] Player accessing `/[slug]/p/[playerSecret]` sees only their personal schedule, pitch, and countdown.
- [ ] If player score submission is enabled in settings, player can submit scores; if disabled, interface is read-only.
- [ ] Venue presentation mode (`/[slug]/present`) cycles fullscreen slides at configured intervals.
- [ ] The seed button restores the full "Mistrzostwa 1v1 FSS" tournament with all 9 players, 5 dates, and 40 total matches.

### Build & Deployment
- [ ] `npm run build` succeeds with zero TypeScript or linting errors.
- [ ] Git repository is initialized with meaningful commit history.

## 2026-09-29T15:35:48Z

Build **Verso** – a modern, minimalist, anti-slop tournament management platform and unconstrained alternative to Tournify (tournifyapp.com), designed for continuous creation and live management of sports and e-sports tournaments without participant caps. Verso features a reactive real-time Convex backend, dynamic custom sport & scoring rules, no-login secret URLs for organizers, players, referees, and audience, automated pitch scheduling, and Cloudflare Pages / Workers deployment.

Working directory: d:\Projects\Verso
Integrity mode: development

## Current Project Status
- **Milestone 1 COMPLETED**: Pure algorithmic engines in `src/engine/` (`berger.ts`, `knockout.ts`, `scheduler.ts`, `scoring.ts`, `standings.ts`) verified with 100/100 tests.
- **Milestone 2 COMPLETED**: Complete 10-table Convex database schema (`convex/schema.ts`), endpoints (`matches.ts`, `players.ts`, `tournaments.ts`, `standings.ts`, `slides.ts`, `seed.ts`), reactive client (`src/lib/convex-client.ts`), and test suites (156/156 tests passing).

## Tasks to Complete Now (Milestones 3 - 6)

### Milestone 3: Dynamic Sport & Scoring Configuration Wizard
Implement an interactive, intuitive sport and scoring rules wizard:
- Presets: Table Tennis, Padel, Football, Esports, or Custom Sport.
- Dynamic terminology inputs: Singular unit name (e.g. "Set", "Głowa", "Gem", "Połowa") and Plural unit name (e.g. "Sety", "Głowy", "Gemy", "Połowy").
- Dynamic prompts interpolating the custom unit names:
  - "Do ilu punktów gra się [Singular]?" (e.g. 20, 11).
  - "Do ilu [Plural] gra się, żeby wygrać mecz?" (e.g. 2).
  - "Czy jest tiebreak / decydujący [Singular] przy stanie 1:1?" (e.g. tak, do 15 pkt).
- Setting toggle: `allowPlayerScoreSubmission` (allow/disallow players to submit or verify match scores directly from their private player links).
- Connect wizard output directly to Convex mutations/state.

### Milestone 4: Role-Based Routing & Views
Implement the complete front-end page hierarchy and navigation:
- **Organizer Admin Hub** (`/[slug]/admin/[adminSecret]`): Full dashboard to manage players (unlimited), stages, groups, pitch matrix, and manual score entry with live recalculation. Automatically caches `adminSecret` in local storage.
- **Personalized Player Terminal** (`/[slug]/p/[playerSecret]`): Dedicated player portal showing personal match schedule, opponent names, pitch assignments, upcoming countdown, past results, and conditional score submission based on the tournament setting.
- **Referee Terminal** (`/[slug]/referee/[refereeSecret]`): Quick mobile-first pitch-side scorekeeper interface for referees.
- **Public Spectator Portal** (`/[slug]`): Tabs for Schedule (filterable by pitch/date), Group Standings (with recursive tiebreaker indicators and H2H tooltips), Knockout Bracket view, and Participant Directory.

### Milestone 5: Venue TV Presentation Mode & Showcase Seed
- **Venue TV Slideshow** (`/[slug]/present`): Fullscreen kiosk display cycling automatically through live standings, current/upcoming matches, and organizer announcements.
- **Showcase Seed Button**: One-click or auto seed restoring the exact "Mistrzostwa 1v1 FSS" structure:
  - All 9 players: Antek Sadowski, Bartek Kalarus, Filip Kruszka, Filip Szata, Franek Herka, Igor Mądry, Leon Marycki, Michał Krzakiewicz, and **Tomasz Borówka** (unlocked on slot 8).
  - All 5 tournament match dates (2026-10-02, 2026-10-03, 2026-10-04, 2026-10-16, 2026-10-17).
  - Grupa A (36 matches) and Drabinka B (Semifinals, 3rd place, Final).
  - Sets scoring matrix: 2:0 gives 2-0 pts, 2:1 gives 2-1 pts.

### Milestone 6: Minimalist Anti-Slop Aesthetics, Cloudflare Build & Git
- Editorial Swiss/Dark-Tech luxury aesthetic with high typographic discipline, crisp hairline borders (`border-white/10`), refined dark/light palette, zero tacky rainbow gradients or meaningless bouncing.
- Smooth layout transitions powered by GSAP (`@gsap/react`) adhering to GPU-accelerated transforms (`x`, `y`, `scale`, `opacity`).
- Responsive across desktop, tablet, and pitch-side mobile devices.
- Production Vite build (`npm run build`) verification without TypeScript or linting errors.
- Clean Git repository commits.

