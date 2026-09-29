/**
 * Verso E2E Testing Harness & Requirement-Driven Oracle Framework
 * 
 * Provides:
 * 1. Self-contained BDD testing framework (describe, it, expect, matchers, runner).
 * 2. Pure engine imports from src/engine/*.ts.
 * 3. Secret routing parser and validator (Admin, Player, Referee, Spectator, Kiosk).
 * 4. LocalStorage admin session rehydration simulator.
 * 5. Player score submission permission enforcement gate.
 * 6. Venue TV slideshow presenter simulation engine.
 * 7. Showcase seed reference ("Mistrzostwa 1v1 FSS" 9 players, 5 dates, 40 matches).
 */

// ============================================================================
// 1. Core Engine Imports
// ============================================================================
import {
  generateBergerSchedule,
  generateBergerMatchesWithPlayers,
  type BergerRound,
  type BergerMatch,
  type PlayerSlot,
} from "../src/engine/berger.ts";

import {
  generateKnockoutBracket,
  type KnockoutMatch,
  type KnockoutSlot,
  type KnockoutRoundName,
} from "../src/engine/knockout.ts";

import {
  calculateStandings,
  type MatchResultInput,
  type PlayerStanding,
  type PointsRule,
} from "../src/engine/standings.ts";

import {
  scheduleTournamentMatches,
  validateScheduleIntegrity,
  type MatchInput,
  type PitchConfig,
  type DayConfig,
  type ScheduledMatch,
} from "../src/engine/scheduler.ts";

import {
  validateMatchScore,
  generateDynamicPrompts,
  DEFAULT_SPORT_PRESETS,
  type SportRulesConfig,
  type ScoreValidationResult,
  type SportPreset,
} from "../src/engine/scoring.ts";

export {
  generateBergerSchedule,
  generateBergerMatchesWithPlayers,
  generateKnockoutBracket,
  calculateStandings,
  scheduleTournamentMatches,
  validateScheduleIntegrity,
  validateMatchScore,
  generateDynamicPrompts,
  DEFAULT_SPORT_PRESETS,
  type BergerRound,
  type BergerMatch,
  type PlayerSlot,
  type KnockoutMatch,
  type KnockoutSlot,
  type KnockoutRoundName,
  type MatchResultInput,
  type PlayerStanding,
  type PointsRule,
  type MatchInput,
  type PitchConfig,
  type DayConfig,
  type ScheduledMatch,
  type SportRulesConfig,
  type ScoreValidationResult,
  type SportPreset,
};

// ============================================================================
// 2. Self-Contained Test Framework (Dual Node / Vitest Support)
// ============================================================================

export interface TestCase {
  name: string;
  fn: () => void | Promise<void>;
  tier: number;
  reqTag?: string;
}

export interface TestSuite {
  name: string;
  tier: number;
  cases: TestCase[];
}

export interface TestResult {
  suiteName: string;
  testName: string;
  tier: number;
  passed: boolean;
  durationMs: number;
  error?: Error;
  reqTag?: string;
}

export class TestRegistry {
  private static instance: TestRegistry;
  private suites: TestSuite[] = [];
  private currentSuite: TestSuite | null = null;
  public totalAssertions = 0;

  public static getInstance(): TestRegistry {
    if (!TestRegistry.instance) {
      TestRegistry.instance = new TestRegistry();
    }
    return TestRegistry.instance;
  }

  public registerSuite(name: string, tier: number, fn: () => void) {
    const suite: TestSuite = { name, tier, cases: [] };
    this.currentSuite = suite;
    this.suites.push(suite);
    fn();
    this.currentSuite = null;
  }

  public registerCase(name: string, fn: () => void | Promise<void>, reqTag?: string) {
    if (!this.currentSuite) {
      throw new Error(`Cannot register test "${name}" outside a test suite.`);
    }
    this.currentSuite.cases.push({
      name,
      fn,
      tier: this.currentSuite.tier,
      reqTag,
    });
  }

  public getSuites(tierFilter?: number): TestSuite[] {
    if (tierFilter !== undefined) {
      return this.suites.filter((s) => s.tier === tierFilter);
    }
    return this.suites;
  }

  public reset() {
    this.suites = [];
    this.currentSuite = null;
    this.totalAssertions = 0;
  }
}

export function describe(name: string, tier: number, fn: () => void): void {
  // If Vitest global exists, also invoke Vitest describe
  const g = globalThis as any;
  if (typeof g.describe === "function") {
    g.describe(`[Tier ${tier}] ${name}`, () => {
      TestRegistry.getInstance().registerSuite(name, tier, fn);
    });
  } else {
    TestRegistry.getInstance().registerSuite(name, tier, fn);
  }
}

export function it(name: string, fn: () => void | Promise<void>, reqTag?: string): void {
  const g = globalThis as any;
  if (typeof g.it === "function") {
    g.it(name, fn);
  }
  TestRegistry.getInstance().registerCase(name, fn, reqTag);
}

// Custom Deep Equality Checker
function deepEquals(a: any, b: any): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") {
    return false;
  }
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEquals(a[i], b[i])) return false;
    }
    return true;
  }
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const k of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, k)) return false;
    if (!deepEquals(a[k], b[k])) return false;
  }
  return true;
}

export class Expectation {
  private actual: any;
  private isNot: boolean;

  constructor(actual: any, isNot: boolean = false) {
    this.actual = actual;
    this.isNot = isNot;
  }

  get not(): Expectation {
    return new Expectation(this.actual, !this.isNot);
  }

  private assert(condition: boolean, message: string) {
    TestRegistry.getInstance().totalAssertions++;
    const passed = this.isNot ? !condition : condition;
    if (!passed) {
      throw new Error(this.isNot ? `Expected NOT: ${message}` : message);
    }
  }

  toBe(expected: any) {
    this.assert(
      Object.is(this.actual, expected),
      `Expected ${JSON.stringify(this.actual)} to be ${JSON.stringify(expected)}`
    );
  }

  toEqual(expected: any) {
    this.assert(
      deepEquals(this.actual, expected),
      `Expected ${JSON.stringify(this.actual)} to equal ${JSON.stringify(expected)}`
    );
  }

  toBeTruthy() {
    this.assert(Boolean(this.actual), `Expected ${JSON.stringify(this.actual)} to be truthy`);
  }

  toBeFalsy() {
    this.assert(!this.actual, `Expected ${JSON.stringify(this.actual)} to be falsy`);
  }

  toBeNull() {
    this.assert(this.actual === null, `Expected ${JSON.stringify(this.actual)} to be null`);
  }

  toBeUndefined() {
    this.assert(this.actual === undefined, `Expected ${JSON.stringify(this.actual)} to be undefined`);
  }

  toBeDefined() {
    this.assert(this.actual !== undefined, `Expected value to be defined`);
  }

  toBeGreaterThan(expected: number) {
    this.assert(this.actual > expected, `Expected ${this.actual} > ${expected}`);
  }

  toBeGreaterThanOrEqual(expected: number) {
    this.assert(this.actual >= expected, `Expected ${this.actual} >= ${expected}`);
  }

  toBeLessThan(expected: number) {
    this.assert(this.actual < expected, `Expected ${this.actual} < ${expected}`);
  }

  toBeLessThanOrEqual(expected: number) {
    this.assert(this.actual <= expected, `Expected ${this.actual} <= ${expected}`);
  }

  toBeCloseTo(expected: number, delta: number = 0.001) {
    const diff = Math.abs(this.actual - expected);
    this.assert(diff <= delta, `Expected ${this.actual} to be close to ${expected} within delta ${delta} (actual diff: ${diff})`);
  }

  toContain(expected: any) {
    if (typeof this.actual === "string") {
      this.assert(this.actual.includes(expected), `Expected "${this.actual}" to contain "${expected}"`);
    } else if (Array.isArray(this.actual)) {
      const found = this.actual.some((item) => deepEquals(item, expected));
      this.assert(found, `Expected array to contain item ${JSON.stringify(expected)}`);
    } else if (this.actual instanceof Set) {
      this.assert(this.actual.has(expected), `Expected Set to contain item ${JSON.stringify(expected)}`);
    } else {
      throw new Error(`toContain called on non-iterable object`);
    }
  }

  toHaveLength(expected: number) {
    const len = this.actual?.length;
    this.assert(len === expected, `Expected length ${expected}, but got ${len}`);
  }

  toThrow(expectedMessageOrRegex?: string | RegExp) {
    if (typeof this.actual !== "function") {
      throw new Error(`toThrow must be called on a function`);
    }
    let threw = false;
    let thrownError: any = null;
    try {
      this.actual();
    } catch (err: any) {
      threw = true;
      thrownError = err;
    }

    if (!threw) {
      this.assert(false, `Expected function to throw, but it executed without error.`);
      return;
    }

    if (expectedMessageOrRegex) {
      const msg = thrownError?.message ?? String(thrownError);
      if (typeof expectedMessageOrRegex === "string") {
        this.assert(
          msg.includes(expectedMessageOrRegex),
          `Expected thrown message "${msg}" to contain "${expectedMessageOrRegex}"`
        );
      } else {
        this.assert(
          expectedMessageOrRegex.test(msg),
          `Expected thrown message "${msg}" to match pattern ${expectedMessageOrRegex}`
        );
      }
    } else {
      this.assert(true, `Function threw as expected.`);
    }
  }
}

export function expect(actual: any): Expectation {
  return new Expectation(actual);
}

// ============================================================================
// 3. Passwordless Role-Based Routing & Secret Token Simulator
// ============================================================================

export type UserRole = "admin" | "player" | "referee" | "spectator" | "presenter";

export interface ParsedRoute {
  isValid: boolean;
  role?: UserRole;
  slug?: string;
  adminSecret?: string;
  playerSecret?: string;
  refereeSecret?: string;
  error?: string;
}

/**
 * Validates and extracts tournament slug and passwordless secret tokens from URL paths.
 * Specifications from R4:
 * - Admin Hub: `/[slug]/admin/[adminSecret]`
 * - Player Terminal: `/[slug]/p/[playerSecret]`
 * - Referee Terminal: `/[slug]/referee/[refereeSecret]`
 * - Public Spectator: `/[slug]`
 * - Venue TV Presenter: `/[slug]/present`
 */
export function parseSecretRoute(pathname: string): ParsedRoute {
  const normalized = pathname.startsWith("/") ? pathname : "/" + pathname;
  const parts = normalized.split("/").filter(Boolean);

  if (parts.length === 0) {
    return { isValid: false, error: "Empty route" };
  }

  const slug = parts[0];

  // /[slug] -> Spectator
  if (parts.length === 1) {
    return { isValid: true, role: "spectator", slug };
  }

  // /[slug]/present -> Venue TV Kiosk
  if (parts.length === 2 && parts[1] === "present") {
    return { isValid: true, role: "presenter", slug };
  }

  // /[slug]/admin/[adminSecret]
  if (parts[1] === "admin") {
    if (parts.length >= 3 && parts[2].trim().length > 0) {
      return { isValid: true, role: "admin", slug, adminSecret: parts[2] };
    }
    // Visiting /[slug]/admin without token requires localStorage rehydration
    return { isValid: true, role: "admin", slug, adminSecret: undefined };
  }

  // /[slug]/p/[playerSecret]
  if (parts[1] === "p") {
    if (parts.length >= 3 && parts[2].trim().length > 0) {
      return { isValid: true, role: "player", slug, playerSecret: parts[2] };
    }
    return { isValid: false, error: "Missing player secret token in /p/ URL" };
  }

  // /[slug]/referee/[refereeSecret]
  if (parts[1] === "referee") {
    if (parts.length >= 3 && parts[2].trim().length > 0) {
      return { isValid: true, role: "referee", slug, refereeSecret: parts[2] };
    }
    return { isValid: false, error: "Missing referee secret token in /referee/ URL" };
  }

  return { isValid: false, error: `Unrecognized route pattern: ${pathname}` };
}

export function buildSecretRoute(
  role: UserRole,
  slug: string,
  secret?: string
): string {
  switch (role) {
    case "admin":
      return secret ? `/${slug}/admin/${secret}` : `/${slug}/admin`;
    case "player":
      if (!secret) throw new Error("Player route requires playerSecret");
      return `/${slug}/p/${secret}`;
    case "referee":
      if (!secret) throw new Error("Referee route requires refereeSecret");
      return `/${slug}/referee/${secret}`;
    case "presenter":
      return `/${slug}/present`;
    case "spectator":
      return `/${slug}`;
  }
}

// ============================================================================
// 4. LocalStorage Admin Token Caching & Rehydration Emulator
// ============================================================================

export class LocalStorageMock {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  get length(): number {
    return this.store.size;
  }

  key(index: number): string | null {
    const keys = Array.from(this.store.keys());
    return keys[index] ?? null;
  }
}

export const ADMIN_TOKEN_KEY_PREFIX = "verso_admin_";

export function getAdminStorageKey(slug: string): string {
  return `${ADMIN_TOKEN_KEY_PREFIX}${slug}`;
}

export function cacheAdminToken(
  storage: LocalStorageMock,
  slug: string,
  adminSecret: string
): void {
  storage.setItem(getAdminStorageKey(slug), adminSecret);
}

export function getCachedAdminToken(
  storage: LocalStorageMock,
  slug: string
): string | null {
  return storage.getItem(getAdminStorageKey(slug));
}

export function clearAdminToken(storage: LocalStorageMock, slug: string): void {
  storage.removeItem(getAdminStorageKey(slug));
}

/**
 * Rehydrates admin session when visiting /[slug]/admin without token.
 */
export function rehydrateAdminSession(
  storage: LocalStorageMock,
  pathname: string,
  registeredTournaments: Map<string, { adminSecret: string }>
): {
  authenticated: boolean;
  slug?: string;
  adminSecret?: string;
  redirectUrl?: string;
} {
  const route = parseSecretRoute(pathname);
  if (!route.isValid || route.role !== "admin" || !route.slug) {
    return { authenticated: false, redirectUrl: "/" };
  }

  const tournament = registeredTournaments.get(route.slug);
  if (!tournament) {
    return { authenticated: false, redirectUrl: `/${route.slug}` };
  }

  // 1. If URL has token, verify and cache it
  if (route.adminSecret) {
    if (route.adminSecret === tournament.adminSecret) {
      cacheAdminToken(storage, route.slug, route.adminSecret);
      return {
        authenticated: true,
        slug: route.slug,
        adminSecret: route.adminSecret,
      };
    } else {
      return { authenticated: false, redirectUrl: `/${route.slug}` };
    }
  }

  // 2. If URL doesn't have token, attempt rehydration from LocalStorage
  const cachedToken = getCachedAdminToken(storage, route.slug);
  if (cachedToken && cachedToken === tournament.adminSecret) {
    return {
      authenticated: true,
      slug: route.slug,
      adminSecret: cachedToken,
    };
  }

  // 3. Fallback: unauthenticated, redirect to spectator portal
  return { authenticated: false, redirectUrl: `/${route.slug}` };
}

// ============================================================================
// 5. Score Submission Permission Enforcement Gate
// ============================================================================

export interface SubmissionMatchTarget {
  id: string;
  player1Id: string;
  player2Id: string;
  status: "pending" | "in_progress" | "completed";
}

export interface SubmissionRequest {
  role: UserRole;
  requestingPlayerId?: string;
  tournamentAllowsPlayerSubmission: boolean;
  match: SubmissionMatchTarget;
  submittedSets: { s1: number; s2: number }[];
}

export interface SubmissionDecision {
  allowed: boolean;
  reason?: string;
}

/**
 * Evaluates whether a score submission is authorized per R2 & R4 acceptance criteria:
 * - Admin Hub & Referee Terminal have full authority to submit/override.
 * - Player Terminal can submit ONLY IF allowPlayerScoreSubmission is true.
 * - Player can submit ONLY for matches where they are player1 or player2.
 * - Player cannot submit/modify matches already finalized/completed.
 * - Spectator role cannot submit scores under any circumstance.
 */
export function evaluateScoreSubmissionPermission(
  req: SubmissionRequest
): SubmissionDecision {
  const { role, requestingPlayerId, tournamentAllowsPlayerSubmission, match } = req;

  // Spectator or Presenter can never submit
  if (role === "spectator" || role === "presenter") {
    return {
      allowed: false,
      reason: "Spectator and Presenter roles have read-only access",
    };
  }

  // Admin and Referee have full management authority
  if (role === "admin" || role === "referee") {
    return { allowed: true };
  }

  // Player role checks
  if (role === "player") {
    if (!tournamentAllowsPlayerSubmission) {
      return {
        allowed: false,
        reason: "Player score submission is disabled by tournament organizer",
      };
    }

    if (!requestingPlayerId) {
      return {
        allowed: false,
        reason: "Player identity missing from request",
      };
    }

    if (
      requestingPlayerId !== match.player1Id &&
      requestingPlayerId !== match.player2Id
    ) {
      return {
        allowed: false,
        reason: "Player cannot submit scores for matches they are not participating in",
      };
    }

    if (match.status === "completed") {
      return {
        allowed: false,
        reason: "Player cannot overwrite completed/verified match score; contact referee",
      };
    }

    return { allowed: true };
  }

  return { allowed: false, reason: "Unauthorized role" };
}

// ============================================================================
// 6. Venue TV Slideshow Presenter Engine Simulator
// ============================================================================

export type SlideType = "standings" | "matches" | "announcement";

export interface PresentationConfig {
  rotationIntervalSeconds: number; // e.g. 10
  activeSlideTypes: SlideType[];
  announcementText?: string;
}

export class VenuePresenterSimulator {
  private config: PresentationConfig;
  private currentSlideIndex: number = 0;
  private isPaused: boolean = false;
  private elapsedSeconds: number = 0;
  private controlBarVisible: boolean = false;
  private controlBarLastActiveSec: number = 0;
  private controlAutoHideTimeoutSec: number = 3;

  constructor(config?: Partial<PresentationConfig>) {
    this.config = {
      rotationIntervalSeconds: config?.rotationIntervalSeconds ?? 10,
      activeSlideTypes: config?.activeSlideTypes ?? ["standings", "matches", "announcement"],
      announcementText: config?.announcementText ?? "Witaj w Mistrzostwach Verso!",
    };
  }

  get currentSlide(): SlideType {
    return this.config.activeSlideTypes[this.currentSlideIndex];
  }

  get slideIndex(): number {
    return this.currentSlideIndex;
  }

  get isPlaying(): boolean {
    return !this.isPaused;
  }

  get controlsVisible(): boolean {
    return this.controlBarVisible;
  }

  get intervalSeconds(): number {
    return this.config.rotationIntervalSeconds;
  }

  play(): void {
    this.isPaused = false;
  }

  pause(): void {
    this.isPaused = true;
  }

  togglePlayPause(): void {
    this.isPaused = !this.isPaused;
  }

  nextSlide(): void {
    const total = this.config.activeSlideTypes.length;
    this.currentSlideIndex = (this.currentSlideIndex + 1) % total;
    this.elapsedSeconds = 0;
  }

  prevSlide(): void {
    const total = this.config.activeSlideTypes.length;
    this.currentSlideIndex = (this.currentSlideIndex - 1 + total) % total;
    this.elapsedSeconds = 0;
  }

  tick(seconds: number): void {
    if (this.isPaused) return;

    this.elapsedSeconds += seconds;
    if (this.elapsedSeconds >= this.config.rotationIntervalSeconds) {
      const slidesToAdvance = Math.floor(
        this.elapsedSeconds / this.config.rotationIntervalSeconds
      );
      const total = this.config.activeSlideTypes.length;
      this.currentSlideIndex = (this.currentSlideIndex + slidesToAdvance) % total;
      this.elapsedSeconds = this.elapsedSeconds % this.config.rotationIntervalSeconds;
    }

    // Check control bar auto-hide
    if (
      this.controlBarVisible &&
      this.elapsedSeconds - this.controlBarLastActiveSec >= this.controlAutoHideTimeoutSec
    ) {
      this.controlBarVisible = false;
    }
  }

  userInteraction(): void {
    this.controlBarVisible = true;
    this.controlBarLastActiveSec = this.elapsedSeconds;
  }

  setAnnouncement(text: string): void {
    this.config.announcementText = text;
  }

  get announcementText(): string | undefined {
    return this.config.announcementText;
  }
}

// ============================================================================
// 7. Showcase Seed Reference Data ("Mistrzostwa 1v1 FSS")
// ============================================================================

export interface ShowcasePlayer {
  id: string;
  name: string;
  slotIndex: number;
  secretCode: string;
}

export const FSS_SHOWCASE_PLAYERS: ShowcasePlayer[] = [
  { id: "p-1", name: "Antek Sadowski", slotIndex: 0, secretCode: "sec-antek-01" },
  { id: "p-2", name: "Bartek Kalarus", slotIndex: 1, secretCode: "sec-bartek-02" },
  { id: "p-3", name: "Filip Kruszka", slotIndex: 2, secretCode: "sec-kruszka-03" },
  { id: "p-4", name: "Filip Szata", slotIndex: 3, secretCode: "sec-szata-04" },
  { id: "p-5", name: "Franek Herka", slotIndex: 4, secretCode: "sec-franek-05" },
  { id: "p-6", name: "Igor Mądry", slotIndex: 5, secretCode: "sec-igor-06" },
  { id: "p-7", name: "Leon Marycki", slotIndex: 6, secretCode: "sec-leon-07" },
  { id: "p-8", name: "Michał Krzakiewicz", slotIndex: 7, secretCode: "sec-michal-08" },
  { id: "p-9", name: "Tomasz Borówka", slotIndex: 8, secretCode: "sec-tomasz-09" },
];

export const FSS_SHOWCASE_DATES: string[] = [
  "2026-10-02",
  "2026-10-03",
  "2026-10-04",
  "2026-10-16",
  "2026-10-17",
];

export const FSS_SHOWCASE_PITCHES: { id: string; name: string; order: number }[] = [
  { id: "pitch-1", name: "Stół 1", order: 1 },
  { id: "pitch-2", name: "Stół 2", order: 2 },
];

export const FSS_SPORT_RULES: SportRulesConfig = {
  preset: "table_tennis",
  singularUnit: "Set",
  pluralUnit: "Sety",
  targetPointsPerUnit: 11,
  unitsToWinMatch: 2,
  hasDeciderTiebreak: true,
  deciderThreshold: 1,
  deciderPoints: 15,
  winByTwo: true,
};
