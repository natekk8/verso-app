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

export interface BergerScheduleOptions {
  /**
   * Whether to include the virtual bye match inside the round's matches array.
   * Default is false (bye matches are omitted from matches, and indicated via byePlayerSlot).
   */
  includeByeInMatches?: boolean;
}

/**
 * Deterministic Berger Round-Robin Pairing Generator.
 * Implements the standard circle rotation algorithm for arbitrary N (odd or even).
 * 
 * Guarantees:
 * - If N is even: exactly N-1 rounds, N/2 matches per round, 0 byes.
 * - If N is odd: exactly N rounds, (N-1)/2 playable matches per round, exactly 1 bye per round.
 *   For N=9: exactly 9 rounds, 4 matches per round = 36 matches, exactly 1 bye per round.
 * - Every distinct pair of players meets exactly once.
 * - Home/away alternation is balanced.
 */
export function generateBergerSchedule(
  playerCount: number,
  options?: BergerScheduleOptions
): BergerRound[] {
  if (playerCount <= 1) {
    if (playerCount === 1) {
      return [
        {
          roundNumber: 1,
          matches: [],
          byePlayerSlot: 0,
        },
      ];
    }
    return [];
  }

  const isOdd = playerCount % 2 !== 0;
  // If odd, pad with virtual dummy index representing BYE
  const dummySlot = isOdd ? playerCount : -1;
  const totalSlots = isOdd ? playerCount + 1 : playerCount;
  const roundsCount = totalSlots - 1;
  const matchesPerRound = totalSlots / 2;

  // Initial circle: [0, 1, 2, ..., totalSlots - 1]
  const circle: number[] = Array.from({ length: totalSlots }, (_, i) => i);

  const rounds: BergerRound[] = [];

  for (let r = 0; r < roundsCount; r++) {
    const roundNumber = r + 1;
    const matches: BergerMatch[] = [];
    let byeSlot: number | undefined = undefined;
    let matchInRound = 1;

    for (let i = 0; i < matchesPerRound; i++) {
      const p1 = circle[i];
      const p2 = circle[totalSlots - 1 - i];

      const hasBye = isOdd && (p1 === dummySlot || p2 === dummySlot);

      if (hasBye) {
        // The real player paired with the dummy slot gets the bye this round
        byeSlot = p1 === dummySlot ? p2 : p1;
        if (options?.includeByeInMatches) {
          matches.push({
            round: roundNumber,
            matchInRound: matchInRound++,
            player1Slot: byeSlot,
            player2Slot: -1,
            isBye: true,
          });
        }
      } else {
        // Balance home/away:
        // For pair 0: alternate home/away by round parity
        // For other pairs: alternate based on (round + pair index)
        let home = p1;
        let away = p2;
        if (i === 0) {
          if (r % 2 === 1) {
            home = p2;
            away = p1;
          }
        } else if ((r + i) % 2 === 1) {
          home = p2;
          away = p1;
        }

        matches.push({
          round: roundNumber,
          matchInRound: matchInRound++,
          player1Slot: home,
          player2Slot: away,
          isBye: false,
        });
      }
    }

    rounds.push({
      roundNumber,
      matches,
      byePlayerSlot: byeSlot,
    });

    // Circle rotation: keep circle[0] fixed, rotate circle[1..totalSlots-1] cyclically
    const last = circle.pop()!;
    circle.splice(1, 0, last);
  }

  return rounds;
}

/**
 * Convenience helper to generate paired matches with actual player items.
 */
export function generateBergerMatchesWithPlayers<T>(
  players: T[]
): {
  rounds: BergerRound[];
  matches: (BergerMatch & { player1: T; player2: T })[];
  byes: { round: number; player: T }[];
} {
  const rounds = generateBergerSchedule(players.length);
  const matches: (BergerMatch & { player1: T; player2: T })[] = [];
  const byes: { round: number; player: T }[] = [];

  for (const round of rounds) {
    if (round.byePlayerSlot !== undefined) {
      byes.push({
        round: round.roundNumber,
        player: players[round.byePlayerSlot],
      });
    }

    for (const match of round.matches) {
      if (!match.isBye) {
        matches.push({
          ...match,
          player1: players[match.player1Slot],
          player2: players[match.player2Slot],
        });
      }
    }
  }

  return { rounds, matches, byes };
}
