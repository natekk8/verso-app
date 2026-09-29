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

export type PointsRule = "2_1_matrix" | "standard_3_1_0";

interface PlayerStats {
  playerId: string;
  played: number;
  won: number;
  lost: number;
  points: number;
  setsWon: number;
  setsLost: number;
  pointsWon: number;
  pointsLost: number;
}

function computePointsForMatch(
  s1Sets: number,
  s2Sets: number,
  pointsRule: PointsRule,
  declaredWinnerId?: string,
  p1Id?: string,
  p2Id?: string
): { p1Points: number; p2Points: number; winner: 1 | 2 | 0 } {
  let winner: 1 | 2 | 0 = 0;
  if (declaredWinnerId && p1Id && p2Id) {
    if (declaredWinnerId === p1Id) winner = 1;
    else if (declaredWinnerId === p2Id) winner = 2;
  }
  if (winner === 0) {
    if (s1Sets > s2Sets) winner = 1;
    else if (s2Sets > s1Sets) winner = 2;
  }

  if (pointsRule === "2_1_matrix") {
    // 2:0 gives 2-0 pts, 2:1 gives 2-1 pts
    if (winner === 1) {
      return {
        p1Points: 2,
        p2Points: s2Sets >= 1 ? 1 : 0,
        winner: 1,
      };
    } else if (winner === 2) {
      return {
        p1Points: s1Sets >= 1 ? 1 : 0,
        p2Points: 2,
        winner: 2,
      };
    }
    return { p1Points: 0, p2Points: 0, winner: 0 };
  } else {
    // standard 3-1-0
    if (winner === 1) {
      return { p1Points: 3, p2Points: 0, winner: 1 };
    } else if (winner === 2) {
      return { p1Points: 0, p2Points: 3, winner: 2 };
    } else {
      return { p1Points: 1, p2Points: 1, winner: 0 };
    }
  }
}

/**
 * Calculates complete standings for a group and strictly applies the recursive tiebreaker order:
 * 1. Points
 * 2. Head-to-Head (direct match or mini-league among tied subset)
 * 3. Matches Won
 * 4. Set Difference
 * 5. Point Difference
 * 6. Points Won
 * 7. Original Registration Order
 */
export function calculateStandings(
  playerIds: string[],
  matches: MatchResultInput[],
  pointsRule: PointsRule = "2_1_matrix"
): PlayerStanding[] {
  // 1. Initialize stats for all players
  const statsMap = new Map<string, PlayerStats>();
  for (const id of playerIds) {
    statsMap.set(id, {
      playerId: id,
      played: 0,
      won: 0,
      lost: 0,
      points: 0,
      setsWon: 0,
      setsLost: 0,
      pointsWon: 0,
      pointsLost: 0,
    });
  }

  const completedMatches = matches.filter(
    (m) => m.status === "completed" && statsMap.has(m.player1Id) && statsMap.has(m.player2Id)
  );

  // 2. Tally overall statistics
  for (const m of completedMatches) {
    const s1 = statsMap.get(m.player1Id)!;
    const s2 = statsMap.get(m.player2Id)!;

    let s1Sets = 0;
    let s2Sets = 0;
    let s1Points = 0;
    let s2Points = 0;

    for (const set of m.sets) {
      s1Points += set.s1;
      s2Points += set.s2;
      if (set.s1 > set.s2) s1Sets++;
      else if (set.s2 > set.s1) s2Sets++;
    }

    const { p1Points, p2Points, winner } = computePointsForMatch(
      s1Sets,
      s2Sets,
      pointsRule,
      m.winnerId,
      m.player1Id,
      m.player2Id
    );

    s1.played++;
    s2.played++;
    s1.setsWon += s1Sets;
    s1.setsLost += s2Sets;
    s2.setsWon += s2Sets;
    s2.setsLost += s1Sets;
    s1.pointsWon += s1Points;
    s1.pointsLost += s2Points;
    s2.pointsWon += s2Points;
    s2.pointsLost += s1Points;
    s1.points += p1Points;
    s2.points += p2Points;

    if (winner === 1) {
      s1.won++;
      s2.lost++;
    } else if (winner === 2) {
      s2.won++;
      s1.lost++;
    }
  }

  // 3. Helper to partition a group of IDs by an integer or numeric metric (descending)
  function partitionByMetric(
    ids: string[],
    metricFn: (id: string) => number
  ): { value: number; group: string[] }[] {
    const buckets = new Map<number, string[]>();
    for (const id of ids) {
      const val = metricFn(id);
      if (!buckets.has(val)) buckets.set(val, []);
      buckets.get(val)!.push(id);
    }
    return Array.from(buckets.entries())
      .map(([value, group]) => ({ value, group }))
      .sort((a, b) => b.value - a.value);
  }

  const explanations = new Map<string, string>();

  // 4. Recursive tiebreaker resolver
  function resolveSubset(subset: string[], isSubTier: boolean = false): string[] {
    if (subset.length <= 1) return subset;

    // Head-to-Head (direct match or mini-league)
    if (subset.length === 2) {
      const [pA, pB] = subset;
      const h2hMatches = completedMatches.filter(
        (m) =>
          (m.player1Id === pA && m.player2Id === pB) ||
          (m.player1Id === pB && m.player2Id === pA)
      );

      let pAWins = 0;
      let pBWins = 0;

      for (const m of h2hMatches) {
        let s1Sets = 0;
        let s2Sets = 0;
        for (const set of m.sets) {
          if (set.s1 > set.s2) s1Sets++;
          else if (set.s2 > set.s1) s2Sets++;
        }
        const { winner } = computePointsForMatch(
          s1Sets,
          s2Sets,
          pointsRule,
          m.winnerId,
          m.player1Id,
          m.player2Id
        );
        const winnerId = winner === 1 ? m.player1Id : winner === 2 ? m.player2Id : undefined;
        if (winnerId === pA) pAWins++;
        else if (winnerId === pB) pBWins++;
      }

      if (pAWins > pBWins) {
        explanations.set(pA, `Head-to-Head win vs ${pB}`);
        return [pA, pB];
      } else if (pBWins > pAWins) {
        explanations.set(pB, `Head-to-Head win vs ${pA}`);
        return [pB, pA];
      }
    } else if (subset.length >= 3) {
      // Mini-league among tied subset
      const subsetSet = new Set(subset);
      const miniMatches = completedMatches.filter(
        (m) => subsetSet.has(m.player1Id) && subsetSet.has(m.player2Id)
      );

      if (miniMatches.length > 0) {
        const miniStats = new Map<
          string,
          { points: number; won: number; setDiff: number; ptDiff: number }
        >();
        for (const id of subset) {
          miniStats.set(id, { points: 0, won: 0, setDiff: 0, ptDiff: 0 });
        }

        for (const m of miniMatches) {
          const stA = miniStats.get(m.player1Id)!;
          const stB = miniStats.get(m.player2Id)!;

          let s1Sets = 0;
          let s2Sets = 0;
          let s1Pts = 0;
          let s2Pts = 0;
          for (const s of m.sets) {
            s1Pts += s.s1;
            s2Pts += s.s2;
            if (s.s1 > s.s2) s1Sets++;
            else if (s.s2 > s.s1) s2Sets++;
          }

          const { p1Points, p2Points, winner } = computePointsForMatch(
            s1Sets,
            s2Sets,
            pointsRule,
            m.winnerId,
            m.player1Id,
            m.player2Id
          );

          stA.points += p1Points;
          stB.points += p2Points;
          stA.setDiff += s1Sets - s2Sets;
          stB.setDiff += s2Sets - s1Sets;
          stA.ptDiff += s1Pts - s2Pts;
          stB.ptDiff += s2Pts - s1Pts;
          if (winner === 1) stA.won++;
          else if (winner === 2) stB.won++;
        }

        // Check mini-league points
        const byMiniPoints = partitionByMetric(subset, (id) => miniStats.get(id)!.points);
        if (byMiniPoints.length > 1) {
          for (const b of byMiniPoints) {
            if (b.group.length === 1) {
              explanations.set(b.group[0], `Mini-league points (${b.value} pts)`);
            }
          }
          return byMiniPoints.flatMap((b) => resolveSubset(b.group, true));
        }

        // Check mini-league matches won
        const byMiniWon = partitionByMetric(subset, (id) => miniStats.get(id)!.won);
        if (byMiniWon.length > 1) {
          for (const b of byMiniWon) {
            if (b.group.length === 1) {
              explanations.set(b.group[0], `Mini-league wins (${b.value})`);
            }
          }
          return byMiniWon.flatMap((b) => resolveSubset(b.group, true));
        }

        // Check mini-league set diff
        const byMiniSetDiff = partitionByMetric(subset, (id) => miniStats.get(id)!.setDiff);
        if (byMiniSetDiff.length > 1) {
          for (const b of byMiniSetDiff) {
            if (b.group.length === 1) {
              explanations.set(
                b.group[0],
                `Mini-league set diff (${b.value >= 0 ? "+" : ""}${b.value})`
              );
            }
          }
          return byMiniSetDiff.flatMap((b) => resolveSubset(b.group, true));
        }

        // Check mini-league point diff
        const byMiniPtDiff = partitionByMetric(subset, (id) => miniStats.get(id)!.ptDiff);
        if (byMiniPtDiff.length > 1) {
          for (const b of byMiniPtDiff) {
            if (b.group.length === 1) {
              explanations.set(
                b.group[0],
                `Mini-league point diff (${b.value >= 0 ? "+" : ""}${b.value})`
              );
            }
          }
          return byMiniPtDiff.flatMap((b) => resolveSubset(b.group, true));
        }
      }
    }

    // Step 3: Overall Matches Won
    const byMatchesWon = partitionByMetric(subset, (id) => statsMap.get(id)!.won);
    if (byMatchesWon.length > 1) {
      for (const b of byMatchesWon) {
        if (b.group.length === 1) {
          explanations.set(b.group[0], `Overall matches won (${b.value})`);
        }
      }
      return byMatchesWon.flatMap((b) => resolveSubset(b.group, true));
    }

    // Step 4: Overall Set Difference
    const bySetDiff = partitionByMetric(
      subset,
      (id) => statsMap.get(id)!.setsWon - statsMap.get(id)!.setsLost
    );
    if (bySetDiff.length > 1) {
      for (const b of bySetDiff) {
        if (b.group.length === 1) {
          explanations.set(
            b.group[0],
            `Overall set difference (${b.value >= 0 ? "+" : ""}${b.value})`
          );
        }
      }
      return bySetDiff.flatMap((b) => resolveSubset(b.group, true));
    }

    // Step 5: Overall Point Difference
    const byPtDiff = partitionByMetric(
      subset,
      (id) => statsMap.get(id)!.pointsWon - statsMap.get(id)!.pointsLost
    );
    if (byPtDiff.length > 1) {
      for (const b of byPtDiff) {
        if (b.group.length === 1) {
          explanations.set(
            b.group[0],
            `Overall point difference (${b.value >= 0 ? "+" : ""}${b.value})`
          );
        }
      }
      return byPtDiff.flatMap((b) => resolveSubset(b.group, true));
    }

    // Step 6: Total Points Won (scored)
    const byPointsWon = partitionByMetric(subset, (id) => statsMap.get(id)!.pointsWon);
    if (byPointsWon.length > 1) {
      for (const b of byPointsWon) {
        if (b.group.length === 1) {
          explanations.set(b.group[0], `Overall points won (${b.value})`);
        }
      }
      return byPointsWon.flatMap((b) => resolveSubset(b.group, true));
    }

    // Step 7: Deterministic fallback to initial playerIds order
    return [...subset].sort((a, b) => playerIds.indexOf(a) - playerIds.indexOf(b));
  }

  // Initial partition by overall Points (Tier 1)
  const byOverallPoints = partitionByMetric(playerIds, (id) => statsMap.get(id)!.points);
  const orderedPlayerIds = byOverallPoints.flatMap((bucket) => resolveSubset(bucket.group));

  // Assemble PlayerStanding rows
  return orderedPlayerIds.map((id, index) => {
    const s = statsMap.get(id)!;
    return {
      playerId: id,
      rank: index + 1,
      played: s.played,
      won: s.won,
      lost: s.lost,
      points: s.points,
      setsWon: s.setsWon,
      setsLost: s.setsLost,
      setDifference: s.setsWon - s.setsLost,
      pointsWon: s.pointsWon,
      pointsLost: s.pointsLost,
      pointDifference: s.pointsWon - s.pointsLost,
      tiebreakerExplanation: explanations.get(id),
    };
  });
}
