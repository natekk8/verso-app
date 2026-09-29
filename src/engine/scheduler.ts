export interface PitchConfig {
  id: string;
  name: string;
  order?: number;
}

export interface DayConfig {
  id: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM e.g. "18:00"
  endTime?: string; // HH:MM
  maxMatches?: number;
}

export interface MatchInput {
  id: string;
  round: number;
  player1Id: string;
  player2Id: string;
  stageId?: string;
  groupId?: string;
}

export interface ScheduledMatch {
  matchId: string;
  round: number;
  player1Id: string;
  player2Id: string;
  dayId: string;
  date: string;
  pitchId: string;
  pitchName: string;
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  startTimestamp: number; // Unix epoch ms
  endTimestamp: number; // Unix epoch ms
}

export interface SchedulerOptions {
  matchDurationMinutes?: number; // default 20
  restIntervalMinutes?: number; // default 10
}

function timeStringToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTimeString(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

function buildEpochMs(dateStr: string, minutesFromMidnight: number): number {
  const [year, month, day] = dateStr.split("-").map(Number);
  const h = Math.floor(minutesFromMidnight / 60);
  const m = minutesFromMidnight % 60;
  return Date.UTC(year, month - 1, day, h, m);
}

/**
 * Pitch and time scheduler allocating matches across available pitches and dates with rest intervals.
 * 
 * Guarantees:
 * 1. Zero pitch overlap: On any pitch, no two matches have overlapping intervals [start, end).
 * 2. Zero player concurrency: No player is assigned to two matches at the same time.
 * 3. Rest interval: For consecutive matches of the same player on the same day, start time >= end time + restInterval.
 * 4. Preserves round ordering and fair pitch distribution.
 */
export function scheduleTournamentMatches(
  matches: MatchInput[],
  pitches: PitchConfig[],
  days: DayConfig[],
  options?: SchedulerOptions
): ScheduledMatch[] {
  if (matches.length === 0 || pitches.length === 0 || days.length === 0) {
    return [];
  }

  const matchDuration = options?.matchDurationMinutes ?? 20;
  const restInterval = options?.restIntervalMinutes ?? 10;

  // Sort pitches by order if available
  const sortedPitches = [...pitches].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const pitchMap = new Map<string, PitchConfig>(sortedPitches.map((p) => [p.id, p]));

  // Ensure matches are in round and sequence order
  const queuedMatches = [...matches].sort((a, b) => a.round - b.round);

  const scheduledResults: ScheduledMatch[] = [];
  let matchPointer = 0;

  for (let dayIndex = 0; dayIndex < days.length; dayIndex++) {
    const day = days[dayIndex];
    const remainingDays = days.length - dayIndex;
    const remainingMatches = queuedMatches.length - matchPointer;

    if (remainingMatches <= 0) break;

    const dayStartMin = timeStringToMinutes(day.startTime);

    // Dynamic quota: use maxMatches or distribute evenly across remaining days
    const matchesToday =
      day.maxMatches !== undefined
        ? Math.min(day.maxMatches, remainingMatches)
        : Math.ceil(remainingMatches / remainingDays);

    // Track when each pitch is next free on this day
    const pitchNextFreeMin = new Map<string, number>();
    for (const p of sortedPitches) {
      pitchNextFreeMin.set(p.id, dayStartMin);
    }

    // Track when each player is next ready on this day (including rest interval)
    const playerReadyMin = new Map<string, number>();

    let dayScheduled = 0;

    while (matchPointer < queuedMatches.length && dayScheduled < matchesToday) {
      const match = queuedMatches[matchPointer];
      const p1 = match.player1Id;
      const p2 = match.player2Id;

      // Find the pitch that yields the earliest valid match start time
      let bestPitchId: string | null = null;
      let earliestStartTime = Infinity;

      for (const pitch of sortedPitches) {
        const pitchFree = pitchNextFreeMin.get(pitch.id)!;
        const p1Ready = playerReadyMin.get(p1) ?? dayStartMin;
        const p2Ready = playerReadyMin.get(p2) ?? dayStartMin;

        const candidateStart = Math.max(pitchFree, p1Ready, p2Ready);

        if (candidateStart < earliestStartTime) {
          earliestStartTime = candidateStart;
          bestPitchId = pitch.id;
        }
      }

      if (!bestPitchId) {
        break;
      }

      const matchStartMin = earliestStartTime;
      const matchEndMin = matchStartMin + matchDuration;

      // Update state
      pitchNextFreeMin.set(bestPitchId, matchEndMin);
      playerReadyMin.set(p1, matchEndMin + restInterval);
      playerReadyMin.set(p2, matchEndMin + restInterval);

      scheduledResults.push({
        matchId: match.id,
        round: match.round,
        player1Id: match.player1Id,
        player2Id: match.player2Id,
        dayId: day.id,
        date: day.date,
        pitchId: bestPitchId,
        pitchName: pitchMap.get(bestPitchId)?.name ?? bestPitchId,
        startTime: minutesToTimeString(matchStartMin),
        endTime: minutesToTimeString(matchEndMin),
        startTimestamp: buildEpochMs(day.date, matchStartMin),
        endTimestamp: buildEpochMs(day.date, matchEndMin),
      });

      matchPointer++;
      dayScheduled++;
    }
  }

  return scheduledResults;
}

/**
 * Quality-assurance validator to assert zero overlapping matches for any pitch or player,
 * and compliance with rest interval rules.
 */
export function validateScheduleIntegrity(
  schedule: ScheduledMatch[],
  requiredRestInterval: number = 10
): {
  isValid: boolean;
  pitchOverlaps: string[];
  playerOverlaps: string[];
  restViolations: string[];
} {
  const pitchOverlaps: string[] = [];
  const playerOverlaps: string[] = [];
  const restViolations: string[] = [];

  for (let i = 0; i < schedule.length; i++) {
    for (let j = i + 1; j < schedule.length; j++) {
      const m1 = schedule[i];
      const m2 = schedule[j];

      // Only compare matches on the same date
      if (m1.date !== m2.date) continue;

      const overlap = m1.startTimestamp < m2.endTimestamp && m2.startTimestamp < m1.endTimestamp;

      // Check pitch collision
      if (m1.pitchId === m2.pitchId && overlap) {
        pitchOverlaps.push(
          `Pitch ${m1.pitchName} collision: match ${m1.matchId} (${m1.startTime}-${m1.endTime}) and match ${m2.matchId} (${m2.startTime}-${m2.endTime})`
        );
      }

      // Check player collision
      const commonPlayers = [m1.player1Id, m1.player2Id].filter(
        (p) => p === m2.player1Id || p === m2.player2Id
      );

      for (const p of commonPlayers) {
        if (overlap) {
          playerOverlaps.push(
            `Player ${p} double-booking: match ${m1.matchId} and match ${m2.matchId}`
          );
        } else {
          // Check rest violation: if one finishes right before the other
          const gapMs =
            m1.startTimestamp < m2.startTimestamp
              ? m2.startTimestamp - m1.endTimestamp
              : m1.startTimestamp - m2.endTimestamp;

          const gapMinutes = gapMs / (1000 * 60);
          if (gapMinutes < requiredRestInterval) {
            restViolations.push(
              `Player ${p} rest violation between match ${m1.matchId} and ${m2.matchId}: gap is ${gapMinutes} min (required: ${requiredRestInterval})`
            );
          }
        }
      }
    }
  }

  return {
    isValid: pitchOverlaps.length === 0 && playerOverlaps.length === 0 && restViolations.length === 0,
    pitchOverlaps,
    playerOverlaps,
    restViolations,
  };
}
