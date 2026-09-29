import React, { useState, useEffect, useMemo } from "react";
import { FullTournamentData, useQuery, useMutation, api, EnrichedMatchDoc } from "../lib/convex-client";
import { validateMatchScore } from "../engine/scoring";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import {
  Scale,
  Plus,
  Minus,
  RotateCcw,
  Flag,
  CheckCircle2,
  AlertCircle,
  X,
  Radio,
  Clock,
  Layers,
} from "lucide-react";

export interface RefereeTerminalProps {
  tournament: FullTournamentData;
  refereeSecret?: string;
}

export interface UndoGraceState {
  matchId: string;
  previousSets: { s1: number; s2: number }[];
  previousStatus: "pending" | "in_progress" | "completed";
  expiresAt: number;
}

export const RefereeTerminal: React.FC<RefereeTerminalProps> = ({
  tournament,
  refereeSecret,
}) => {
  const pitches = tournament.pitches || [];

  // Determine initial pitch selection based on pitch-specific refereeSecret
  const defaultPitchId = useMemo(() => {
    if (refereeSecret) {
      const matchedPitch = pitches.find((p) => p.refereeSecret === refereeSecret);
      if (matchedPitch) return matchedPitch._id;
    }
    return pitches[0]?._id || "all";
  }, [pitches, refereeSecret]);

  const [selectedPitchId, setSelectedPitchId] = useState<string>(defaultPitchId);
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);

  // Queries & Mutations
  const matches: EnrichedMatchDoc[] = useQuery(api.matches.listByTournament, {
    tournamentId: tournament._id,
  }) || [];

  const updateScore = useMutation(api.matches.updateScore);
  const setWalkover = useMutation(api.matches.setWalkover);

  // Filter matches for selected pitch
  const pitchMatches = useMemo(() => {
    if (selectedPitchId === "all") return matches;
    return matches.filter((m) => m.pitchId === selectedPitchId);
  }, [matches, selectedPitchId]);

  // Active match selection
  const activeMatch = useMemo(() => {
    if (activeMatchId) {
      const found = matches.find((m) => m._id === activeMatchId);
      if (found) return found;
    }
    // Default to first in_progress or pending match on this pitch
    const inProgress = pitchMatches.find((m) => m.status === "in_progress");
    if (inProgress) return inProgress;
    const pending = pitchMatches.find((m) => m.status === "pending");
    return pending || pitchMatches[0] || null;
  }, [activeMatchId, matches, pitchMatches]);

  // Local live score state for current set
  const [currentSets, setCurrentSets] = useState<{ s1: number; s2: number }[]>([{ s1: 0, s2: 0 }]);
  const [activeSetIndex, setActiveSetIndex] = useState(0);

  // Sync currentSets when activeMatch changes
  useEffect(() => {
    if (activeMatch) {
      if (activeMatch.sets && activeMatch.sets.length > 0) {
        setCurrentSets(activeMatch.sets);
        setActiveSetIndex(activeMatch.sets.length - 1);
      } else {
        setCurrentSets([{ s1: 0, s2: 0 }]);
        setActiveSetIndex(0);
      }
    }
  }, [activeMatch?._id]);

  // 15-second undo grace window state
  const [undoGrace, setUndoGrace] = useState<UndoGraceState | null>(null);
  const [undoProgressPercent, setUndoProgressPercent] = useState<number>(100);

  useEffect(() => {
    if (!undoGrace) return;

    const interval = setInterval(() => {
      const remainingMs = undoGrace.expiresAt - Date.now();
      if (remainingMs <= 0) {
        setUndoGrace(null);
        setUndoProgressPercent(0);
      } else {
        setUndoProgressPercent((remainingMs / 15000) * 100);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [undoGrace]);

  // Walkover modal state
  const [isWalkoverModalOpen, setIsWalkoverModalOpen] = useState(false);
  const [walkoverWinnerId, setWalkoverWinnerId] = useState<string>("");
  const [walkoverReason, setWalkoverReason] = useState<string>("Nieobecność");

  const sportRules = tournament.sportRules;

  // Active set scores
  const activeSet = currentSets[activeSetIndex] || { s1: 0, s2: 0 };

  // Win-by-2 and decider badges logic
  const isWinByTwoActive = useMemo(() => {
    if (!sportRules.winByTwo) return false;
    const target = sportRules.targetPointsPerUnit;
    return activeSet.s1 >= target - 1 && activeSet.s2 >= target - 1;
  }, [activeSet, sportRules]);

  const isDeciderSet = useMemo(() => {
    if (!sportRules.hasDeciderTiebreak) return false;
    // When sets won are tied at decider threshold (e.g. 1-1 in BO3)
    let p1Wins = 0;
    let p2Wins = 0;
    for (let i = 0; i < activeSetIndex; i++) {
      if (currentSets[i].s1 > currentSets[i].s2) p1Wins++;
      else if (currentSets[i].s2 > currentSets[i].s1) p2Wins++;
    }
    return p1Wins === sportRules.deciderThreshold && p2Wins === sportRules.deciderThreshold;
  }, [currentSets, activeSetIndex, sportRules]);

  // Score adjustments
  const handleScoreDelta = (playerNum: 1 | 2, delta: number) => {
    setCurrentSets((prev) => {
      const next = [...prev];
      const target = { ...next[activeSetIndex] };
      if (playerNum === 1) {
        target.s1 = Math.max(0, target.s1 + delta);
      } else {
        target.s2 = Math.max(0, target.s2 + delta);
      }
      next[activeSetIndex] = target;
      return next;
    });
  };

  // Submit set score or match completion
  const handleSaveCurrentScore = async () => {
    if (!activeMatch) return;

    // Snapshot for 15s undo grace window
    const snapshot: UndoGraceState = {
      matchId: activeMatch._id,
      previousSets: activeMatch.sets || [],
      previousStatus: activeMatch.status,
      expiresAt: Date.now() + 15000,
    };

    try {
      await updateScore({
        matchId: activeMatch._id,
        sets: currentSets,
        refereeSecret,
      });

      // Activate 15s undo grace window
      setUndoGrace(snapshot);
      setUndoProgressPercent(100);
    } catch (e: any) {
      console.error("Failed to update score", e);
    }
  };

  // Advance to next set
  const handleNextSet = () => {
    setCurrentSets((prev) => [...prev, { s1: 0, s2: 0 }]);
    setActiveSetIndex((prev) => prev + 1);
  };

  // Undo grace execution
  const handleUndo = async () => {
    if (!undoGrace) return;
    try {
      await updateScore({
        matchId: undoGrace.matchId,
        sets: undoGrace.previousSets,
        refereeSecret,
      });
      setCurrentSets(undoGrace.previousSets.length > 0 ? undoGrace.previousSets : [{ s1: 0, s2: 0 }]);
      setActiveSetIndex(Math.max(0, undoGrace.previousSets.length - 1));
      setUndoGrace(null);
    } catch (e) {
      console.error("Undo failed", e);
    }
  };

  const handleOpenWalkover = () => {
    if (!activeMatch) return;
    setWalkoverWinnerId(activeMatch.player1Id);
    setWalkoverReason("Nieobecność");
    setIsWalkoverModalOpen(true);
  };

  const handleConfirmWalkover = async () => {
    if (!activeMatch || !walkoverWinnerId) return;
    try {
      await setWalkover({
        matchId: activeMatch._id,
        winnerPlayerId: walkoverWinnerId,
        refereeSecret,
        reason: walkoverReason,
      });
      setIsWalkoverModalOpen(false);
    } catch (e: any) {
      console.error("Walkover failed", e);
    }
  };

  const selectedPitch = pitches.find((p) => p._id === selectedPitchId);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Top Header Card */}
      <Card className="p-4 sm:p-5 bg-neutral-900/60 border border-white/10 backdrop-blur-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="amber" size="sm">
                TERMINAL SĘDZIEGO
              </Badge>
              <span className="text-xs font-mono text-neutral-400">PITCH-SIDE</span>
            </div>
            <h1 className="text-xl font-bold text-white mt-0.5">{tournament.name}</h1>
          </div>
        </div>

        {/* Pitch Selector Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
          <button
            onClick={() => setSelectedPitchId("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              selectedPitchId === "all"
                ? "bg-amber-500 text-black font-bold"
                : "bg-white/[0.05] text-neutral-400 hover:text-white"
            }`}
          >
            Wszystkie stoły
          </button>
          {pitches.map((p) => (
            <button
              key={p._id}
              onClick={() => setSelectedPitchId(p._id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                selectedPitchId === p._id
                  ? "bg-amber-500 text-black font-bold"
                  : "bg-white/[0.05] text-neutral-400 hover:text-white"
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </Card>

      {/* Match Queue Carousel / Pills for Current Pitch */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {pitchMatches.map((m) => (
          <button
            key={m._id}
            onClick={() => setActiveMatchId(m._id)}
            className={`px-3 py-2 rounded-xl text-left border text-xs transition-all shrink-0 ${
              activeMatch?._id === m._id
                ? "border-amber-500 bg-amber-500/10 text-white"
                : "border-white/10 bg-neutral-900/40 text-neutral-400 hover:text-white"
            }`}
          >
            <div className="font-mono text-[10px] text-neutral-400">
              R{m.roundNumber} • {m.time || "18:00"}
            </div>
            <div className="font-semibold truncate max-w-[140px]">
              {m.player1?.name || "P1"} vs {m.player2?.name || "P2"}
            </div>
          </button>
        ))}
        {pitchMatches.length === 0 && (
          <div className="text-xs text-neutral-500 py-2">Brak meczów na wybranym stole.</div>
        )}
      </div>

      {/* Active Match Tactical Big-Button Scorekeeper */}
      {activeMatch ? (
        <Card className="p-6 sm:p-8 bg-neutral-900/70 border border-white/10 backdrop-blur-2xl rounded-3xl space-y-6 shadow-2xl">
          {/* Match Status Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="neutral" size="sm">
                RUNDA {activeMatch.roundNumber}
              </Badge>
              <span className="text-xs font-mono text-neutral-400">
                {activeMatch.pitch?.name || "Stół"} • {activeMatch.time || "18:00"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {isWinByTwoActive && (
                <Badge variant="amber" dot size="sm">
                  GRA NA PRZEWAGI (+2)
                </Badge>
              )}
              {isDeciderSet && (
                <Badge variant="rose" dot size="sm">
                  DECYDUJĄCY SET (DO {sportRules.deciderPoints} PKT)
                </Badge>
              )}
            </div>
          </div>

          {/* Past Sets Chips Bar */}
          <div className="flex items-center justify-center gap-2 text-xs font-mono">
            {currentSets.map((s, idx) => (
              <button
                key={idx}
                onClick={() => setActiveSetIndex(idx)}
                className={`px-3 py-1.5 rounded-lg border font-bold transition-all ${
                  activeSetIndex === idx
                    ? "border-amber-500 bg-amber-500/20 text-amber-300"
                    : "border-white/10 bg-black/30 text-neutral-400"
                }`}
              >
                Set {idx + 1}: {s.s1}:{s.s2}
              </button>
            ))}
          </div>

          {/* Tactical Big-Button Split Columns */}
          <div className="grid grid-cols-2 gap-4 sm:gap-6 pt-2">
            {/* Player 1 Column */}
            <div className="flex flex-col items-center p-4 sm:p-6 rounded-2xl bg-neutral-950/70 border border-white/10 space-y-4">
              <div className="text-center w-full">
                <span className="text-[10px] uppercase font-mono tracking-widest text-neutral-400">
                  Zawodnik 1
                </span>
                <h3 className="text-lg sm:text-xl font-bold text-white truncate mt-0.5">
                  {activeMatch.player1?.name || "Zawodnik 1"}
                </h3>
              </div>

              {/* Giant Digits */}
              <div className="font-mono text-6xl sm:text-7xl font-extrabold text-white tracking-wider my-2 select-none">
                {activeSet.s1}
              </div>

              {/* Big Touch +1 Button (min 80px / h-20) */}
              <button
                type="button"
                onClick={() => handleScoreDelta(1, 1)}
                className="w-full h-20 sm:h-24 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.96] text-black font-extrabold text-3xl flex items-center justify-center shadow-lg shadow-emerald-950/50 transition-all select-none"
              >
                <Plus className="w-8 h-8 stroke-[3]" />
              </button>

              {/* Correction -1 Button (h-10) */}
              <button
                type="button"
                onClick={() => handleScoreDelta(1, -1)}
                className="w-full h-10 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] active:scale-[0.96] text-neutral-400 hover:text-white font-bold text-sm flex items-center justify-center border border-white/10 transition-all select-none"
              >
                <Minus className="w-4 h-4 mr-1" /> -1
              </button>
            </div>

            {/* Player 2 Column */}
            <div className="flex flex-col items-center p-4 sm:p-6 rounded-2xl bg-neutral-950/70 border border-white/10 space-y-4">
              <div className="text-center w-full">
                <span className="text-[10px] uppercase font-mono tracking-widest text-neutral-400">
                  Zawodnik 2
                </span>
                <h3 className="text-lg sm:text-xl font-bold text-white truncate mt-0.5">
                  {activeMatch.player2?.name || "Zawodnik 2"}
                </h3>
              </div>

              {/* Giant Digits */}
              <div className="font-mono text-6xl sm:text-7xl font-extrabold text-white tracking-wider my-2 select-none">
                {activeSet.s2}
              </div>

              {/* Big Touch +1 Button (min 80px / h-20) */}
              <button
                type="button"
                onClick={() => handleScoreDelta(2, 1)}
                className="w-full h-20 sm:h-24 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.96] text-black font-extrabold text-3xl flex items-center justify-center shadow-lg shadow-emerald-950/50 transition-all select-none"
              >
                <Plus className="w-8 h-8 stroke-[3]" />
              </button>

              {/* Correction -1 Button (h-10) */}
              <button
                type="button"
                onClick={() => handleScoreDelta(2, -1)}
                className="w-full h-10 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] active:scale-[0.96] text-neutral-400 hover:text-white font-bold text-sm flex items-center justify-center border border-white/10 transition-all select-none"
              >
                <Minus className="w-4 h-4 mr-1" /> -1
              </button>
            </div>
          </div>

          {/* Tactical Bottom Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-white/10">
            <Button
              variant="danger"
              size="sm"
              onClick={handleOpenWalkover}
              className="gap-1.5 text-xs"
            >
              <Flag className="w-4 h-4" />
              Zarejestruj Walkower
            </Button>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleNextSet}
                className="gap-1 text-xs"
              >
                <Layers className="w-4 h-4" />
                Nowy Set
              </Button>

              <Button
                variant="primary"
                size="md"
                onClick={handleSaveCurrentScore}
                className="gap-1.5 font-bold px-6 shadow-lg shadow-emerald-950/40"
              >
                <CheckCircle2 className="w-4 h-4" />
                Zatwierdź Wynik
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="p-12 text-center text-neutral-500 space-y-3">
          <Scale className="w-10 h-10 mx-auto text-neutral-600" />
          <p className="text-sm">Brak aktywnego meczu do sędziowania na tym stole.</p>
        </Card>
      )}

      {/* 15-Second Undo Grace Window Toast */}
      {undoGrace && (
        <div className="fixed bottom-6 inset-x-4 max-w-md mx-auto z-50 bg-neutral-900 border border-amber-500/40 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-2xl animate-in fade-in slide-in-from-bottom-5">
          {/* Animated Progress Bar */}
          <div
            className="h-1 bg-amber-500 transition-all ease-linear"
            style={{ width: `${undoProgressPercent}%` }}
          />

          <div className="p-4 flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                <Clock className="w-3.5 h-3.5" />
                <span>Zapisano wynik seta. Cofnij (15s)</span>
              </div>
              <p className="text-[11px] text-neutral-400">
                Możesz cofnąć ostatnią akcję przed zatwierdzeniem do tabeli.
              </p>
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={handleUndo}
              className="gap-1.5 text-xs font-bold shrink-0 bg-white/[0.1] hover:bg-white/[0.2]"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Cofnij
            </Button>
          </div>
        </div>
      )}

      {/* Deliberate Walkover Modal */}
      {isWalkoverModalOpen && activeMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <Card className="max-w-md w-full p-6 space-y-5 bg-neutral-900 border-white/10 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h3 className="font-bold text-white text-base">Zarejestruj Walkower</h3>
              <button
                onClick={() => setIsWalkoverModalOpen(false)}
                className="text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <label className="text-xs text-neutral-400 font-medium">
                Krok 1: Wskaż zwycięzcę przez walkower:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setWalkoverWinnerId(activeMatch.player1Id)}
                  className={`p-3 rounded-xl border text-sm font-semibold transition-all ${
                    walkoverWinnerId === activeMatch.player1Id
                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-300"
                      : "border-white/10 bg-neutral-950 text-neutral-300"
                  }`}
                >
                  {activeMatch.player1?.name || "Zawodnik 1"}
                </button>
                <button
                  type="button"
                  onClick={() => setWalkoverWinnerId(activeMatch.player2Id)}
                  className={`p-3 rounded-xl border text-sm font-semibold transition-all ${
                    walkoverWinnerId === activeMatch.player2Id
                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-300"
                      : "border-white/10 bg-neutral-950 text-neutral-300"
                  }`}
                >
                  {activeMatch.player2?.name || "Zawodnik 2"}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-neutral-400 font-medium">
                Krok 2: Wybierz powód walkowera:
              </label>
              <div className="flex flex-wrap gap-2">
                {["Nieobecność", "Spóźnienie > 15 min", "Kontuzja", "Inny"].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setWalkoverReason(r)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      walkoverReason === r
                        ? "bg-rose-500 text-white"
                        : "bg-white/[0.05] text-neutral-400 hover:text-white"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsWalkoverModalOpen(false)}
              >
                Anuluj
              </Button>
              <Button variant="danger" size="sm" onClick={handleConfirmWalkover}>
                Zatwierdź Walkower
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
