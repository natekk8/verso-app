/**
 * Verso Reactive Convex Client & Offline Mock In-Memory Store
 *
 * Provides seamless dual-mode data access:
 * 1. Live Convex: When VITE_CONVEX_URL is present, connects via ConvexReactClient.
 * 2. Offline Mock: When VITE_CONVEX_URL is absent/empty/mock, falls back to an in-memory
 *    store with full reactive pub/sub, LocalStorage persistence, and preloaded FSS seed.
 */

import React, {
  createContext,
  useContext,
  useCallback,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  ConvexReactClient,
  ConvexProvider,
  useQuery as convexUseQuery,
  useMutation as convexUseMutation,
  useConvex as convexUseConvex,
} from "convex/react";
import {
  anyApi,
  getFunctionName,
  makeFunctionReference,
  type FunctionReference,
} from "convex/server";

import {
  generateBergerSchedule,
  generateBergerMatchesWithPlayers,
  type PlayerSlot,
  type BergerRound,
} from "../engine/berger";
import {
  generateKnockoutBracket,
  type KnockoutMatch,
} from "../engine/knockout";
import {
  calculateStandings,
  type PlayerStanding,
  type MatchResultInput,
  type PointsRule,
} from "../engine/standings";
import {
  scheduleTournamentMatches,
  type PitchConfig,
  type DayConfig,
  type MatchInput,
} from "../engine/scheduler";
import {
  validateMatchScore,
  DEFAULT_SPORT_PRESETS,
  type SportRulesConfig,
  type SportPreset,
} from "../engine/scoring";

// ============================================================================
// 1. Types & Document Interfaces (10 Reactive Tables)
// ============================================================================

export interface TournamentDoc {
  _id: string;
  _creationTime: number;
  slug: string;
  name: string;
  adminSecret: string;
  sportRulesId: string;
  allowPlayerScoreSubmission: boolean;
  refereeSecret?: string;
  description?: string;
  status?: "draft" | "in_progress" | "completed";
  createdAt: number;
}

export interface SportRulesDoc extends SportRulesConfig {
  _id: string;
  _creationTime: number;
  tournamentId?: string;
  pointsRule: PointsRule;
}

export interface DayDoc {
  _id: string;
  _creationTime: number;
  tournamentId: string;
  date: string; // YYYY-MM-DD
  order: number;
  startTime?: string;
  endTime?: string;
  maxMatches?: number;
}

export interface PitchDoc {
  _id: string;
  _creationTime: number;
  tournamentId: string;
  name: string;
  order: number;
  refereeSecret?: string;
  notes?: string;
}

export interface StageDoc {
  _id: string;
  _creationTime: number;
  tournamentId: string;
  type: "group" | "knockout";
  name: string;
  order: number;
  status?: "pending" | "in_progress" | "completed";
}

export interface GroupDoc {
  _id: string;
  _creationTime: number;
  stageId: string;
  tournamentId: string;
  name: string;
  order?: number;
}

export interface PlayerDoc {
  _id: string;
  _creationTime: number;
  tournamentId: string;
  name: string;
  secretCode: string;
  groupSlotIndex: number;
  checkedIn: boolean;
  notes?: string;
  seed?: number;
}

export interface MatchDoc {
  _id: string;
  _creationTime: number;
  tournamentId: string;
  stageId: string;
  groupId?: string;
  dayId?: string;
  pitchId?: string;
  time?: string; // HH:MM
  endTime?: string;
  startTimestamp?: number;
  endTimestamp?: number;
  roundNumber: number;
  matchInRound?: number;
  player1Id: string;
  player2Id: string;
  player1Slot?: number;
  player2Slot?: number;
  sets: { s1: number; s2: number }[];
  status: "pending" | "in_progress" | "completed";
  winnerId?: string;
  loserId?: string;
  walkover?: boolean;
  walkoverWinnerId?: string;
  bracketRound?: "round_of_32" | "round_of_16" | "quarterfinals" | "semifinals" | "third_place" | "final";
  roundName?: "round_of_32" | "round_of_16" | "quarterfinals" | "semifinals" | "third_place" | "final";
  slot1Source?: any;
  slot2Source?: any;
  knockoutMatchId?: string;
  scoreSubmittedBy?: string;
  updatedAt?: number;
}

export interface QualificationRuleDoc {
  _id: string;
  _creationTime: number;
  tournamentId: string;
  sourceGroupId: string;
  sourceRank: number;
  targetMatchId: string;
  targetSlot: "slot1" | "slot2";
  description?: string;
}

export interface SlideDoc {
  _id: string;
  _creationTime: number;
  tournamentId: string;
  rotationIntervalSeconds: number;
  announcementText?: string;
  activeSlides: ("standings" | "matches" | "announcements" | "announcement")[];
  autoScrollSpeed?: number;
  theme?: string;
  updatedAt?: number;
}

export interface FullTournamentData extends Omit<TournamentDoc, "adminSecret"> {
  adminSecret?: string;
  sportRules: SportRulesDoc;
  days: DayDoc[];
  pitches: PitchDoc[];
  stages: StageDoc[];
  groups: GroupDoc[];
  slides?: SlideDoc;
}

export interface EnrichedMatchDoc extends MatchDoc {
  player1?: PlayerDoc;
  player2?: PlayerDoc;
  pitch?: PitchDoc;
  day?: DayDoc;
}

export interface EnrichedStanding extends PlayerStanding {
  player?: PlayerDoc;
  name?: string;
  groupSlotIndex?: number;
  checkedIn?: boolean;
}

// ============================================================================
// 2. FSS Showcase Seed Data ("Mistrzostwa 1v1 FSS")
// ============================================================================

export const FSS_SEED = {
  tournament: {
    _id: "tourn_fss",
    _creationTime: Date.parse("2026-09-27T10:00:00Z"),
    slug: "mistrzostwa-1v1-fss",
    name: "Mistrzostwa 1v1 FSS",
    adminSecret: "adm_fss_secret_2026",
    sportRulesId: "rules_fss",
    allowPlayerScoreSubmission: true,
    createdAt: Date.parse("2026-09-27T10:00:00Z"),
  },
  sportRules: {
    _id: "rules_fss",
    _creationTime: Date.parse("2026-09-27T10:00:00Z"),
    tournamentId: "tourn_fss",
    preset: "table_tennis" as SportPreset,
    singularUnit: "Set",
    pluralUnit: "Sety",
    targetPointsPerUnit: 11,
    unitsToWinMatch: 2,
    hasDeciderTiebreak: true,
    deciderThreshold: 1,
    deciderPoints: 15,
    winByTwo: true,
    pointsRule: "2_1_matrix" as PointsRule,
  },
  days: [
    { _id: "day_fss_1", _creationTime: 1, tournamentId: "tourn_fss", date: "2026-10-02", order: 1 },
    { _id: "day_fss_2", _creationTime: 2, tournamentId: "tourn_fss", date: "2026-10-03", order: 2 },
    { _id: "day_fss_3", _creationTime: 3, tournamentId: "tourn_fss", date: "2026-10-04", order: 3 },
    { _id: "day_fss_4", _creationTime: 4, tournamentId: "tourn_fss", date: "2026-10-16", order: 4 },
    { _id: "day_fss_5", _creationTime: 5, tournamentId: "tourn_fss", date: "2026-10-17", order: 5 },
  ],
  pitches: [
    { _id: "pitch_fss_1", _creationTime: 1, tournamentId: "tourn_fss", name: "Stół 1", order: 1 },
    { _id: "pitch_fss_2", _creationTime: 2, tournamentId: "tourn_fss", name: "Stół 2", order: 2 },
  ],
  stages: [
    {
      _id: "stage_fss_group",
      _creationTime: 1,
      tournamentId: "tourn_fss",
      type: "group" as const,
      name: "Faza Grupowa",
      order: 1,
    },
    {
      _id: "stage_fss_knockout",
      _creationTime: 2,
      tournamentId: "tourn_fss",
      type: "knockout" as const,
      name: "Drabinka B",
      order: 2,
    },
  ],
  groups: [
    {
      _id: "group_fss_a",
      _creationTime: 1,
      stageId: "stage_fss_group",
      tournamentId: "tourn_fss",
      name: "Grupa A",
    },
  ],
  players: [
    { _id: "p_1", _creationTime: 1, tournamentId: "tourn_fss", name: "Antek Sadowski", slotIndex: 0, secretCode: "sec-antek-01", checkedIn: true },
    { _id: "p_2", _creationTime: 2, tournamentId: "tourn_fss", name: "Bartek Kalarus", slotIndex: 1, secretCode: "sec-bartek-02", checkedIn: true },
    { _id: "p_3", _creationTime: 3, tournamentId: "tourn_fss", name: "Filip Kruszka", slotIndex: 2, secretCode: "sec-kruszka-03", checkedIn: true },
    { _id: "p_4", _creationTime: 4, tournamentId: "tourn_fss", name: "Filip Szata", slotIndex: 3, secretCode: "sec-szata-04", checkedIn: true },
    { _id: "p_5", _creationTime: 5, tournamentId: "tourn_fss", name: "Franek Herka", slotIndex: 4, secretCode: "sec-franek-05", checkedIn: true },
    { _id: "p_6", _creationTime: 6, tournamentId: "tourn_fss", name: "Igor Mądry", slotIndex: 5, secretCode: "sec-igor-06", checkedIn: true },
    { _id: "p_7", _creationTime: 7, tournamentId: "tourn_fss", name: "Leon Marycki", slotIndex: 6, secretCode: "sec-leon-07", checkedIn: true },
    { _id: "p_8", _creationTime: 8, tournamentId: "tourn_fss", name: "Michał Krzakiewicz", slotIndex: 7, secretCode: "sec-michal-08", checkedIn: true },
    { _id: "p_9", _creationTime: 9, tournamentId: "tourn_fss", name: "Tomasz Borówka", slotIndex: 8, secretCode: "sec-tomasz-09", checkedIn: true },
  ],
  slides: {
    _id: "slides_fss",
    _creationTime: 1,
    tournamentId: "tourn_fss",
    rotationIntervalSeconds: 10,
    announcementText: "Mistrzostwa 1v1 FSS – Finały na żywo!",
    activeSlides: ["standings", "matches", "announcements"] as ("standings" | "matches" | "announcements")[],
  },
};

// ============================================================================
// 3. ID Generator & Helpers
// ============================================================================

export function generateId(prefix: string): string {
  const rand = Math.random().toString(36).substring(2, 8);
  const time = Date.now().toString(36);
  return `${prefix}_${rand}_${time}`;
}

export function generateSecret(prefix: string = "sec"): string {
  return `${prefix}-${Math.random().toString(36).substring(2, 10)}`;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ============================================================================
// 4. In-Memory Reactive Mock Store
// ============================================================================

export const LOCAL_STORAGE_MOCK_KEY = "verso_mock_db_v1";

export interface MockDbState {
  version: number;
  savedAt: number;
  tournaments: TournamentDoc[];
  sportRules: SportRulesDoc[];
  days: DayDoc[];
  pitches: PitchDoc[];
  stages: StageDoc[];
  groups: GroupDoc[];
  players: PlayerDoc[];
  matches: MatchDoc[];
  qualificationRules: QualificationRuleDoc[];
  slides: SlideDoc[];
}

export type StoreListener = () => void;

export class MockConvexStore {
  public tournaments = new Map<string, TournamentDoc>();
  public sportRules = new Map<string, SportRulesDoc>();
  public days = new Map<string, DayDoc>();
  public pitches = new Map<string, PitchDoc>();
  public stages = new Map<string, StageDoc>();
  public groups = new Map<string, GroupDoc>();
  public players = new Map<string, PlayerDoc>();
  public matches = new Map<string, MatchDoc>();
  public qualificationRules = new Map<string, QualificationRuleDoc>();
  public slides = new Map<string, SlideDoc>();

  private listeners = new Set<StoreListener>();
  private version = 1;
  private queryCache = new Map<string, any>();
  private persistenceEnabled = true;

  constructor(enablePersistence: boolean = true) {
    this.persistenceEnabled = enablePersistence;
    const restored = this.persistenceEnabled ? this.loadFromStorage() : false;
    if (!restored) {
      this.seedShowcaseFSS();
    }
  }

  // --- Pub / Sub Subscription ---

  public subscribe(listener: StoreListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public notify(): void {
    this.version++;
    this.queryCache.clear();
    if (this.persistenceEnabled) {
      this.saveToStorage();
    }
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (err) {
        console.error("[MockStore] Subscriber error:", err);
      }
    }
  }

  public getVersion(): number {
    return this.version;
  }

  // --- LocalStorage Persistence ---

  public serialize(): MockDbState {
    return {
      version: this.version,
      savedAt: Date.now(),
      tournaments: Array.from(this.tournaments.values()),
      sportRules: Array.from(this.sportRules.values()),
      days: Array.from(this.days.values()),
      pitches: Array.from(this.pitches.values()),
      stages: Array.from(this.stages.values()),
      groups: Array.from(this.groups.values()),
      players: Array.from(this.players.values()),
      matches: Array.from(this.matches.values()),
      qualificationRules: Array.from(this.qualificationRules.values()),
      slides: Array.from(this.slides.values()),
    };
  }

  public deserialize(data: MockDbState): void {
    this.tournaments.clear();
    this.sportRules.clear();
    this.days.clear();
    this.pitches.clear();
    this.stages.clear();
    this.groups.clear();
    this.players.clear();
    this.matches.clear();
    this.qualificationRules.clear();
    this.slides.clear();

    for (const t of data.tournaments ?? []) this.tournaments.set(t._id, t);
    for (const r of data.sportRules ?? []) this.sportRules.set(r._id, r);
    for (const d of data.days ?? []) this.days.set(d._id, d);
    for (const p of data.pitches ?? []) this.pitches.set(p._id, p);
    for (const s of data.stages ?? []) this.stages.set(s._id, s);
    for (const g of data.groups ?? []) this.groups.set(g._id, g);
    for (const pl of data.players ?? []) this.players.set(pl._id, pl);
    for (const m of data.matches ?? []) this.matches.set(m._id, m);
    for (const q of data.qualificationRules ?? []) this.qualificationRules.set(q._id, q);
    for (const sl of data.slides ?? []) this.slides.set(sl._id, sl);

    this.version = (data.version ?? 0) + 1;
    this.queryCache.clear();
  }

  public saveToStorage(): void {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const json = JSON.stringify(this.serialize());
        window.localStorage.setItem(LOCAL_STORAGE_MOCK_KEY, json);
      }
    } catch (e) {
      console.warn("[MockStore] Failed to save state to localStorage:", e);
    }
  }

  public loadFromStorage(): boolean {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const item = window.localStorage.getItem(LOCAL_STORAGE_MOCK_KEY);
        if (item) {
          const parsed = JSON.parse(item) as MockDbState;
          if (parsed && Array.isArray(parsed.tournaments) && parsed.tournaments.length > 0) {
            this.deserialize(parsed);
            return true;
          }
        }
      }
    } catch (e) {
      console.warn("[MockStore] Failed to load state from localStorage:", e);
    }
    return false;
  }

  public resetToDefaultSeed(): void {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.removeItem(LOCAL_STORAGE_MOCK_KEY);
      }
    } catch {
      // ignore
    }
    this.seedShowcaseFSS();
    this.notify();
  }

  // --- Showcase Seed Loader ---

  public seedShowcaseFSS(): void {
    this.tournaments.clear();
    this.sportRules.clear();
    this.days.clear();
    this.pitches.clear();
    this.stages.clear();
    this.groups.clear();
    this.players.clear();
    this.matches.clear();
    this.qualificationRules.clear();
    this.slides.clear();

    // 1. Tournament & Rules
    this.tournaments.set(FSS_SEED.tournament._id, { ...FSS_SEED.tournament });
    this.sportRules.set(FSS_SEED.sportRules._id, { ...FSS_SEED.sportRules });

    // 2. Days & Pitches
    for (const d of FSS_SEED.days) this.days.set(d._id, { ...d });
    for (const p of FSS_SEED.pitches) this.pitches.set(p._id, { ...p });

    // 3. Stages & Groups
    for (const s of FSS_SEED.stages) this.stages.set(s._id, { ...s });
    for (const g of FSS_SEED.groups) this.groups.set(g._id, { ...g });

    // 4. Players
    for (const pl of FSS_SEED.players) {
      this.players.set(pl._id, {
        _id: pl._id,
        _creationTime: pl._creationTime,
        tournamentId: pl.tournamentId,
        name: pl.name,
        secretCode: pl.secretCode,
        groupSlotIndex: pl.slotIndex,
        checkedIn: pl.checkedIn,
      });
    }

    // 5. Slides
    this.slides.set(FSS_SEED.slides._id, { ...FSS_SEED.slides });

    // 6. Generate Grupa A Berger Matches (9 players => 9 rounds x 4 matches = 36 matches)
    const rounds = generateBergerSchedule(9);
    const matchInputs: MatchInput[] = [];
    let matchCounter = 1;

    for (const r of rounds) {
      for (let mIdx = 0; mIdx < r.matches.length; mIdx++) {
        const m = r.matches[mIdx];
        const p1 = FSS_SEED.players[m.player1Slot];
        const p2 = FSS_SEED.players[m.player2Slot];
        matchInputs.push({
          id: `match_fss_ga_${matchCounter++}`,
          round: r.roundNumber,
          player1Id: p1._id,
          player2Id: p2._id,
          stageId: "stage_fss_group",
          groupId: "group_fss_a",
        });
      }
    }

    // Schedule matches across 5 dates and 2 pitches
    const pitchConfigs: PitchConfig[] = FSS_SEED.pitches.map((p) => ({
      id: p._id,
      name: p.name,
      order: p.order,
    }));
    const dayConfigs: DayConfig[] = FSS_SEED.days.map((d) => ({
      id: d._id,
      date: d.date,
      startTime: "18:00",
    }));

    const scheduled = scheduleTournamentMatches(matchInputs, pitchConfigs, dayConfigs, {
      matchDurationMinutes: 20,
      restIntervalMinutes: 10,
    });

    for (const sm of scheduled) {
      this.matches.set(sm.matchId, {
        _id: sm.matchId,
        _creationTime: Date.now(),
        tournamentId: "tourn_fss",
        stageId: "stage_fss_group",
        groupId: "group_fss_a",
        dayId: sm.dayId,
        pitchId: sm.pitchId,
        time: sm.startTime,
        endTime: sm.endTime,
        startTimestamp: sm.startTimestamp,
        endTimestamp: sm.endTimestamp,
        roundNumber: sm.round,
        player1Id: sm.player1Id,
        player2Id: sm.player2Id,
        sets: [],
        status: "pending",
      });
    }

    // Pre-complete a few opening round matches to show real-time scores in showcase
    const m1 = this.matches.get("match_fss_ga_1");
    if (m1) {
      m1.sets = [{ s1: 11, s2: 7 }, { s1: 11, s2: 9 }];
      m1.status = "completed";
      m1.winnerId = m1.player1Id;
    }

    const m2 = this.matches.get("match_fss_ga_2");
    if (m2) {
      m2.sets = [{ s1: 8, s2: 11 }, { s1: 11, s2: 6 }, { s1: 15, s2: 13 }];
      m2.status = "completed";
      m2.winnerId = m2.player1Id;
    }

    const m3 = this.matches.get("match_fss_ga_3");
    if (m3) {
      m3.sets = [{ s1: 9, s2: 11 }, { s1: 11, s2: 8 }];
      m3.status = "in_progress";
    }

    // 7. Knockout Stage Matches (Drabinka B: 2 Semifinals, 3rd place, Final = 4 matches)
    const koBracket = generateKnockoutBracket(4, true);
    for (const km of koBracket) {
      this.matches.set(km.id, {
        _id: km.id,
        _creationTime: Date.now(),
        tournamentId: "tourn_fss",
        stageId: "stage_fss_knockout",
        roundNumber: km.roundName === "semifinals" ? 1 : 2,
        roundName: km.roundName,
        player1Id: km.slot1.playerId ?? "",
        player2Id: km.slot2.playerId ?? "",
        sets: [],
        status: "pending",
        bracketRound: km.roundName,
        slot1Source: km.slot1.sourceRef,
        slot2Source: km.slot2.sourceRef,
      });
    }

    // 8. Qualification Rules (Top 4 of Grupa A -> Semifinals)
    const qRules: QualificationRuleDoc[] = [
      { _id: "qr_1", _creationTime: 1, tournamentId: "tourn_fss", sourceGroupId: "group_fss_a", sourceRank: 1, targetMatchId: "sf-1", targetSlot: "slot1" },
      { _id: "qr_2", _creationTime: 2, tournamentId: "tourn_fss", sourceGroupId: "group_fss_a", sourceRank: 4, targetMatchId: "sf-1", targetSlot: "slot2" },
      { _id: "qr_3", _creationTime: 3, tournamentId: "tourn_fss", sourceGroupId: "group_fss_a", sourceRank: 2, targetMatchId: "sf-2", targetSlot: "slot1" },
      { _id: "qr_4", _creationTime: 4, tournamentId: "tourn_fss", sourceGroupId: "group_fss_a", sourceRank: 3, targetMatchId: "sf-2", targetSlot: "slot2" },
    ];
    for (const qr of qRules) this.qualificationRules.set(qr._id, qr);
  }

  // --- Query Dispatcher ---

  public getQueryResult(queryName: string, args: any): any {
    const cacheKey = `${queryName}:${JSON.stringify(args ?? {})}`;
    if (this.queryCache.has(cacheKey)) {
      return this.queryCache.get(cacheKey);
    }

    const handler = mockQueryHandlers[queryName];
    if (!handler) {
      console.warn(`[MockStore] No query handler registered for "${queryName}"`);
      return undefined;
    }

    const result = handler(this, args ?? {});
    this.queryCache.set(cacheKey, result);
    return result;
  }

  // --- Mutation Dispatcher ---

  public async executeMutation(mutationName: string, args: any): Promise<any> {
    const handler = mockMutationHandlers[mutationName];
    if (!handler) {
      throw new Error(`[MockStore] No mutation handler registered for "${mutationName}"`);
    }

    const result = await handler(this, args ?? {});
    this.notify();
    return result;
  }
}

// ============================================================================
// 5. Mock Query Handlers
// ============================================================================

export const mockQueryHandlers: Record<string, (store: MockConvexStore, args: any) => any> = {
  "tournaments:getBySlug": (store, args: { slug: string }) => {
    const t = Array.from(store.tournaments.values()).find((item) => item.slug === args.slug);
    if (!t) return null;

    const sportRules = store.sportRules.get(t.sportRulesId) ??
      Array.from(store.sportRules.values()).find((r) => r.tournamentId === t._id) ?? {
        ...DEFAULT_SPORT_PRESETS.table_tennis,
        _id: "default_rules",
        _creationTime: Date.now(),
        pointsRule: "2_1_matrix" as PointsRule,
      };

    const days = Array.from(store.days.values())
      .filter((d) => d.tournamentId === t._id)
      .sort((a, b) => a.order - b.order);

    const pitches = Array.from(store.pitches.values())
      .filter((p) => p.tournamentId === t._id)
      .sort((a, b) => a.order - b.order);

    const stages = Array.from(store.stages.values())
      .filter((s) => s.tournamentId === t._id)
      .sort((a, b) => a.order - b.order);

    const groups = Array.from(store.groups.values())
      .filter((g) => g.tournamentId === t._id);

    const slides = Array.from(store.slides.values())
      .find((sl) => sl.tournamentId === t._id);

    const { adminSecret, ...publicTourn } = t;
    const full: FullTournamentData = {
      ...publicTourn,
      sportRules: sportRules!,
      days,
      pitches,
      stages,
      groups,
      slides,
    };
    return full;
  },

  "tournaments:getTournamentBundle": (store, args: { slug: string; adminSecret?: string }) => {
    const t = Array.from(store.tournaments.values()).find((item) => item.slug === args.slug);
    if (!t) return null;

    const isAdmin = Boolean(args.adminSecret && args.adminSecret === t.adminSecret);
    const sportRules = store.sportRules.get(t.sportRulesId) ??
      Array.from(store.sportRules.values()).find((r) => r.tournamentId === t._id);

    const days = Array.from(store.days.values())
      .filter((d) => d.tournamentId === t._id)
      .sort((a, b) => a.order - b.order);

    const pitches = Array.from(store.pitches.values())
      .filter((p) => p.tournamentId === t._id)
      .sort((a, b) => a.order - b.order);

    const stages = Array.from(store.stages.values())
      .filter((s) => s.tournamentId === t._id)
      .sort((a, b) => a.order - b.order);

    const groups = Array.from(store.groups.values())
      .filter((g) => g.tournamentId === t._id);

    const slides = Array.from(store.slides.values())
      .find((sl) => sl.tournamentId === t._id);

    const { adminSecret, ...publicTourn } = t;

    return {
      tournament: isAdmin ? t : publicTourn,
      isAdmin,
      sportRules,
      days,
      pitches,
      stages,
      groups,
      slides,
    };
  },

  "tournaments:list": (store) => {
    return Array.from(store.tournaments.values());
  },

  "tournaments:verifyAdminSecret": (store, args: { slug: string; adminSecret: string }) => {
    const t = Array.from(store.tournaments.values()).find((item) => item.slug === args.slug);
    if (!t) return { isValid: false, valid: false };
    const isValid = t.adminSecret === args.adminSecret;
    return {
      isValid,
      valid: isValid,
      tournament: isValid ? t : undefined,
      tournamentId: isValid ? t._id : undefined,
      name: isValid ? t.name : undefined,
    };
  },

  "players:listByTournament": (store, args: { tournamentId: string }) => {
    return Array.from(store.players.values())
      .filter((p) => p.tournamentId === args.tournamentId)
      .sort((a, b) => a.groupSlotIndex - b.groupSlotIndex);
  },

  "players:getBySecret": (store, args: { secretCode: string }) => {
    const player = Array.from(store.players.values()).find((p) => p.secretCode === args.secretCode);
    if (!player) return null;

    const tournament = store.tournaments.get(player.tournamentId);
    if (!tournament) return null;

    const sportRules = store.sportRules.get(tournament.sportRulesId) ??
      Array.from(store.sportRules.values()).find((r) => r.tournamentId === tournament._id);

    const matches = Array.from(store.matches.values())
      .filter((m) => m.tournamentId === player.tournamentId && (m.player1Id === player._id || m.player2Id === player._id))
      .sort((a, b) => a.roundNumber - b.roundNumber);

    const enrichedMatches: EnrichedMatchDoc[] = matches.map((m) => ({
      ...m,
      player1: store.players.get(m.player1Id),
      player2: store.players.get(m.player2Id),
      pitch: m.pitchId ? store.pitches.get(m.pitchId) : undefined,
      day: m.dayId ? store.days.get(m.dayId) : undefined,
    }));

    return {
      player,
      tournament,
      sportRules,
      matches: enrichedMatches,
    };
  },

  "matches:listByTournament": (store, args: { tournamentId: string; stageId?: string; groupId?: string; dayId?: string; pitchId?: string; adminSecret?: string }) => {
    let list = Array.from(store.matches.values()).filter((m) => m.tournamentId === args.tournamentId);

    if (args.stageId) list = list.filter((m) => m.stageId === args.stageId);
    if (args.groupId) list = list.filter((m) => m.groupId === args.groupId);
    if (args.dayId) list = list.filter((m) => m.dayId === args.dayId);
    if (args.pitchId) list = list.filter((m) => m.pitchId === args.pitchId);

    const tournament = store.tournaments.get(args.tournamentId);
    const isAdmin = Boolean(args.adminSecret && tournament && tournament.adminSecret === args.adminSecret);

    const sanitizePlayer = (p?: PlayerDoc): PlayerDoc | undefined => {
      if (!p) return undefined;
      if (isAdmin) return p;
      const { secretCode, ...safe } = p;
      return safe as PlayerDoc;
    };

    return list.map((m): EnrichedMatchDoc => ({
      ...m,
      player1: sanitizePlayer(store.players.get(m.player1Id)),
      player2: sanitizePlayer(store.players.get(m.player2Id)),
      pitch: m.pitchId ? store.pitches.get(m.pitchId) : undefined,
      day: m.dayId ? store.days.get(m.dayId) : undefined,
    }));
  },

  "matches:getById": (store, args: { matchId: string }) => {
    const m = store.matches.get(args.matchId);
    if (!m) return null;
    const enriched: EnrichedMatchDoc = {
      ...m,
      player1: store.players.get(m.player1Id),
      player2: store.players.get(m.player2Id),
      pitch: m.pitchId ? store.pitches.get(m.pitchId) : undefined,
      day: m.dayId ? store.days.get(m.dayId) : undefined,
    };
    return enriched;
  },

  "matches:getMatchesForPlayer": (store, args: { tournamentId: string; playerId: string }) => {
    const matches = Array.from(store.matches.values()).filter((m) => m.tournamentId === args.tournamentId);
    const playerMatches = matches.filter((m) => m.player1Id === args.playerId || m.player2Id === args.playerId);

    const sanitizePlayer = (p?: PlayerDoc): PlayerDoc | undefined => {
      if (!p) return undefined;
      const { secretCode, ...safe } = p;
      return safe as PlayerDoc;
    };

    const enriched = playerMatches.map((m) => {
      const isP1 = m.player1Id === args.playerId;
      const oppId = isP1 ? m.player2Id : m.player1Id;
      return {
        ...m,
        player1: isP1 ? store.players.get(m.player1Id) : sanitizePlayer(store.players.get(m.player1Id)),
        player2: !isP1 ? store.players.get(m.player2Id) : sanitizePlayer(store.players.get(m.player2Id)),
        opponent: oppId ? sanitizePlayer(store.players.get(oppId)) : undefined,
        pitch: m.pitchId ? store.pitches.get(m.pitchId) : undefined,
        day: m.dayId ? store.days.get(m.dayId) : undefined,
        isPlayer1: isP1,
      };
    });

    const upcomingMatch = enriched
      .filter((m) => m.status !== "completed")
      .sort((a, b) => a.roundNumber - b.roundNumber)[0] || null;

    const allRounds = new Set(matches.map((m) => m.roundNumber));
    const playerRounds = new Set(playerMatches.map((m) => m.roundNumber));
    const byeRounds = Array.from(allRounds).filter((r) => !playerRounds.has(r)).sort((a, b) => a - b);

    return {
      upcomingMatch,
      matches: enriched,
      byeRounds,
    };
  },

  "standings:getGroupStandings": (store, args: { tournamentId?: string; groupId?: string; pointsRuleOverride?: PointsRule }) => {
    let tournamentId = args.tournamentId;
    if (!tournamentId && args.groupId) {
      const g = store.groups.get(args.groupId);
      if (g) tournamentId = g.tournamentId;
    }
    if (!tournamentId) {
      const firstTourn = Array.from(store.tournaments.values())[0];
      if (firstTourn) tournamentId = firstTourn._id;
    }
    if (!tournamentId) return [];

    const tournament = store.tournaments.get(tournamentId);
    if (!tournament) return [];

    const sportRules = store.sportRules.get(tournament.sportRulesId) ??
      Array.from(store.sportRules.values()).find((r) => r.tournamentId === tournament._id) ?? {
        ...DEFAULT_SPORT_PRESETS.table_tennis,
        _id: "default_rules",
        _creationTime: 1,
        pointsRule: "2_1_matrix" as PointsRule,
      };

    const allPlayers = Array.from(store.players.values())
      .filter((p) => p.tournamentId === tournamentId);

    const matchPlayerIds = new Set<string>();
    const groupMatches = Array.from(store.matches.values()).filter(
      (m) => m.tournamentId === tournamentId && (!args.groupId || m.groupId === args.groupId)
    );
    for (const m of groupMatches) {
      if (m.player1Id) matchPlayerIds.add(m.player1Id);
      if (m.player2Id) matchPlayerIds.add(m.player2Id);
    }

    const anyHasGroupId = allPlayers.some((p: any) => p.groupId !== undefined);
    let players: PlayerDoc[];
    if (args.groupId && anyHasGroupId) {
      players = allPlayers.filter((p: any) => p.groupId === args.groupId || matchPlayerIds.has(p._id));
    } else if (args.groupId && matchPlayerIds.size > 0) {
      players = allPlayers.filter((p) => matchPlayerIds.has(p._id));
    } else {
      players = allPlayers;
    }

    players.sort((a, b) => a.groupSlotIndex - b.groupSlotIndex);
    const playerIds = players.map((p) => p._id);

    const completedMatches = groupMatches.filter((m) => m.status !== "pending");

    const matchInputs: MatchResultInput[] = completedMatches.map((m) => ({
      player1Id: m.player1Id,
      player2Id: m.player2Id,
      sets: m.sets,
      status: m.status,
      winnerId: m.winnerId,
    }));

    const pointsRule = args.pointsRuleOverride ?? sportRules.pointsRule;
    const standings = calculateStandings(playerIds, matchInputs, pointsRule);

    const enriched: EnrichedStanding[] = standings.map((st) => {
      const p = store.players.get(st.playerId);
      return {
        ...st,
        player: p,
        name: p?.name ?? "Nieznany",
        groupSlotIndex: p?.groupSlotIndex ?? 0,
        checkedIn: p?.checkedIn ?? false,
      };
    });

    return enriched;
  },

  "standings:getTournamentStandings": (store, args: { tournamentId: string }) => {
    const groups = Array.from(store.groups.values()).filter((g) => g.tournamentId === args.tournamentId);
    const result: Record<string, { groupName: string; standings: any[] }> = {};
    for (const g of groups) {
      result[g._id] = {
        groupName: g.name,
        standings: mockQueryHandlers["standings:getGroupStandings"](store, { tournamentId: args.tournamentId, groupId: g._id }),
      };
    }
    return result;
  },

  "slides:getSlideConfig": (store, args: { tournamentId: string }) => {
    return Array.from(store.slides.values()).find((s) => s.tournamentId === args.tournamentId) ?? null;
  },

  "slides:getPresenterData": (store, args: { slug: string }) => {
    const t = Array.from(store.tournaments.values()).find((item) => item.slug === args.slug);
    if (!t) return null;

    const slideConfig = Array.from(store.slides.values()).find((sl) => sl.tournamentId === t._id) || {
      rotationIntervalSeconds: 10,
      announcementText: "Witaj w Mistrzostwach Verso!",
      activeSlides: ["standings", "matches", "announcements"],
    };

    const matches = Array.from(store.matches.values()).filter((m) => m.tournamentId === t._id);

    const inProgress = matches
      .filter((m) => m.status === "in_progress")
      .map((m) => ({
        ...m,
        player1: store.players.get(m.player1Id),
        player2: store.players.get(m.player2Id),
        pitch: m.pitchId ? store.pitches.get(m.pitchId) : undefined,
      }));

    const upcoming = matches
      .filter((m) => m.status === "pending")
      .sort((a, b) => a.roundNumber - b.roundNumber)
      .slice(0, 6)
      .map((m) => ({
        ...m,
        player1: store.players.get(m.player1Id),
        player2: store.players.get(m.player2Id),
        pitch: m.pitchId ? store.pitches.get(m.pitchId) : undefined,
      }));

    const group = Array.from(store.groups.values()).find((g) => g.tournamentId === t._id);
    const standings = group
      ? mockQueryHandlers["standings:getGroupStandings"](store, { tournamentId: t._id, groupId: group._id })
      : [];

    return {
      tournament: { name: t.name, slug: t.slug },
      slideConfig,
      inProgressMatches: inProgress,
      upcomingMatches: upcoming,
      standings,
    };
  },
};

// ============================================================================
// 6. Mock Mutation Handlers
// ============================================================================

function propagateKnockoutResultInMockStore(
  store: MockConvexStore,
  tournamentId: string,
  sourceMatchId: string,
  winnerId?: string,
  loserId?: string
) {
  const sourceMatch = store.matches.get(sourceMatchId);
  const sourceRef = sourceMatch?.knockoutMatchId || sourceMatchId;

  for (const m of store.matches.values()) {
    if (m._id === sourceMatchId || m.tournamentId !== tournamentId) continue;

    if (m.slot1Source) {
      const ref = typeof m.slot1Source === "object" ? m.slot1Source.sourceRef : m.slot1Source;
      const type = typeof m.slot1Source === "object" ? m.slot1Source.sourceType : "winner_of";
      if (ref === sourceRef || ref === sourceMatchId || (sourceMatch?.knockoutMatchId && ref === sourceMatch.knockoutMatchId)) {
        if (type === "winner_of" && winnerId) m.player1Id = winnerId;
        else if (type === "loser_of" && loserId) m.player1Id = loserId;
      }
    }

    if (m.slot2Source) {
      const ref = typeof m.slot2Source === "object" ? m.slot2Source.sourceRef : m.slot2Source;
      const type = typeof m.slot2Source === "object" ? m.slot2Source.sourceType : "winner_of";
      if (ref === sourceRef || ref === sourceMatchId || (sourceMatch?.knockoutMatchId && ref === sourceMatch.knockoutMatchId)) {
        if (type === "winner_of" && winnerId) m.player2Id = winnerId;
        else if (type === "loser_of" && loserId) m.player2Id = loserId;
      }
    }
  }
}

export const mockMutationHandlers: Record<string, (store: MockConvexStore, args: any) => Promise<any>> = {
  "tournaments:create": async (
    store,
    args: {
      name: string;
      slug?: string;
      adminSecret?: string;
      sportPreset?: SportPreset;
      customRules?: Partial<SportRulesConfig>;
      sportRules?: Partial<SportRulesConfig>;
      days?: any[];
      pitches?: any[];
      allowPlayerScoreSubmission?: boolean;
    }
  ) => {
    const tournamentId = generateId("tourn");
    const slug = args.slug ? slugify(args.slug) : slugify(args.name);
    const adminSecret = args.adminSecret || generateSecret("adm");
    const rulesId = generateId("rules");

    const presetKey = args.sportPreset ?? "table_tennis";
    const baseRules = DEFAULT_SPORT_PRESETS[presetKey] ?? DEFAULT_SPORT_PRESETS.table_tennis;
    const rulesInput = args.sportRules ?? args.customRules ?? {};
    const finalRules: SportRulesDoc = {
      _id: rulesId,
      _creationTime: Date.now(),
      tournamentId,
      ...baseRules,
      ...rulesInput,
      pointsRule: (rulesInput as any)?.pointsRule ?? (presetKey === "table_tennis" ? "2_1_matrix" : "standard_3_1_0"),
    };
    store.sportRules.set(rulesId, finalRules);

    const tournament: TournamentDoc = {
      _id: tournamentId,
      _creationTime: Date.now(),
      slug,
      name: args.name,
      adminSecret,
      sportRulesId: rulesId,
      allowPlayerScoreSubmission: args.allowPlayerScoreSubmission ?? true,
      createdAt: Date.now(),
    };
    store.tournaments.set(tournamentId, tournament);

    // Days
    const dayDates = args.days && args.days.length > 0
      ? args.days.map((d: any) => (typeof d === "string" ? d : d.date))
      : [new Date().toISOString().split("T")[0]];
    dayDates.forEach((date, idx) => {
      const dayId = generateId("day");
      store.days.set(dayId, {
        _id: dayId,
        _creationTime: Date.now(),
        tournamentId,
        date,
        order: idx + 1,
      });
    });

    // Pitches
    const pitchNames = args.pitches && args.pitches.length > 0
      ? args.pitches.map((p: any) => (typeof p === "string" ? p : p.name))
      : ["Stół 1", "Stół 2"];
    pitchNames.forEach((name, idx) => {
      const pitchId = generateId("pitch");
      store.pitches.set(pitchId, {
        _id: pitchId,
        _creationTime: Date.now(),
        tournamentId,
        name,
        order: idx + 1,
      });
    });

    // Default Group Stage & Group
    const stageGroupId = generateId("stage_group");
    store.stages.set(stageGroupId, {
      _id: stageGroupId,
      _creationTime: Date.now(),
      tournamentId,
      type: "group",
      name: "Faza Grupowa",
      order: 1,
    });

    const groupId = generateId("group");
    store.groups.set(groupId, {
      _id: groupId,
      _creationTime: Date.now(),
      stageId: stageGroupId,
      tournamentId,
      name: "Grupa A",
    });

    // Default Knockout Stage
    const stageKoId = generateId("stage_ko");
    store.stages.set(stageKoId, {
      _id: stageKoId,
      _creationTime: Date.now(),
      tournamentId,
      type: "knockout",
      name: "Faza Pucharowa",
      order: 2,
    });

    // Default Slides
    const slideId = generateId("slide");
    store.slides.set(slideId, {
      _id: slideId,
      _creationTime: Date.now(),
      tournamentId,
      rotationIntervalSeconds: 10,
      announcementText: `Witaj w turnieju ${args.name}!`,
      activeSlides: ["standings", "matches", "announcements"],
    });

    return { tournamentId, slug, adminSecret };
  },

  "tournaments:updateSettings": async (
    store,
    args: {
      tournamentId: string;
      adminSecret: string;
      name?: string;
      allowPlayerScoreSubmission?: boolean;
      sportRules?: Partial<SportRulesConfig>;
    }
  ) => {
    const t = store.tournaments.get(args.tournamentId);
    if (!t) throw new Error("Tournament not found");
    if (t.adminSecret !== args.adminSecret) throw new Error("Invalid admin secret");

    if (args.name !== undefined) t.name = args.name;
    if (args.allowPlayerScoreSubmission !== undefined) t.allowPlayerScoreSubmission = args.allowPlayerScoreSubmission;

    if (args.sportRules) {
      const r = store.sportRules.get(t.sportRulesId);
      if (r) {
        Object.assign(r, args.sportRules);
      }
    }
    return t;
  },

  "players:create": async (
    store,
    args: { tournamentId: string; adminSecret?: string; name: string; groupSlotIndex?: number; secretCode?: string }
  ) => {
    const existingCount = Array.from(store.players.values()).filter((p) => p.tournamentId === args.tournamentId).length;
    const playerId = generateId("p");
    const secretCode = args.secretCode || generateSecret(`sec-${slugify(args.name).slice(0, 8)}`);

    const player: PlayerDoc = {
      _id: playerId,
      _creationTime: Date.now(),
      tournamentId: args.tournamentId,
      name: args.name,
      secretCode,
      groupSlotIndex: args.groupSlotIndex ?? existingCount,
      checkedIn: false,
    };
    store.players.set(playerId, player);
    return { playerId, secretCode, groupSlotIndex: player.groupSlotIndex, player };
  },

  "players:bulkCreate": async (
    store,
    args: { tournamentId: string; adminSecret?: string; names?: string[]; players?: { name: string; secretCode?: string; groupSlotIndex?: number }[] }
  ) => {
    const existingCount = Array.from(store.players.values()).filter((p) => p.tournamentId === args.tournamentId).length;
    const created: PlayerDoc[] = [];

    const items: { name: string; secretCode?: string; groupSlotIndex?: number }[] = args.players
      ? args.players
      : (args.names ?? []).map((name, idx) => ({ name, groupSlotIndex: existingCount + idx }));

    items.forEach((item, idx) => {
      const playerId = generateId("p");
      const secretCode = item.secretCode || generateSecret(`sec-${slugify(item.name).slice(0, 8)}`);
      const player: PlayerDoc = {
        _id: playerId,
        _creationTime: Date.now(),
        tournamentId: args.tournamentId,
        name: item.name,
        secretCode,
        groupSlotIndex: item.groupSlotIndex ?? (existingCount + idx),
        checkedIn: false,
      };
      store.players.set(playerId, player);
      created.push(player);
    });

    return { createdCount: created.length, playerIds: created.map((p) => p._id), players: created };
  },

  "players:toggleCheckIn": async (
    store,
    args: { playerId: string; checkedIn?: boolean; adminSecret?: string; playerSecret?: string }
  ) => {
    const player = store.players.get(args.playerId);
    if (!player) throw new Error("Player not found");
    const nextStatus = args.checkedIn !== undefined ? args.checkedIn : !player.checkedIn;
    player.checkedIn = nextStatus;
    return { success: true, checkedIn: nextStatus, player };
  },

  "players:delete": async (
    store,
    args: { playerId: string; adminSecret: string }
  ) => {
    const player = store.players.get(args.playerId);
    if (!player) throw new Error("Player not found");
    const t = store.tournaments.get(player.tournamentId);
    if (!t || t.adminSecret !== args.adminSecret) throw new Error("Unauthorized");
    store.players.delete(args.playerId);
    return { success: true };
  },

  "players:deletePlayer": async (
    store,
    args: { playerId: string; adminSecret: string }
  ) => {
    return mockMutationHandlers["players:delete"](store, args);
  },

  "matches:generateFromSchedule": async (
    store,
    args: {
      tournamentId: string;
      adminSecret?: string;
      stageId?: string;
      groupId?: string;
      autoSchedulePitchesAndTime?: boolean;
      matchDurationMinutes?: number;
      restIntervalMinutes?: number;
    }
  ) => {
    const players = Array.from(store.players.values())
      .filter((p) => p.tournamentId === args.tournamentId)
      .sort((a, b) => a.groupSlotIndex - b.groupSlotIndex);

    if (players.length < 2) {
      throw new Error("Cannot generate schedule with fewer than 2 participants");
    }

    const stages = Array.from(store.stages.values()).filter((s) => s.tournamentId === args.tournamentId);
    const targetStage = args.stageId
      ? store.stages.get(args.stageId)
      : stages.find((s) => s.type === "group") ?? stages[0];

    if (!targetStage) throw new Error("No stage found");

    const groups = Array.from(store.groups.values()).filter((g) => g.stageId === targetStage._id);
    const targetGroup = args.groupId ? store.groups.get(args.groupId) : groups[0];

    const rounds = generateBergerSchedule(players.length);
    const matchInputs: MatchInput[] = [];

    for (const r of rounds) {
      for (const m of r.matches) {
        matchInputs.push({
          id: generateId("m"),
          round: r.roundNumber,
          player1Id: players[m.player1Slot]._id,
          player2Id: players[m.player2Slot]._id,
          stageId: targetStage._id,
          groupId: targetGroup?._id,
        });
      }
    }

    const pitches: PitchConfig[] = Array.from(store.pitches.values())
      .filter((p) => p.tournamentId === args.tournamentId)
      .sort((a, b) => a.order - b.order)
      .map((p) => ({ id: p._id, name: p.name, order: p.order }));

    const days: DayConfig[] = Array.from(store.days.values())
      .filter((d) => d.tournamentId === args.tournamentId)
      .sort((a, b) => a.order - b.order)
      .map((d) => ({ id: d._id, date: d.date, startTime: "18:00" }));

    const scheduled = scheduleTournamentMatches(matchInputs, pitches, days, {
      matchDurationMinutes: args.matchDurationMinutes ?? 20,
      restIntervalMinutes: args.restIntervalMinutes ?? 10,
    });

    // Remove existing matches in this stage/group
    for (const [mId, m] of store.matches.entries()) {
      if (m.tournamentId === args.tournamentId && m.stageId === targetStage._id) {
        store.matches.delete(mId);
      }
    }

    for (const sm of scheduled) {
      store.matches.set(sm.matchId, {
        _id: sm.matchId,
        _creationTime: Date.now(),
        tournamentId: args.tournamentId,
        stageId: targetStage._id,
        groupId: targetGroup?._id,
        dayId: sm.dayId,
        pitchId: sm.pitchId,
        time: sm.startTime,
        endTime: sm.endTime,
        startTimestamp: sm.startTimestamp,
        endTimestamp: sm.endTimestamp,
        roundNumber: sm.round,
        player1Id: sm.player1Id,
        player2Id: sm.player2Id,
        sets: [],
        status: "pending",
      });
    }

    return {
      generatedCount: scheduled.length,
      roundsCount: rounds.length,
      matches: scheduled,
    };
  },

  "matches:updateScore": async (
    store,
    args: {
      matchId: string;
      sets: { s1: number; s2: number }[];
      adminSecret?: string;
      refereeSecret?: string;
    }
  ) => {
    const match = store.matches.get(args.matchId);
    if (!match) throw new Error("Match not found");

    const tournament = store.tournaments.get(match.tournamentId);
    if (!tournament) throw new Error("Tournament not found");

    const isAdmin = Boolean(args.adminSecret && args.adminSecret === tournament.adminSecret);
    let isReferee = false;
    if (args.refereeSecret && args.refereeSecret.length > 0) {
      if (tournament.refereeSecret && args.refereeSecret === tournament.refereeSecret) {
        isReferee = true;
      } else {
        const pitches = Array.from(store.pitches.values()).filter(
          (p) => p.tournamentId === tournament._id
        );
        isReferee = pitches.some(
          (p) => p.refereeSecret && p.refereeSecret === args.refereeSecret
        );
      }
    }
    if (!isAdmin && !isReferee) {
      throw new Error("Unauthorized: Requires Admin or Referee authorization");
    }

    const rules = store.sportRules.get(tournament.sportRulesId) ??
      Array.from(store.sportRules.values()).find((r) => r.tournamentId === tournament._id) ??
      DEFAULT_SPORT_PRESETS.table_tennis;

    const validation = validateMatchScore(args.sets, rules);
    if (!validation.isValid) {
      throw new Error(validation.error ?? "Invalid score format");
    }

    match.sets = args.sets;
    if (validation.isMatchCompleted) {
      match.status = "completed";
      match.winnerId = validation.winner === 1 ? match.player1Id : match.player2Id;
      match.loserId = validation.winner === 1 ? match.player2Id : match.player1Id;
      propagateKnockoutResultInMockStore(store, tournament._id, match._id, match.winnerId, match.loserId);
    } else if (args.sets.length > 0) {
      match.status = "in_progress";
      match.winnerId = undefined;
      match.loserId = undefined;
    } else {
      match.status = "pending";
      match.winnerId = undefined;
      match.loserId = undefined;
    }

    return match;
  },

  "matches:submitPlayerScore": async (
    store,
    args: {
      matchId: string;
      playerSecret: string;
      sets: { s1: number; s2: number }[];
    }
  ) => {
    const match = store.matches.get(args.matchId);
    if (!match) throw new Error("Match not found");

    const tournament = store.tournaments.get(match.tournamentId);
    if (!tournament) throw new Error("Tournament not found");

    if (!tournament.allowPlayerScoreSubmission) {
      throw new Error("Player score submission is disabled by tournament organizer");
    }

    const player = Array.from(store.players.values()).find((p) => p.secretCode === args.playerSecret);
    if (!player) {
      throw new Error("Invalid player secret code");
    }

    if (player._id !== match.player1Id && player._id !== match.player2Id) {
      throw new Error("Player cannot submit scores for matches they are not participating in");
    }

    if (match.status === "completed") {
      throw new Error("Player cannot overwrite completed/verified match score; contact referee");
    }

    const rules = store.sportRules.get(tournament.sportRulesId) ?? DEFAULT_SPORT_PRESETS.table_tennis;
    const validation = validateMatchScore(args.sets, rules);
    if (!validation.isValid) {
      throw new Error(validation.error ?? "Invalid score");
    }

    match.sets = args.sets;
    if (validation.isMatchCompleted) {
      match.status = "completed";
      match.winnerId = validation.winner === 1 ? match.player1Id : match.player2Id;
      match.loserId = validation.winner === 1 ? match.player2Id : match.player1Id;
      propagateKnockoutResultInMockStore(store, tournament._id, match._id, match.winnerId, match.loserId);
    } else if (args.sets.length > 0) {
      match.status = "in_progress";
    }

    return match;
  },

  "matches:setWalkover": async (
    store,
    args: {
      matchId: string;
      winnerPlayerId?: string;
      winnerId?: string;
      adminSecret?: string;
      refereeSecret?: string;
      reason?: string;
    }
  ) => {
    const match = store.matches.get(args.matchId);
    if (!match) throw new Error("Match not found");

    const tournament = store.tournaments.get(match.tournamentId);
    if (!tournament) throw new Error("Tournament not found");

    const isAdmin = Boolean(args.adminSecret && args.adminSecret === tournament.adminSecret);
    let isReferee = false;
    if (args.refereeSecret && args.refereeSecret.length > 0) {
      if (tournament.refereeSecret && args.refereeSecret === tournament.refereeSecret) {
        isReferee = true;
      } else {
        const pitches = Array.from(store.pitches.values()).filter(
          (p) => p.tournamentId === tournament._id
        );
        isReferee = pitches.some(
          (p) => p.refereeSecret && p.refereeSecret === args.refereeSecret
        );
      }
    }
    if (!isAdmin && !isReferee) {
      throw new Error("Unauthorized: Requires Admin or Referee authorization");
    }

    const winnerId = args.winnerPlayerId ?? args.winnerId;
    if (!winnerId) {
      throw new Error("Winner player ID is required");
    }

    if (winnerId !== match.player1Id && winnerId !== match.player2Id) {
      throw new Error("Winner must be player1 or player2");
    }

    const rules = store.sportRules.get(tournament.sportRulesId) ?? DEFAULT_SPORT_PRESETS.table_tennis;
    const targetPoints = rules.targetPointsPerUnit;
    const setsToWin = rules.unitsToWinMatch;

    const isP1 = winnerId === match.player1Id;
    const walkoverSets = [];
    for (let i = 0; i < setsToWin; i++) {
      walkoverSets.push(
        isP1
          ? { s1: targetPoints, s2: 0 }
          : { s1: 0, s2: targetPoints }
      );
    }

    match.sets = walkoverSets;
    match.status = "completed";
    match.winnerId = winnerId;
    match.loserId = isP1 ? match.player2Id : match.player1Id;
    match.walkover = true;
    match.walkoverWinnerId = winnerId;

    propagateKnockoutResultInMockStore(store, tournament._id, match._id, match.winnerId, match.loserId);

    return match;
  },

  "matches:generateKnockoutStage": async (
    store,
    args: {
      tournamentId: string;
      adminSecret: string;
      stageName?: string;
      qualifierCount: number;
      includeThirdPlace?: boolean;
    }
  ) => {
    const stageId = generateId("stage_ko");
    store.stages.set(stageId, {
      _id: stageId,
      _creationTime: Date.now(),
      tournamentId: args.tournamentId,
      type: "knockout",
      name: args.stageName ?? "Faza Pucharowa",
      order: store.stages.size + 1,
    });

    const koMatches = generateKnockoutBracket(args.qualifierCount, args.includeThirdPlace ?? true);
    for (const km of koMatches) {
      const matchDocId = `${stageId}_${km.id}`;
      store.matches.set(matchDocId, {
        _id: matchDocId,
        _creationTime: Date.now(),
        tournamentId: args.tournamentId,
        stageId,
        roundNumber: km.roundName === "quarterfinals" ? 1 : km.roundName === "semifinals" ? 2 : 3,
        roundName: km.roundName,
        knockoutMatchId: km.id,
        player1Id: km.slot1?.playerId ?? "",
        player2Id: km.slot2?.playerId ?? "",
        sets: [],
        status: "pending",
        bracketRound: km.roundName,
        slot1Source: km.slot1?.sourceRef,
        slot2Source: km.slot2?.sourceRef,
      });
    }

    return { stageId, matchCount: koMatches.length };
  },

  "slides:updateSlideConfig": async (
    store,
    args: {
      tournamentId: string;
      adminSecret: string;
      rotationIntervalSeconds?: number;
      announcementText?: string;
      activeSlides?: ("standings" | "matches" | "announcements" | "announcement")[];
    }
  ) => {
    const t = store.tournaments.get(args.tournamentId);
    if (!t || t.adminSecret !== args.adminSecret) throw new Error("Unauthorized");

    let slide = Array.from(store.slides.values()).find((s) => s.tournamentId === args.tournamentId);
    if (!slide) {
      slide = {
        _id: generateId("slide"),
        _creationTime: Date.now(),
        tournamentId: args.tournamentId,
        rotationIntervalSeconds: args.rotationIntervalSeconds ?? 10,
        announcementText: args.announcementText,
        activeSlides: args.activeSlides ?? ["standings", "matches", "announcements"],
      };
      store.slides.set(slide._id, slide);
    } else {
      if (args.rotationIntervalSeconds !== undefined) slide.rotationIntervalSeconds = args.rotationIntervalSeconds;
      if (args.announcementText !== undefined) slide.announcementText = args.announcementText;
      if (args.activeSlides !== undefined) slide.activeSlides = args.activeSlides;
    }

    return slide;
  },

  "seed:restoreFssShowcase": async (store) => {
    store.seedShowcaseFSS();
    return {
      success: true,
      tournamentId: FSS_SEED.tournament._id,
      slug: FSS_SEED.tournament.slug,
      adminSecret: FSS_SEED.tournament.adminSecret,
      playersCount: 9,
      matchesCount: 40,
    };
  },

  "seed:restoreShowcase": async (store, _args: { slug?: string } = {}) => {
    store.seedShowcaseFSS();
    return { success: true, slug: FSS_SEED.tournament.slug };
  },

  "seed:resetAll": async (store) => {
    store.resetToDefaultSeed();
    return { success: true };
  },
};

// ============================================================================
// 7. Singleton Mock Store & React Context
// ============================================================================

let globalMockStoreInstance: MockConvexStore | null = null;

export function getMockStore(): MockConvexStore {
  if (!globalMockStoreInstance) {
    globalMockStoreInstance = new MockConvexStore(true);
  }
  return globalMockStoreInstance;
}

export function resetMockStore(): MockConvexStore {
  const store = getMockStore();
  store.resetToDefaultSeed();
  return store;
}

const MockStoreContext = createContext<MockConvexStore | null>(null);

export function useMockStore(): MockConvexStore {
  const store = useContext(MockStoreContext);
  return store ?? getMockStore();
}

// ============================================================================
// 8. Convex Mode Detection & Unified React Hooks
// ============================================================================

// Detect if a live Convex URL was provided in environment
const rawConvexUrl =
  (typeof process !== "undefined" ? process.env?.VITE_CONVEX_URL : undefined) ??
  (typeof import.meta !== "undefined" ? (import.meta as any).env?.VITE_CONVEX_URL : undefined);

export const IS_REAL_CONVEX = Boolean(
  typeof rawConvexUrl === "string" &&
  rawConvexUrl.trim().length > 0 &&
  rawConvexUrl.startsWith("http")
);

let realConvexClient: ConvexReactClient | null = null;
if (IS_REAL_CONVEX) {
  realConvexClient = new ConvexReactClient(rawConvexUrl!.trim());
}

/**
 * Extracts normalized string name from Convex function reference, api proxy, or string.
 */
export function resolveFunctionName(ref: any): string {
  if (typeof ref === "string") return ref;
  if (!ref) return "";
  try {
    return getFunctionName(ref);
  } catch {
    return String(ref);
  }
}

/**
 * Reactive query hook for Mock Store.
 * Uses React 18 useSyncExternalStore for tear-free, concurrent-safe live updates.
 */
function useMockQueryInternal<T = any>(queryRef: any, ...args: any[]): T | undefined {
  const store = useMockStore();
  const rawArgs = args[0];
  const isSkip = rawArgs === "skip";
  const queryName = resolveFunctionName(queryRef);

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (isSkip) return () => {};
      return store.subscribe(onStoreChange);
    },
    [store, isSkip]
  );

  const getSnapshot = useCallback(() => {
    if (isSkip) return undefined;
    return store.getQueryResult(queryName, rawArgs);
  }, [store, queryName, rawArgs, isSkip]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Mutation hook for Mock Store.
 */
function useMockMutationInternal<TArgs = any, TReturn = any>(
  mutationRef: any
): (args: TArgs) => Promise<TReturn> {
  const store = useMockStore();
  const mutationName = resolveFunctionName(mutationRef);

  return useCallback(
    async (args: TArgs): Promise<TReturn> => {
      return store.executeMutation(mutationName, args);
    },
    [store, mutationName]
  );
}

// ============================================================================
// 9. Exported Universal Client Provider & Hooks
// ============================================================================

export interface ConvexClientProviderProps {
  children: ReactNode;
  mockStore?: MockConvexStore;
}

/**
 * Top-level React Provider.
 * Automatically wraps children in ConvexProvider if VITE_CONVEX_URL is present,
 * or MockStoreContext with reactive pub/sub if absent or offline.
 */
export function ConvexClientProvider({ children, mockStore }: ConvexClientProviderProps): React.ReactElement {
  if (IS_REAL_CONVEX && realConvexClient) {
    return React.createElement(ConvexProvider, { client: realConvexClient }, children);
  }

  const store = mockStore ?? getMockStore();
  return React.createElement(MockStoreContext.Provider, { value: store }, children);
}

/**
 * Reactive useQuery hook.
 * Drop-in replacement matching Convex's reactive semantics.
 */
export function useQuery<T = any>(query: any, ...args: any[]): T | undefined {
  if (IS_REAL_CONVEX) {
    return convexUseQuery(query, ...(args as [any]));
  }
  return useMockQueryInternal<T>(query, ...args);
}

/**
 * Reactive useMutation hook.
 * Drop-in replacement matching Convex's mutation execution semantics.
 */
export function useMutation<TArgs = any, TReturn = any>(
  mutation: any
): (args: TArgs) => Promise<TReturn> {
  if (IS_REAL_CONVEX) {
    return convexUseMutation(mutation) as any;
  }
  return useMockMutationInternal<TArgs, TReturn>(mutation);
}

/**
 * Universal useConvex client hook.
 */
export function useConvex(): any {
  if (IS_REAL_CONVEX) {
    return convexUseConvex();
  }
  const store = useMockStore();
  return {
    query: (queryRef: any, args: any) => store.getQueryResult(resolveFunctionName(queryRef), args),
    mutation: (mutationRef: any, args: any) => store.executeMutation(resolveFunctionName(mutationRef), args),
  };
}

// ============================================================================
// 10. Universal `api` Proxy with Full TypeScript Autocomplete
// ============================================================================

export interface VersoApi {
  tournaments: {
    getBySlug: FunctionReference<"query", "public", { slug: string }, FullTournamentData | null>;
    getTournamentBundle: FunctionReference<"query", "public", { slug: string; adminSecret?: string }, any>;
    list: FunctionReference<"query", "public", {}, TournamentDoc[]>;
    verifyAdminSecret: FunctionReference<"query", "public", { slug: string; adminSecret: string }, { isValid: boolean; valid?: boolean; tournament?: TournamentDoc }>;
    create: FunctionReference<"mutation", "public", { name: string; slug?: string; sportPreset?: SportPreset; customRules?: Partial<SportRulesConfig>; days?: string[]; pitches?: string[]; allowPlayerScoreSubmission?: boolean }, { tournamentId: string; slug: string; adminSecret: string }>;
    updateSettings: FunctionReference<"mutation", "public", { tournamentId: string; adminSecret: string; name?: string; allowPlayerScoreSubmission?: boolean; sportRules?: Partial<SportRulesConfig> }, TournamentDoc>;
  };
  players: {
    listByTournament: FunctionReference<"query", "public", { tournamentId: string; adminSecret?: string }, PlayerDoc[]>;
    getBySecret: FunctionReference<"query", "public", { secretCode: string }, { player: PlayerDoc; tournament: TournamentDoc; sportRules: SportRulesDoc; matches: EnrichedMatchDoc[] } | null>;
    create: FunctionReference<"mutation", "public", { tournamentId: string; name: string; adminSecret?: string; groupSlotIndex?: number; secretCode?: string; notes?: string }, any>;
    bulkCreate: FunctionReference<"mutation", "public", { tournamentId: string; names?: string[]; players?: any[]; adminSecret?: string }, any>;
    toggleCheckIn: FunctionReference<"mutation", "public", { playerId: string; checkedIn?: boolean; adminSecret?: string; playerSecret?: string }, any>;
    delete: FunctionReference<"mutation", "public", { playerId: string; adminSecret: string }, { success: boolean }>;
    deletePlayer: FunctionReference<"mutation", "public", { playerId: string; adminSecret: string }, { success: boolean }>;
  };
  matches: {
    listByTournament: FunctionReference<"query", "public", { tournamentId: string; stageId?: string; groupId?: string; dayId?: string; pitchId?: string; adminSecret?: string }, EnrichedMatchDoc[]>;
    getById: FunctionReference<"query", "public", { matchId: string }, EnrichedMatchDoc | null>;
    generateFromSchedule: FunctionReference<"mutation", "public", { tournamentId: string; stageId?: string; groupId?: string; adminSecret?: string; autoSchedulePitchesAndTime?: boolean; matchDurationMinutes?: number; restIntervalMinutes?: number }, any>;
    updateScore: FunctionReference<"mutation", "public", { matchId: string; sets: { s1: number; s2: number }[]; adminSecret?: string; refereeSecret?: string }, MatchDoc>;
    submitPlayerScore: FunctionReference<"mutation", "public", { matchId: string; playerSecret: string; sets: { s1: number; s2: number }[] }, MatchDoc>;
    setWalkover: FunctionReference<"mutation", "public", { matchId: string; winnerPlayerId?: string; winnerId?: string; adminSecret?: string; refereeSecret?: string; reason?: string }, any>;
    generateKnockoutStage: FunctionReference<"mutation", "public", { tournamentId: string; adminSecret: string; stageName?: string; qualifierCount: number; includeThirdPlace?: boolean }, any>;
    getMatchesForPlayer: FunctionReference<"query", "public", { tournamentId: string; playerId: string }, any>;
  };
  standings: {
    getGroupStandings: FunctionReference<"query", "public", { tournamentId?: string; groupId?: string; pointsRuleOverride?: PointsRule }, EnrichedStanding[]>;
    getTournamentStandings: FunctionReference<"query", "public", { tournamentId: string }, any>;
  };
  slides: {
    getSlideConfig: FunctionReference<"query", "public", { tournamentId: string }, SlideDoc | null>;
    updateSlideConfig: FunctionReference<"mutation", "public", { tournamentId: string; adminSecret: string; rotationIntervalSeconds?: number; announcementText?: string; activeSlides?: any[] }, SlideDoc>;
    getPresenterData: FunctionReference<"query", "public", { slug: string }, any>;
  };
  seed: {
    restoreFssShowcase: FunctionReference<"mutation", "public", {}, { success: boolean; slug: string; tournamentId: string; adminSecret: string }>;
    restoreShowcase: FunctionReference<"mutation", "public", { slug?: string }, { success: boolean; slug: string }>;
    resetAll: FunctionReference<"mutation", "public", {}, { success: boolean }>;
  };
}

export const api = anyApi as unknown as VersoApi;
