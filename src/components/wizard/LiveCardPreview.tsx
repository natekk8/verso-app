import React, { useMemo } from "react";
import { validateMatchScore, type ScoreValidationResult } from "../../engine/scoring";
import { Badge } from "../ui/Badge";
import { Card } from "../ui/Card";
import { cn } from "../ui/utils";
import { CheckCircle2, AlertTriangle, ShieldCheck, Lock, Radio } from "lucide-react";
import type { WizardSportState } from "./types";

export interface LiveCardPreviewProps {
  state: WizardSportState;
  className?: string;
}

export const LiveCardPreview: React.FC<LiveCardPreviewProps> = ({ state, className }) => {
  // Generate simulated realistic match sets according to current sport rules
  const { mockSets, p1SetsWon, p2SetsWon } = useMemo(() => {
    const diff = state.winByTwo ? 2 : 1;
    const target = Math.max(1, state.targetPointsPerUnit);
    const deciderPts = Math.max(1, state.deciderPoints);

    if (state.unitsToWinMatch === 1) {
      // 1 unit to win (e.g. Football 1 połowa)
      const sets = [{ s1: target, s2: Math.max(0, target - diff) }];
      return { mockSets: sets, p1SetsWon: 1, p2SetsWon: 0 };
    }

    if (state.hasDeciderTiebreak && state.unitsToWinMatch === 2) {
      // 2 units to win with decider at 1:1
      const sets = [
        { s1: target, s2: Math.max(0, target - diff) }, // P1 wins set 1
        { s1: Math.max(0, target - diff - 2), s2: target }, // P2 wins set 2
        { s1: deciderPts, s2: Math.max(0, deciderPts - diff) }, // P1 wins decider set 3
      ];
      return { mockSets: sets, p1SetsWon: 2, p2SetsWon: 1 };
    }

    // Default multi-set match where P1 wins unitsToWinMatch sets to 0 (or 1)
    const sets = [];
    for (let i = 0; i < state.unitsToWinMatch; i++) {
      sets.push({
        s1: target,
        s2: Math.max(0, target - diff - (i % 2)),
      });
    }
    return { mockSets: sets, p1SetsWon: state.unitsToWinMatch, p2SetsWon: 0 };
  }, [
    state.unitsToWinMatch,
    state.targetPointsPerUnit,
    state.hasDeciderTiebreak,
    state.deciderPoints,
    state.winByTwo,
  ]);

  // Pure validation check using scoring engine
  const validation: ScoreValidationResult = useMemo(() => {
    return validateMatchScore(mockSets, {
      preset: state.preset,
      singularUnit: state.singularUnit,
      pluralUnit: state.pluralUnit,
      targetPointsPerUnit: state.targetPointsPerUnit,
      unitsToWinMatch: state.unitsToWinMatch,
      hasDeciderTiebreak: state.hasDeciderTiebreak,
      deciderThreshold: state.deciderThreshold,
      deciderPoints: state.deciderPoints,
      winByTwo: state.winByTwo,
    });
  }, [mockSets, state]);

  // Standings points preview calculation
  const pointsAwarded = useMemo(() => {
    if (state.pointsRule === "2_1_matrix") {
      if (p1SetsWon === 2 && p2SetsWon === 1) {
        return { p1: 2, p2: 1, label: "Matrix 2:1 -> 2 pkt dla wygranego, 1 pkt dla przegranego" };
      }
      return { p1: 2, p2: 0, label: "Matrix 2:0 -> 2 pkt dla wygranego, 0 pkt dla przegranego" };
    }
    // standard_3_1_0
    return { p1: 3, p2: 0, label: "Standard 3-1-0 -> 3 pkt dla wygranego, 0 pkt dla przegranego" };
  }, [state.pointsRule, p1SetsWon, p2SetsWon]);

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
          <h4 className="text-xs font-semibold text-neutral-100 tracking-wide uppercase font-mono">
            Podgląd karty meczowej na żywo
          </h4>
        </div>
        <Badge variant="emerald" size="sm" dot pulse>
          Live Preview
        </Badge>
      </div>

      <Card doubleBezel className="border-white/15">
        <div className="space-y-4">
          {/* Card Header */}
          <div className="flex items-center justify-between pb-3 border-b border-white/5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-medium text-neutral-400">
                Runda 1 • Stół 1
              </span>
              <span className="text-neutral-600">•</span>
              <span className="text-xs font-mono text-emerald-400 font-semibold">18:00</span>
            </div>
            <Badge variant="neutral" size="sm">
              Zakończony
            </Badge>
          </div>

          {/* Opponents & Overall Score */}
          <div className="space-y-2.5">
            {/* Player 1 (Winner) */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] border border-emerald-500/30 shadow-[0_0_15px_-3px_rgba(16,185,129,0.15)]">
              <div className="flex items-center gap-2.5">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono text-xs font-bold border border-emerald-500/40">
                  1
                </span>
                <div>
                  <span className="text-sm font-semibold text-white block">
                    Antek Sadowski
                  </span>
                  <span className="text-[10px] text-emerald-400 font-mono">Zwycięzca</span>
                </div>
              </div>
              <span className="font-mono text-xl font-extrabold text-emerald-400 px-2">
                {p1SetsWon}
              </span>
            </div>

            {/* Player 2 */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.01] border border-white/5">
              <div className="flex items-center gap-2.5">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-white/[0.05] text-neutral-400 font-mono text-xs font-bold border border-white/10">
                  8
                </span>
                <div>
                  <span className="text-sm font-medium text-neutral-300 block">
                    Tomasz Borówka
                  </span>
                  <span className="text-[10px] text-neutral-400 font-mono">Uczestnik</span>
                </div>
              </div>
              <span className="font-mono text-xl font-bold text-neutral-400 px-2">
                {p2SetsWon}
              </span>
            </div>
          </div>

          {/* Breakdown of sets with dynamic terminology */}
          <div className="space-y-2 pt-1">
            <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-400 block">
              Rozbicie wyników ({state.pluralUnit}):
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {mockSets.map((set, idx) => {
                const isDecider =
                  state.hasDeciderTiebreak &&
                  state.unitsToWinMatch === 2 &&
                  idx === 2;

                const label = isDecider
                  ? `Decydujący ${state.singularUnit}`
                  : `${state.singularUnit} ${idx + 1}`;

                return (
                  <div
                    key={idx}
                    className={cn(
                      "flex items-center justify-between px-3 py-1.5 rounded-lg border text-xs font-mono",
                      isDecider
                        ? "bg-amber-500/10 border-amber-500/30 text-amber-200"
                        : "bg-neutral-950/60 border-white/10 text-neutral-300"
                    )}
                  >
                    <span className="truncate pr-2">{label}</span>
                    <span className="font-bold text-neutral-100">
                      {set.s1} : {set.s2}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Awarded Standings Points */}
          <div className="p-3 rounded-xl bg-neutral-950/70 border border-white/10 space-y-1.5">
            <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-400 block">
              Przyznane punkty do tabeli:
            </span>
            <div className="flex items-center justify-between text-xs">
              <span className="text-neutral-300">
                Antek: <strong className="text-emerald-400">+{pointsAwarded.p1} pkt</strong>
              </span>
              <span className="text-neutral-300">
                Tomasz: <strong className={pointsAwarded.p2 > 0 ? "text-amber-300" : "text-neutral-400"}>
                  +{pointsAwarded.p2} pkt
                </strong>
              </span>
            </div>
            <p className="text-[10px] text-neutral-400 leading-tight">
              {pointsAwarded.label}
            </p>
          </div>

          {/* Bottom Badges: Validation & Player Submission */}
          <div className="pt-2 flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between">
            {validation.isValid && validation.isMatchCompleted ? (
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Walidacja silnika: Poprawna</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-rose-400 font-mono">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Błąd reguł: {validation.error || "Niespełnione warunki"}</span>
              </div>
            )}

            {state.allowPlayerScoreSubmission ? (
              <div className="flex items-center gap-1.5 text-xs text-neutral-300 font-mono">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Wprowadzanie graczy: Aktywne</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-neutral-400 font-mono">
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>Wprowadzanie graczy: Blokada</span>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};
