# Verso E2E Test Infrastructure & Methodology

## 1. Test Philosophy & Principles

Verso is tested through a strict **requirement-driven, opaque-box testing framework**. Testing treats system boundaries, algorithmic engines, role-based workflows, and data stores as black/gray-box interfaces whose observable behavior must strictly conform to `ORIGINAL_REQUEST.md` and `PROJECT.md`.

### Core Directives
1. **Opaque-Box Verification**: Tests validate observable contracts, side effects, and state transitions rather than private internal variables.
2. **Deterministic Output Derivation**: Every test case derives expected outputs from documented mathematical formulas (e.g. Berger circle rotation, cyclic graph tiebreakers), Tournify reference tournament seeds (`stGRzWFtFoZSfVTyt6LJ`), or exact user acceptance criteria.
3. **Progressive Testability**: Tests are self-contained and isolated. Engine tests can execute against pure TypeScript mathematical implementations, and role-based / presentation tests execute through deterministic simulation harnesses that test the exact URL and role contracts.
4. **Adversarial & Fault Tolerance Hardening**:
   - **Boundary & Resource Stress**: 0, 1, 2, 3, 4, 9, and large odd/even participant counts.
   - **Score Boundaries**: Incomplete scores (0-0), deuce win-by-2 margin enforcement (11-10 invalid vs 12-10 valid), decider tiebreak thresholds (15 pts vs 11 pts), double walkovers.
   - **Permission Gate Enforcement**: Strict lock-out of unauthorized players attempting to submit scores or tamper with other players' or finalized matches.
   - **Multi-Way Cyclic Ties**: Recursive mini-league evaluation breaking 3-way circular ties ($A \to B \to C \to A$).

---

## 2. Methodology: The 4-Tier Test Pyramid

```
+-------------------------------------------------------------+
| Tier 4: Real-World Application Scenarios                    |
| - Complete "Mistrzostwa 1v1 FSS" 9-player, 5-date, 40-match |
|   tournament lifecycle (Group A -> Standings -> Drabinka B) |
+-------------------------------------------------------------+
| Tier 3: Cross-Feature Combinations (Pairwise)               |
| - Dynamic sport rules + Berger pairings + 2:1 matrix       |
| - Player score entry + Referee override + Spectator sync    |
| - Group stage DAG qualification -> Playoff bracket seeding  |
+-------------------------------------------------------------+
| Tier 2: Boundary & Corner Cases (>=5 tests per feature)    |
| - Odd participant exact math (9 players = 9 rds, 36 matches)|
| - Minimal tournaments (2, 3, 4 players)                     |
| - Win-by-2, 0-0, decider threshold, walkovers               |
| - 3-way & 4-way cyclic tiebreakers                          |
| - LocalStorage admin token caching & rehydration            |
+-------------------------------------------------------------+
| Tier 1: Feature Coverage (>=5 tests per feature across R1-R7)|
| - R1: Data architecture & reactive models                   |
| - R2: Dynamic sport wizard terminology & prompts            |
| - R3: Berger engine & Knockout tree generator               |
| - R4: Passwordless role-based routing (Admin/Player/Ref)    |
| - R5: Showcase FSS seed (9 players, 5 dates, 40 matches)    |
| - R6: Venue TV presentation kiosk cycling                   |
| - R7: Player permission enforcement                         |
+-------------------------------------------------------------+
```

---

## 3. Feature Inventory & Requirement Traceability

| Requirement | Scope & Description | Test Suite / Tier | Acceptance Criteria |
|-------------|---------------------|-------------------|---------------------|
| **R1** Data Architecture | Multi-day dates, pitch ordering, stage/group DAG, matches, player slots | Tier 1 (`tier1_feature.test.ts`), Tier 4 | 10 tables schema contract, relational integrity |
| **R2** Dynamic Sport Wizard | Singular/Plural terminology ("Set"/"Sety", "Głowa"/"Głowy"), localized prompts, win-by-2, decider config | Tier 1, Tier 2, Tier 3 | Correct interpolation in Polish prompts, score validation |
| **R3** Scheduling & Pairings | Berger circle engine (odd/even $N$, byes), Knockout DAG generator, pitch conflict scheduler | Tier 1, Tier 2, Tier 3, Tier 4 | 9 players: 9 rds, 4 matches/rd, 36 matches, 1 bye/rd |
| **R4** Passwordless Secret URLs | Admin Hub (`/[slug]/admin/[secret]`), Player (`/[slug]/p/[secret]`), Referee (`/[slug]/referee/[secret]`), Spectator (`/[slug]`), Presenter (`/[slug]/present`) | Tier 1, Tier 2, Tier 3 | Secret extraction, authorization, token caching |
| **R5** Showcase FSS Seed | "Mistrzostwa 1v1 FSS": 9 players (Tomasz Borówka slot 8), 5 dates, 2 pitches, 40 matches, 2:0/2:1 matrix | Tier 1, Tier 4 (`tier4_workloads.test.ts`) | Exact match count (36 group + 4 playoff = 40), 2:0/2:1 points |
| **R6** Venue TV Presenter | Kiosk slideshow auto-cycling (standings, matches, announcements), interval timer, auto-hide controls | Tier 1, Tier 3, Tier 4 | Seamless rotation, pause/play, wrap-around |
| **R7** Permission Enforcement | Player score submission toggle: allowed vs read-only locked, referee override authority | Tier 1, Tier 2, Tier 3 | Disallowed players cannot submit; referees can override |

---

## 4. Test Suite Execution & Runner Instructions

The test suite is engineered with universal portability: it can be executed natively via the custom high-fidelity runner `tests/e2e_runner.ts` using Node 24 (with zero external dependencies) or through `vitest`.

### Running All E2E Tests via Standalone Runner
```bash
# Direct execution with Node 24 native TypeScript support:
node --experimental-strip-types tests/e2e_runner.ts

# Or via tsx / vitest if node_modules is installed:
npx tsx tests/e2e_runner.ts
npx vitest run tests/
```

### Running Specific Tiers
```bash
# Tier 1 only (Feature Coverage)
node --experimental-strip-types tests/e2e_runner.ts --tier 1

# Tier 2 only (Boundary & Corner Cases)
node --experimental-strip-types tests/e2e_runner.ts --tier 2

# Tier 3 only (Pairwise Cross-Feature)
node --experimental-strip-types tests/e2e_runner.ts --tier 3

# Tier 4 only (Full Real-World FSS 40-match Lifecycle)
node --experimental-strip-types tests/e2e_runner.ts --tier 4
```

---

## 5. Coverage Matrix

| Test Suite | Total Test Cases | Feature Areas Covered | Minimum Target | Actual Count |
|------------|------------------|-----------------------|----------------|--------------|
| `tier1_feature.test.ts` | 38 | Berger (6), Wizard (5), Tiebreakers (6), Secret Routing (5), Permissions (5), Showcase Seed (6), Venue Presenter (5) | >=35 | 38 |
| `tier2_boundary.test.ts` | 30 | Odd counts (5), Minimal tournaments (5), Score boundaries (5), Multi-way cyclic ties (5), Walkovers (5), Token caching (5) | >=30 | 30 |
| `tier3_pairwise.test.ts` | 10 | Custom sport + Berger + matrix, Player submit + Ref override + Spectator, Qualification DAG + Knockout seeding | >=10 | 10 |
| `tier4_workloads.test.ts` | 6 | Full FSS 40-match simulation across 5 dates, 2 pitches, Group A standings, Drabinka B semifinals, 3rd place, and final | >=1 | 6 |
| **Total** | **84** | **All R1-R7 requirements + acceptance criteria** | **>=76** | **84** |
