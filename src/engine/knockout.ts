export type KnockoutRoundName =
  | "round_of_32"
  | "round_of_16"
  | "quarterfinals"
  | "semifinals"
  | "third_place"
  | "final";

export interface KnockoutSlot {
  slotId: string;
  sourceType: "seed" | "group_rank" | "winner_of" | "loser_of";
  sourceRef: string; // e.g. "1. Grupa A", "sf-1", "qf-1"
  playerId?: string;
}

export interface KnockoutMatch {
  id: string;
  roundName: KnockoutRoundName;
  matchNumber?: number;
  slot1: KnockoutSlot;
  slot2: KnockoutSlot;
  winnerPlayerId?: string;
  loserPlayerId?: string;
}

/**
 * Standard tournament bracket seeding positions for power-of-2 qualifiers.
 * Ensures seed 1 and seed 2 are on opposite sides of the bracket.
 */
function getStandardSeedOrder(size: number): number[] {
  let order = [1, 2];
  while (order.length < size) {
    const nextOrder: number[] = [];
    const pairSum = order.length * 2 + 1;
    for (const seed of order) {
      nextOrder.push(seed);
      nextOrder.push(pairSum - seed);
    }
    order = nextOrder;
  }
  return order;
}

function getRoundName(matchCount: number): KnockoutRoundName {
  switch (matchCount) {
    case 1:
      return "final";
    case 2:
      return "semifinals";
    case 4:
      return "quarterfinals";
    case 8:
      return "round_of_16";
    case 16:
      return "round_of_32";
    default:
      return "quarterfinals";
  }
}

/**
 * Generates a complete single-elimination tournament bracket with DAG dependencies
 * and an optional 3rd place playoff match.
 *
 * @param qualifierCount Number of qualifying participants (e.g. 2, 4, 8, 16)
 * @param includeThirdPlace Whether to add a 3rd-place match between semifinal losers
 */
export function generateKnockoutBracket(
  qualifierCount: number,
  includeThirdPlace: boolean = true
): KnockoutMatch[] {
  if (qualifierCount < 2) {
    return [];
  }

  // Round up to next power of 2 if needed
  let bracketSize = 2;
  while (bracketSize < qualifierCount) {
    bracketSize *= 2;
  }

  const seedPairs = getStandardSeedOrder(bracketSize);
  const matches: KnockoutMatch[] = [];
  let globalMatchCounter = 1;

  // Round 1 matches (e.g. Quarterfinals for 8, Semifinals for 4)
  const round1MatchCount = bracketSize / 2;
  const round1Name = getRoundName(round1MatchCount);
  let currentRoundMatchIds: string[] = [];

  for (let i = 0; i < round1MatchCount; i++) {
    const seed1 = seedPairs[i * 2];
    const seed2 = seedPairs[i * 2 + 1];
    const prefix = round1Name === "semifinals" ? "sf" : round1Name === "quarterfinals" ? "qf" : `r${round1MatchCount}`;
    const matchId = `${prefix}-${i + 1}`;

    const match: KnockoutMatch = {
      id: matchId,
      roundName: round1Name,
      matchNumber: globalMatchCounter++,
      slot1: {
        slotId: `${matchId}-slot-1`,
        sourceType: "group_rank",
        sourceRef: `${seed1}. Grupa A`,
      },
      slot2: {
        slotId: `${matchId}-slot-2`,
        sourceType: "group_rank",
        sourceRef: `${seed2}. Grupa A`,
      },
    };

    matches.push(match);
    currentRoundMatchIds.push(matchId);
  }

  let semifinalMatchIds: string[] = [];
  if (round1Name === "semifinals") {
    semifinalMatchIds = [...currentRoundMatchIds];
  }

  // Subsequent rounds until final
  while (currentRoundMatchIds.length > 1) {
    const nextRoundCount = currentRoundMatchIds.length / 2;
    const nextRoundName = getRoundName(nextRoundCount);
    const nextRoundMatchIds: string[] = [];

    for (let i = 0; i < nextRoundCount; i++) {
      const prevId1 = currentRoundMatchIds[i * 2];
      const prevId2 = currentRoundMatchIds[i * 2 + 1];
      const prefix = nextRoundName === "final" ? "final" : nextRoundName === "semifinals" ? "sf" : `r${nextRoundCount}`;
      const matchId = nextRoundCount === 1 ? "final" : `${prefix}-${i + 1}`;

      const match: KnockoutMatch = {
        id: matchId,
        roundName: nextRoundName,
        matchNumber: globalMatchCounter++,
        slot1: {
          slotId: `${matchId}-slot-1`,
          sourceType: "winner_of",
          sourceRef: prevId1,
        },
        slot2: {
          slotId: `${matchId}-slot-2`,
          sourceType: "winner_of",
          sourceRef: prevId2,
        },
      };

      matches.push(match);
      nextRoundMatchIds.push(matchId);

      if (nextRoundName === "semifinals") {
        semifinalMatchIds.push(matchId);
      }
    }

    currentRoundMatchIds = nextRoundMatchIds;
  }

  // Optional 3rd Place Playoff between semifinal losers
  if (includeThirdPlace && semifinalMatchIds.length === 2) {
    const thirdPlaceMatch: KnockoutMatch = {
      id: "third-place",
      roundName: "third_place",
      matchNumber: globalMatchCounter++,
      slot1: {
        slotId: "third-place-slot-1",
        sourceType: "loser_of",
        sourceRef: semifinalMatchIds[0],
      },
      slot2: {
        slotId: "third-place-slot-2",
        sourceType: "loser_of",
        sourceRef: semifinalMatchIds[1],
      },
    };

    // Insert 3rd place before or right after final
    matches.push(thirdPlaceMatch);
  }

  return matches;
}

/**
 * Propagates match outcomes across the DAG tree.
 * When a match resolves, updates subsequent matches' slots (winner_of and loser_of).
 */
export function propagateKnockoutResults(
  matches: KnockoutMatch[],
  results: Record<string, { winnerPlayerId: string; loserPlayerId?: string }>
): KnockoutMatch[] {
  return matches.map((match) => {
    const updated = { ...match, slot1: { ...match.slot1 }, slot2: { ...match.slot2 } };

    // Update slot1 from DAG parent if applicable
    if (updated.slot1.sourceType === "winner_of") {
      const parentResult = results[updated.slot1.sourceRef];
      if (parentResult?.winnerPlayerId) {
        updated.slot1.playerId = parentResult.winnerPlayerId;
      }
    } else if (updated.slot1.sourceType === "loser_of") {
      const parentResult = results[updated.slot1.sourceRef];
      if (parentResult?.loserPlayerId) {
        updated.slot1.playerId = parentResult.loserPlayerId;
      }
    }

    // Update slot2 from DAG parent if applicable
    if (updated.slot2.sourceType === "winner_of") {
      const parentResult = results[updated.slot2.sourceRef];
      if (parentResult?.winnerPlayerId) {
        updated.slot2.playerId = parentResult.winnerPlayerId;
      }
    } else if (updated.slot2.sourceType === "loser_of") {
      const parentResult = results[updated.slot2.sourceRef];
      if (parentResult?.loserPlayerId) {
        updated.slot2.playerId = parentResult.loserPlayerId;
      }
    }

    // Check if this match itself has a recorded result
    const thisResult = results[updated.id];
    if (thisResult) {
      updated.winnerPlayerId = thisResult.winnerPlayerId;
      updated.loserPlayerId = thisResult.loserPlayerId;
    }

    return updated;
  });
}

/**
 * Populates initial group qualifiers into the bracket group_rank slots.
 */
export function populateGroupRankings(
  bracket: KnockoutMatch[],
  rankings: { rank: number; playerId: string; groupName?: string }[]
): KnockoutMatch[] {
  const rankMap = new Map<number, string>();
  for (const r of rankings) {
    rankMap.set(r.rank, r.playerId);
  }

  return bracket.map((match) => {
    const updated = { ...match, slot1: { ...match.slot1 }, slot2: { ...match.slot2 } };

    if (updated.slot1.sourceType === "group_rank") {
      const rankNum = parseInt(updated.slot1.sourceRef.split(".")[0], 10);
      if (rankMap.has(rankNum)) {
        updated.slot1.playerId = rankMap.get(rankNum);
      }
    }

    if (updated.slot2.sourceType === "group_rank") {
      const rankNum = parseInt(updated.slot2.sourceRef.split(".")[0], 10);
      if (rankMap.has(rankNum)) {
        updated.slot2.playerId = rankMap.get(rankNum);
      }
    }

    return updated;
  });
}
