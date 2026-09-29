import React, { useState, useEffect, useMemo } from "react";
import {
  FullTournamentData,
  useQuery,
  useMutation,
  api,
  MatchDoc,
  PlayerDoc,
  PitchDoc,
  DayDoc,
} from "../lib/convex-client";
import { validateMatchScore } from "../engine/scoring";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import {
  User,
  Clock,
  Coffee,
  CheckCircle2,
  AlertCircle,
  Lock,
  Plus,
  Minus,
  X,
  ChevronRight,
  ShieldCheck,
  Calendar,
} from "lucide-react";

export interface EnrichedPlayerMatchDoc extends MatchDoc {
  opponent?: PlayerDoc;
  pitch?: PitchDoc;
  day?: DayDoc;
  isPlayer1?: boolean;
}

export interface PlayerTerminalProps {
  tournament: FullTournamentData;
  playerSecret?: string;
}

export function useCountdown(targetTimestamp?: number | null) {
  const [remainingMs, setRemainingMs] = useState<number>(() => {
    if (!targetTimestamp) return 0;
    return Math.max(0, targetTimestamp - Date.now());
  });

  useEffect(() => {
    if (!targetTimestamp) {
      setRemainingMs(0);
      return;
    }

    const update = () => {
      const diff = targetTimestamp - Date.now();
      setRemainingMs(diff);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [targetTimestamp]);

  const isPast = remainingMs <= 0;
  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));

  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;

  const hours = String(h).padStart(2, "0");
  const minutes = String(m).padStart(2, "0");
  const seconds = String(s).padStart(2, "0");

  return { hours, minutes, seconds, isPast, totalSeconds };
}

export const PlayerTerminal: React.FC<PlayerTerminalProps> = ({
  tournament,
  playerSecret,
}) => {
  // Query player data by secret
  const authData = useQuery(
    api.players.getBySecret,
    playerSecret ? { secretCode: playerSecret } : "skip" as any
  );

  const toggleCheckIn = useMutation(api.players.toggleCheckIn);
  const submitScore = useMutation(api.matches.submitPlayerScore);

  const player = authData?.player;
  const sportRules = authData?.sportRules || tournament.sportRules;

  // Query matches for this player
  const playerMatchesData = useQuery(
    api.matches.getMatchesForPlayer,
    player
      ? {
          tournamentId: tournament._id,
          playerId: player._id,
        }
      : "skip" as any
  );

  const upcomingMatch = playerMatchesData?.upcomingMatch as EnrichedPlayerMatchDoc | undefined;
  const matches: EnrichedPlayerMatchDoc[] = playerMatchesData?.matches || [];
  const byeRounds: number[] = playerMatchesData?.byeRounds || [];

  // Filter tabs for schedule
  const [scheduleFilter, setScheduleFilter] = useState<"all" | "pending" | "completed">("all");

  // Score submission drawer state
  const [isScoreDrawerOpen, setIsScoreDrawerOpen] = useState(false);
  const [selectedMatchForScore, setSelectedMatchForScore] = useState<EnrichedPlayerMatchDoc | null>(null);
  const [setsInput, setSetsInput] = useState<{ s1: number; s2: number }[]>([{ s1: 0, s2: 0 }]);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Active round detection
  const currentRound = useMemo(() => {
    if (upcomingMatch?.roundNumber) return upcomingMatch.roundNumber;
    const pending = matches.filter((m) => m.status !== "completed");
    if (pending.length > 0) {
      return Math.min(...pending.map((m) => m.roundNumber));
    }
    return 1;
  }, [upcomingMatch, matches]);

  const isCurrentRoundBye = byeRounds.includes(currentRound) && !upcomingMatch;

  // Real-time countdown to upcoming match
  const matchTimestamp = useMemo(() => {
    if (!upcomingMatch) return null;
    if (upcomingMatch.startTimestamp) return upcomingMatch.startTimestamp;
    if (upcomingMatch.day?.date && upcomingMatch.time) {
      return Date.parse(`${upcomingMatch.day.date}T${upcomingMatch.time}:00Z`);
    }
    return null;
  }, [upcomingMatch]);

  const { hours, minutes, seconds, isPast } = useCountdown(matchTimestamp);

  const handleToggleCheckIn = async () => {
    if (!player || !playerSecret) return;
    try {
      await toggleCheckIn({
        playerId: player._id,
        playerSecret,
        checkedIn: !player.checkedIn,
      });
      setSuccessToast(
        !player.checkedIn ? "Potwierdzono obecność na turnieju!" : "Cofnięto status odprawy"
      );
      setTimeout(() => setSuccessToast(null), 3000);
    } catch (e: any) {
      setSubmissionError(e.message);
    }
  };

  const handleOpenScoreDrawer = (match: EnrichedPlayerMatchDoc) => {
    setSelectedMatchForScore(match);
    if (match.sets && match.sets.length > 0) {
      setSetsInput(match.sets);
    } else {
      setSetsInput([{ s1: 0, s2: 0 }]);
    }
    setSubmissionError(null);
    setIsScoreDrawerOpen(true);
  };

  const scoreValidation = useMemo(() => {
    return validateMatchScore(setsInput, sportRules);
  }, [setsInput, sportRules]);

  const handleSubmitScore = async () => {
    if (!selectedMatchForScore || !playerSecret) return;
    if (!scoreValidation.isValid) {
      setSubmissionError(scoreValidation.error || "Niepoprawny wynik seta");
      return;
    }

    setIsSubmitting(true);
    setSubmissionError(null);
    try {
      await submitScore({
        matchId: selectedMatchForScore._id,
        playerSecret,
        sets: setsInput,
      });
      setSuccessToast("Zapisano wynik spotkania!");
      setTimeout(() => setSuccessToast(null), 3000);
      setIsScoreDrawerOpen(false);
    } catch (err: any) {
      setSubmissionError(err.message || "Błąd zapisu wyniku");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 1. Error state if secret code is invalid
  if (authData === null || !playerSecret) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center space-y-5 border-white/10 bg-neutral-900/60 backdrop-blur-xl">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 mx-auto flex items-center justify-center">
            <AlertCircle className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-white">
              Nieprawidłowy lub wygasły link zawodnika
            </h2>
            <p className="text-sm text-neutral-400">
              Podany kod dostępu nie istnieje lub turniej został zakończony. Skontaktuj się z
              organizatorem turnieju, aby uzyskać aktualny odnośnik.
            </p>
          </div>
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => window.location.assign(`/${tournament.slug}`)}
          >
            Przejdź do portalu turnieju
          </Button>
        </Card>
      </div>
    );
  }

  // Loading state
  if (!player) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-neutral-400">
        <div className="flex items-center gap-3 font-mono text-sm uppercase">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          <span>Weryfikacja tożsamości zawodnika...</span>
        </div>
      </div>
    );
  }

  const isPlayerScoreSubmissionAllowed = Boolean(tournament.allowPlayerScoreSubmission);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Toast Alert */}
      {successToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-neutral-900 border border-emerald-500/40 text-emerald-300 text-sm px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 backdrop-blur-xl animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Player Header Banner */}
      <Card className="p-6 bg-neutral-900/40 border border-white/10 backdrop-blur-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center text-xl font-extrabold font-mono">
            {player.name
              .split(" ")
              .map((w: string) => w[0])
              .join("")}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="emerald" size="sm">
                TERMINAL ZAWODNIKA
              </Badge>
              <span className="text-xs font-mono text-neutral-400">
                Slot #{player.groupSlotIndex ?? "-"}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-white mt-1">{player.name}</h1>
            <p className="text-xs text-neutral-400">{tournament.name}</p>
          </div>
        </div>

        <button
          onClick={handleToggleCheckIn}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            player.checkedIn
              ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20"
              : "bg-white/[0.05] border border-white/10 text-neutral-400 hover:text-white"
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>{player.checkedIn ? "Obecność potwierdzona" : "Zamelduj obecność"}</span>
        </button>
      </Card>

      {/* Next Match Spotlight Hero Card */}
      {upcomingMatch && (
        <Card className="p-6 sm:p-8 bg-gradient-to-b from-neutral-900/80 via-neutral-900/40 to-neutral-950 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-xl space-y-6">
          <div className="flex items-center justify-between">
            <Badge variant="cyan" size="sm">
              NAJBLIŻSZY MECZ • RUNDA {upcomingMatch.roundNumber}
            </Badge>
            <span className="text-xs font-mono text-neutral-400">
              {upcomingMatch.pitch?.name || "Stół"} • {upcomingMatch.time || "Godzina TBD"}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 py-2">
            <div className="text-center sm:text-left">
              <span className="text-xs uppercase font-mono tracking-wider text-neutral-400">
                Twój rywal
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
                {upcomingMatch.opponent?.name || "Oczekuje na rywala"}
              </h2>
            </div>

            {/* Countdown Timer Block */}
            <div className="flex flex-col items-center sm:items-end">
              <span className="text-[10px] uppercase font-mono tracking-widest text-neutral-400 mb-1">
                Czas do rozpoczęcia
              </span>
              {upcomingMatch.status === "in_progress" ? (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-xs uppercase tracking-wider">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Mecz na żywo • Trwa gra
                </div>
              ) : isPast ? (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 font-mono text-xs uppercase tracking-wider">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  Czas na rozpoczęcie meczu • Zgłoś się do stołu
                </div>
              ) : (
                <div className="flex items-center gap-1.5 font-mono text-2xl sm:text-3xl font-extrabold text-white">
                  <div className="flex flex-col items-center">
                    <span className="tabular-nums">{hours}</span>
                    <span className="text-[8px] uppercase text-neutral-500 font-sans">godz</span>
                  </div>
                  <span className="text-neutral-600 -translate-y-1">:</span>
                  <div className="flex flex-col items-center">
                    <span className="tabular-nums">{minutes}</span>
                    <span className="text-[8px] uppercase text-neutral-500 font-sans">min</span>
                  </div>
                  <span className="text-neutral-600 -translate-y-1">:</span>
                  <div className="flex flex-col items-center">
                    <span className="tabular-nums text-emerald-400">{seconds}</span>
                    <span className="text-[8px] uppercase text-neutral-500 font-sans">sek</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Conditional Score Button or Lock Message */}
          <div className="pt-4 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-xs text-neutral-400">
              Dyscyplina: {sportRules.singularUnit} do {sportRules.targetPointsPerUnit} pkt
            </span>

            {isPlayerScoreSubmissionAllowed ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleOpenScoreDrawer(upcomingMatch)}
                className="w-full sm:w-auto"
              >
                Wprowadź wynik meczu
              </Button>
            ) : (
              <span className="text-xs text-amber-400/90 flex items-center gap-1 font-medium">
                <Lock className="w-3.5 h-3.5" />
                Wynik wprowadza sędzia
              </span>
            )}
          </div>
        </Card>
      )}

      {/* Assigned Round Bye Status Card */}
      {isCurrentRoundBye && (
        <Card className="p-6 bg-neutral-900/50 border border-white/10 rounded-2xl space-y-4 backdrop-blur-xl">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-neutral-300 shrink-0">
              <Coffee className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="neutral" size="sm">
                  RUNDA {currentRound} • PAUZA (BYE)
                </Badge>
                <span className="text-xs font-mono text-neutral-500">Pauza w tej rundzie</span>
              </div>
              <h3 className="text-lg font-bold text-white">Masz wolny los w tej rundzie</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                W bieżącej rundzie masz przerwę na odpoczynek (Bye). Możesz zregenerować siły i
                obserwować mecze swoich rywali przed kolejnym pojedynkiem.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Read-Only Lock Banner if Player Score Submission is Disabled */}
      {!isPlayerScoreSubmissionAllowed && (
        <div className="rounded-2xl bg-amber-500/[0.06] border border-amber-500/20 p-4 sm:p-5 flex items-start gap-3.5 backdrop-blur-md">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
            <Lock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-semibold tracking-tight text-amber-200">
              Wyniki mogą wprowadzać wyłącznie sędziowie i organizatorzy
            </h4>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Wprowadzanie wyników zostało zablokowane dla zawodników przez organizatora turnieju.
              Wszelkie rezultaty zatwierdza sędzia przy stole.
            </p>
          </div>
        </div>
      )}

      {/* Personal Match Schedule Timeline */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-400" />
            Twój Terminarz Meczów ({matches.length})
          </h2>

          <div className="flex items-center gap-1 bg-neutral-900/60 p-1 rounded-xl border border-white/5 text-xs">
            <button
              onClick={() => setScheduleFilter("all")}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                scheduleFilter === "all" ? "bg-white/[0.1] text-white" : "text-neutral-400"
              }`}
            >
              Wszystkie
            </button>
            <button
              onClick={() => setScheduleFilter("pending")}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                scheduleFilter === "pending" ? "bg-white/[0.1] text-white" : "text-neutral-400"
              }`}
            >
              Do rozegrania
            </button>
            <button
              onClick={() => setScheduleFilter("completed")}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                scheduleFilter === "completed" ? "bg-white/[0.1] text-white" : "text-neutral-400"
              }`}
            >
              Zakończone
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {matches
            .filter((m) => {
              if (scheduleFilter === "pending") return m.status !== "completed";
              if (scheduleFilter === "completed") return m.status === "completed";
              return true;
            })
            .map((m) => {
              const isWon = m.winnerId === player._id;
              const isLost = m.status === "completed" && !isWon;

              return (
                <Card
                  key={m._id}
                  className="p-4 bg-neutral-900/40 border border-white/10 hover:border-white/20 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs font-mono text-neutral-400">
                      <span>Runda {m.roundNumber}</span>
                      <span>•</span>
                      <span>{m.pitch?.name || "Stół"}</span>
                      <span>•</span>
                      <span>{m.time || "18:00"}</span>
                    </div>
                    <div className="text-base font-semibold text-white">
                      vs {m.opponent?.name || "Rywal"}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {m.sets && m.sets.length > 0 ? (
                      <div className="flex items-center gap-1.5 font-mono text-xs">
                        {m.sets.map((s, idx) => (
                          <span
                            key={idx}
                            className={`px-2 py-1 rounded-md ${
                              (m.isPlayer1 && s.s1 > s.s2) || (!m.isPlayer1 && s.s2 > s.s1)
                                ? "bg-emerald-500/20 text-emerald-300 font-bold"
                                : "bg-neutral-800 text-neutral-400"
                            }`}
                          >
                            {m.isPlayer1 ? `${s.s1}:${s.s2}` : `${s.s2}:${s.s1}`}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <Badge variant="outline" size="sm">
                        Oczekuje
                      </Badge>
                    )}

                    {m.status === "completed" && (
                      <Badge variant={isWon ? "emerald" : "rose"} size="sm">
                        {isWon ? "Wygrana" : "Porażka"}
                      </Badge>
                    )}

                    {isPlayerScoreSubmissionAllowed && m.status !== "completed" && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleOpenScoreDrawer(m)}
                        className="text-xs"
                      >
                        Wynik
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}

          {matches.length === 0 && (
            <Card className="p-8 text-center text-neutral-500 text-xs">
              Brak zaplanowanych meczów dla Twojego profilu.
            </Card>
          )}
        </div>
      </div>

      {/* Score Submission Drawer / Modal */}
      {isScoreDrawerOpen && selectedMatchForScore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <Card className="max-w-md w-full p-6 space-y-5 bg-neutral-900 border-white/10 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div>
                <Badge variant="neutral" size="sm">
                  RUNDA {selectedMatchForScore.roundNumber} • {selectedMatchForScore.pitch?.name || "Stół"}
                </Badge>
                <h3 className="font-bold text-white text-base mt-1">Wprowadź wynik meczu</h3>
              </div>
              <button
                onClick={() => setIsScoreDrawerOpen(false)}
                className="text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-center text-xs font-semibold py-2 px-3 rounded-xl bg-white/[0.02]">
              <span className="text-white truncate">Ty ({player.name})</span>
              <span className="text-neutral-400 truncate">
                {selectedMatchForScore.opponent?.name || "Rywal"}
              </span>
            </div>

            <div className="space-y-3">
              {setsInput.map((s, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-xl bg-neutral-950 border border-white/10"
                >
                  <span className="text-xs font-mono text-neutral-400">
                    {sportRules.singularUnit} {idx + 1}
                  </span>

                  <div className="flex items-center gap-2">
                    {/* Player (Self) stepper */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setSetsInput((prev) => {
                            const next = [...prev];
                            const curr = selectedMatchForScore.isPlayer1 ? next[idx].s1 : next[idx].s2;
                            const updated = Math.max(0, curr - 1);
                            if (selectedMatchForScore.isPlayer1) next[idx].s1 = updated;
                            else next[idx].s2 = updated;
                            return next;
                          });
                        }}
                        className="w-7 h-7 rounded bg-white/[0.05] hover:bg-white/[0.1] text-xs flex items-center justify-center text-white"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <input
                        type="number"
                        min={0}
                        value={selectedMatchForScore.isPlayer1 ? s.s1 : s.s2}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setSetsInput((prev) => {
                            const next = [...prev];
                            if (selectedMatchForScore.isPlayer1) next[idx].s1 = val;
                            else next[idx].s2 = val;
                            return next;
                          });
                        }}
                        className="w-12 h-8 text-center font-mono font-bold rounded bg-neutral-900 border border-white/15 text-white text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setSetsInput((prev) => {
                            const next = [...prev];
                            const curr = selectedMatchForScore.isPlayer1 ? next[idx].s1 : next[idx].s2;
                            const updated = curr + 1;
                            if (selectedMatchForScore.isPlayer1) next[idx].s1 = updated;
                            else next[idx].s2 = updated;
                            return next;
                          });
                        }}
                        className="w-7 h-7 rounded bg-white/[0.05] hover:bg-white/[0.1] text-xs flex items-center justify-center text-white"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <span className="text-neutral-500 font-bold">:</span>

                    {/* Opponent stepper */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setSetsInput((prev) => {
                            const next = [...prev];
                            const curr = selectedMatchForScore.isPlayer1 ? next[idx].s2 : next[idx].s1;
                            const updated = Math.max(0, curr - 1);
                            if (selectedMatchForScore.isPlayer1) next[idx].s2 = updated;
                            else next[idx].s1 = updated;
                            return next;
                          });
                        }}
                        className="w-7 h-7 rounded bg-white/[0.05] hover:bg-white/[0.1] text-xs flex items-center justify-center text-white"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <input
                        type="number"
                        min={0}
                        value={selectedMatchForScore.isPlayer1 ? s.s2 : s.s1}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setSetsInput((prev) => {
                            const next = [...prev];
                            if (selectedMatchForScore.isPlayer1) next[idx].s2 = val;
                            else next[idx].s1 = val;
                            return next;
                          });
                        }}
                        className="w-12 h-8 text-center font-mono font-bold rounded bg-neutral-900 border border-white/15 text-white text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setSetsInput((prev) => {
                            const next = [...prev];
                            const curr = selectedMatchForScore.isPlayer1 ? next[idx].s2 : next[idx].s1;
                            const updated = curr + 1;
                            if (selectedMatchForScore.isPlayer1) next[idx].s2 = updated;
                            else next[idx].s1 = updated;
                            return next;
                          });
                        }}
                        className="w-7 h-7 rounded bg-white/[0.05] hover:bg-white/[0.1] text-xs flex items-center justify-center text-white"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between text-xs">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSetsInput((prev) => [...prev, { s1: 0, s2: 0 }])}
              >
                + Dodaj set
              </Button>
              {setsInput.length > 1 && (
                <button
                  onClick={() => setSetsInput((prev) => prev.slice(0, -1))}
                  className="text-neutral-400 hover:text-rose-400"
                >
                  Usuń set
                </button>
              )}
            </div>

            {/* Live validation feedback */}
            {scoreValidation.isValid ? (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>
                  {scoreValidation.isMatchCompleted
                    ? "Mecz zakończony — wynik jest prawidłowy!"
                    : "Mecz w toku — wynik częściowy."}
                </span>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{scoreValidation.error || "Niepoprawny wynik seta"}</span>
              </div>
            )}

            {submissionError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                {submissionError}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsScoreDrawerOpen(false)}
              >
                Anuluj
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSubmitScore}
                disabled={!scoreValidation.isValid || isSubmitting}
                isLoading={isSubmitting}
              >
                Zatwierdź wynik
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
