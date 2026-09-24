// ============================================================
// VERSO — Tournament Logic (Round Robin + Bracket Generation)
// ============================================================

import type { Match, Group, Player } from "./types";

// ─── Round Robin ─────────────────────────────────────────────
/**
 * Generate all round-robin matches for a group.
 * Uses the "round-robin tournament" algorithm.
 * If odd number, adds a BYE slot.
 */
export function generateRoundRobin(
  groupId: string,
  phaseId: string,
  tournamentId: string,
  playerIds: (string | null)[],
  startMatchNumber: number = 1,
  legs: number = 1
): Omit<Match, "_id">[] {
  const ids = [...playerIds];

  // If odd, add BYE
  if (ids.length % 2 !== 0) {
    ids.push(null);
  }

  const n = ids.length;
  const roundsPerLeg = n - 1;
  const matchesPerRound = n / 2;
  const matches: Omit<Match, "_id">[] = [];
  let matchNumber = startMatchNumber;

  // Create rotation array (fix first element, rotate rest)
  let rotation = [...ids];

  for (let leg = 0; leg < legs; leg++) {
    rotation = [...ids]; // Reset rotation for each leg
    for (let round = 0; round < roundsPerLeg; round++) {
      for (let match = 0; match < matchesPerRound; match++) {
        let p1 = rotation[match];
        let p2 = rotation[n - 1 - match];

        // Swap home/away for even legs
        if (leg % 2 !== 0) {
          const temp = p1;
          p1 = p2;
          p2 = temp;
        }

        // Skip BYE vs BYE
        if (p1 === null && p2 === null) continue;

        matches.push({
          tournamentId,
          phaseId,
          groupId,
          player1Id: p1,
          player2Id: p2,
          round: (leg * roundsPerLeg) + round + 1,
          matchNumber,
          matchLabel: `M${matchNumber}`,
          status: "pending",
        });
        matchNumber++;
      }

      // Rotate: keep rotation[0] fixed, rotate rest
      const last = rotation.pop()!;
      rotation.splice(1, 0, last);
    }
  }

  return matches;
}

// ─── Single Elimination Bracket ──────────────────────────────
/**
 * Generate single elimination bracket matches.
 * playerIds: seeds in order (1st gets best bracket position)
 */
export function generateBracket(
  phaseId: string,
  tournamentId: string,
  playerIds: (string | null)[],
  startMatchNumber: number = 1,
): Omit<Match, "_id">[] {
  const matches: Omit<Match, "_id">[] = [];

  // Find next power of 2 (bracket size)
  const bracketSize = nextPowerOf2(playerIds.length);

  // Pad with BYEs to fill bracket
  const seeded: (string | null)[] = [...playerIds];
  while (seeded.length < bracketSize) {
    seeded.push(null);
  }

  // Build bracket structure
  const totalRounds = Math.log2(bracketSize);
  let matchNumber = startMatchNumber;

  // First round: pair seeds
  const firstRoundPairs = createSeedPairs(seeded);
  const roundMatches: Omit<Match, "_id">[][] = [];

  // Generate all rounds
  for (let round = 0; round < totalRounds; round++) {
    const roundMatchList: Omit<Match, "_id">[] = [];
    const matchesInRound = bracketSize / Math.pow(2, round + 1);

    for (let i = 0; i < matchesInRound; i++) {
      const isFirstRound = round === 0;
      const isFinal = round === totalRounds - 1;
      const isSemifinal = round === totalRounds - 2;

      let label = `B${matchNumber}`;
      if (isFinal) label = "Finał";
      else if (isSemifinal && matchesInRound === 2) {
        label = `Półfinał ${i + 1}`;
      }

      const match: Omit<Match, "_id"> = {
        tournamentId,
        phaseId,
        player1Id: isFirstRound ? firstRoundPairs[i * 2] : null,
        player2Id: isFirstRound ? firstRoundPairs[i * 2 + 1] : null,
        round: round + 1,
        matchNumber,
        matchLabel: label,
        status: "pending",
      };

      roundMatchList.push(match);
      matchNumber++;
    }

    roundMatches.push(roundMatchList);
  }

  return roundMatches.flat();
}

// ─── Seeding pairs (1 vs last, 2 vs second-to-last, etc.) ───
function createSeedPairs(seeds: (string | null)[]): (string | null)[] {
  const n = seeds.length;
  const pairs: (string | null)[] = [];

  function build(lo: number, hi: number) {
    if (lo > hi) return;
    pairs.push(seeds[lo], seeds[hi]);
    build(lo + 1, hi - 1);
  }

  build(0, n - 1);
  return pairs;
}

function nextPowerOf2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

// ─── Standings Calculator ────────────────────────────────────
export function calculateStandings(
  playerIds: (string | null)[],
  matches: Pick<Match, "player1Id" | "player2Id" | "player1Score" | "player2Score" | "winnerId" | "status">[],
  players: Pick<Player, "_id" | "name">[],
  winPoints = 3,
  drawPoints = 1,
  lossPoints = 0,
) {
  const playerMap = new Map(players.map((p) => [p._id, p]));

  const stats = new Map<
    string,
    {
      played: number;
      won: number;
      drawn: number;
      lost: number;
      goalsFor: number;
      goalsAgainst: number;
      points: number;
    }
  >();

  // Initialize all players
  for (const id of playerIds) {
    if (!id) continue;
    stats.set(id, {
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      points: 0,
    });
  }

  // Process finished matches
  for (const match of matches) {
    if (match.status !== "finished") continue;
    const { player1Id, player2Id, player1Score, player2Score } = match;
    if (!player1Id || !player2Id) continue;
    if (player1Score === undefined || player2Score === undefined) continue;

    const s1 = stats.get(player1Id);
    const s2 = stats.get(player2Id);
    if (!s1 || !s2) continue;

    s1.played++;
    s2.played++;
    s1.goalsFor += player1Score;
    s1.goalsAgainst += player2Score;
    s2.goalsFor += player2Score;
    s2.goalsAgainst += player1Score;

    if (player1Score > player2Score) {
      s1.won++;
      s1.points += winPoints;
      s2.lost++;
      s2.points += lossPoints;
    } else if (player1Score < player2Score) {
      s2.won++;
      s2.points += winPoints;
      s1.lost++;
      s1.points += lossPoints;
    } else {
      s1.drawn++;
      s1.points += drawPoints;
      s2.drawn++;
      s2.points += drawPoints;
    }
  }

  // Build sorted standings
  const rows = Array.from(stats.entries())
    .map(([playerId, s]) => ({
      playerId,
      playerName: playerMap.get(playerId)?.name ?? "Unknown",
      ...s,
      goalDiff: s.goalsFor - s.goalsAgainst,
      position: 0,
    }))
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
      return a.playerName.localeCompare(b.playerName);
    });

  rows.forEach((r, i) => (r.position = i + 1));
  return rows;
}

// ─── Auto-Schedule Helpers ───────────────────────────────────
export function generateTimeSlots(
  startTime: string,
  endTime: string,
  durationMinutes: number,
  breakMinutes = 0,
): string[] {
  const slots: string[] = [];
  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);

  let currentMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  while (currentMinutes + durationMinutes <= endMinutes) {
    const h = Math.floor(currentMinutes / 60).toString().padStart(2, "0");
    const m = (currentMinutes % 60).toString().padStart(2, "0");
    slots.push(`${h}:${m}`);
    currentMinutes += durationMinutes + breakMinutes;
  }

  return slots;
}

// ─── ID Generator ────────────────────────────────────────────
export function generateId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}

export function generateToken(): string {
  return crypto.randomUUID().replace(/-/g, "");
}
