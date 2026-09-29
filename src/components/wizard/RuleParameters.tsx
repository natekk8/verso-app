import React from "react";
import { generateDynamicPrompts } from "../../engine/scoring";
import { Input } from "../ui/Input";
import { Switch } from "../ui/Switch";
import { Badge } from "../ui/Badge";
import { cn } from "../ui/utils";
import {
  Target,
  Trophy,
  Flame,
  Scale,
  Award,
  Users,
  Plus,
  Minus,
} from "lucide-react";
import type { WizardSportState } from "./types";

export interface RuleParametersProps {
  state: WizardSportState;
  onChange: (patch: Partial<WizardSportState>) => void;
  className?: string;
}

export const RuleParameters: React.FC<RuleParametersProps> = ({
  state,
  onChange,
  className,
}) => {
  const prompts = generateDynamicPrompts(state.singularUnit, state.pluralUnit);

  const handleNumberChange = (key: keyof WizardSportState, val: number, min = 1) => {
    const clamped = Math.max(min, isNaN(val) ? min : val);
    onChange({ [key]: clamped });
  };

  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex items-center justify-between pb-2 border-b border-white/5">
        <div>
          <h4 className="text-sm font-semibold text-neutral-100 tracking-wide uppercase font-mono">
            Parametry & Reguły Meczu
          </h4>
          <p className="text-xs text-neutral-400">
            Skonfiguruj warunki zakończenia partii, meczu oraz system przyznawania punktów
          </p>
        </div>
      </div>

      {/* Grid of numeric rule steppers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Target Points Prompt */}
        <div className="p-4 rounded-xl bg-neutral-900/60 border border-white/10 space-y-3">
          <div className="flex items-start gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
              <Target className="w-4 h-4" />
            </div>
            <div>
              <label
                htmlFor="targetPointsPerUnit"
                className="text-xs font-semibold text-neutral-200 block leading-snug"
              >
                {prompts.targetPointsPrompt}
              </label>
              <span className="text-[11px] text-neutral-400">
                Docelowa liczba punktów do wygrania jednostki ({state.singularUnit})
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                handleNumberChange("targetPointsPerUnit", state.targetPointsPerUnit - 1, 1)
              }
              className="w-10 h-10 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] active:scale-[0.95] text-neutral-300 hover:text-white border border-white/10 flex items-center justify-center transition-all"
              aria-label="Zmniejsz liczbę punktów"
            >
              <Minus className="w-4 h-4" />
            </button>
            <input
              id="targetPointsPerUnit"
              type="number"
              min={1}
              value={state.targetPointsPerUnit}
              onChange={(e) =>
                handleNumberChange("targetPointsPerUnit", parseInt(e.target.value, 10), 1)
              }
              className="w-full text-center font-mono font-bold text-lg text-emerald-400 bg-neutral-950/70 border border-white/10 rounded-xl py-2 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30"
            />
            <button
              type="button"
              onClick={() =>
                handleNumberChange("targetPointsPerUnit", state.targetPointsPerUnit + 1, 1)
              }
              className="w-10 h-10 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] active:scale-[0.95] text-neutral-300 hover:text-white border border-white/10 flex items-center justify-center transition-all"
              aria-label="Zwiększ liczbę punktów"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Units To Win Prompt */}
        <div className="p-4 rounded-xl bg-neutral-900/60 border border-white/10 space-y-3">
          <div className="flex items-start gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
              <Trophy className="w-4 h-4" />
            </div>
            <div>
              <label
                htmlFor="unitsToWinMatch"
                className="text-xs font-semibold text-neutral-200 block leading-snug"
              >
                {prompts.unitsToWinPrompt}
              </label>
              <span className="text-[11px] text-neutral-400">
                Liczba wygranych partii kończąca mecz (np. 2 dla Bo3, 1 dla Bo1)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                handleNumberChange("unitsToWinMatch", state.unitsToWinMatch - 1, 1)
              }
              className="w-10 h-10 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] active:scale-[0.95] text-neutral-300 hover:text-white border border-white/10 flex items-center justify-center transition-all"
              aria-label="Zmniejsz liczbę partii"
            >
              <Minus className="w-4 h-4" />
            </button>
            <input
              id="unitsToWinMatch"
              type="number"
              min={1}
              value={state.unitsToWinMatch}
              onChange={(e) =>
                handleNumberChange("unitsToWinMatch", parseInt(e.target.value, 10), 1)
              }
              className="w-full text-center font-mono font-bold text-lg text-emerald-400 bg-neutral-950/70 border border-white/10 rounded-xl py-2 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30"
            />
            <button
              type="button"
              onClick={() =>
                handleNumberChange("unitsToWinMatch", state.unitsToWinMatch + 1, 1)
              }
              className="w-10 h-10 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] active:scale-[0.95] text-neutral-300 hover:text-white border border-white/10 flex items-center justify-center transition-all"
              aria-label="Zwiększ liczbę partii"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Tiebreak & Decider Settings */}
      <div className="p-4 rounded-xl bg-neutral-900/60 border border-white/10 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-2.5">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
              <Flame className="w-4 h-4" />
            </div>
            <div>
              <h5 className="text-xs font-semibold text-neutral-200 leading-snug">
                {prompts.deciderTiebreakPrompt}
              </h5>
              <p className="text-xs text-neutral-400 pt-0.5">
                Aktywuje specjalny decydujący {state.singularUnit} ze zmodyfikowaną liczbą punktów przy remisie 1:1
              </p>
            </div>
          </div>
          <Switch
            checked={state.hasDeciderTiebreak}
            onCheckedChange={(checked) =>
              onChange({
                hasDeciderTiebreak: checked,
                deciderThreshold: 1,
                deciderPoints: state.deciderPoints || 15,
              })
            }
          />
        </div>

        {/* Conditional Decider Points Input */}
        {state.hasDeciderTiebreak && (
          <div className="pt-3 border-t border-white/5 pl-9 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
              <label
                htmlFor="deciderPoints"
                className="text-xs font-medium text-neutral-300"
              >
                Punkty w decydującym {state.singularUnit}:
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    handleNumberChange("deciderPoints", state.deciderPoints - 1, 1)
                  }
                  className="w-9 h-9 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] active:scale-[0.95] text-neutral-300 hover:text-white border border-white/10 flex items-center justify-center"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <input
                  id="deciderPoints"
                  type="number"
                  min={1}
                  value={state.deciderPoints}
                  onChange={(e) =>
                    handleNumberChange("deciderPoints", parseInt(e.target.value, 10), 1)
                  }
                  className="w-full text-center font-mono font-bold text-amber-300 bg-neutral-950/70 border border-white/10 rounded-lg py-1.5 focus:outline-none focus:border-amber-500/50"
                />
                <button
                  type="button"
                  onClick={() =>
                    handleNumberChange("deciderPoints", state.deciderPoints + 1, 1)
                  }
                  className="w-9 h-9 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] active:scale-[0.95] text-neutral-300 hover:text-white border border-white/10 flex items-center justify-center"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Win-By-Two Margin Toggle */}
      <div className="p-4 rounded-xl bg-neutral-900/60 border border-white/10 space-y-2">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-2.5">
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shrink-0">
              <Scale className="w-4 h-4" />
            </div>
            <div>
              <h5 className="text-xs font-semibold text-neutral-200 leading-snug">
                Czy wymagana jest przewaga 2 punktów (win-by-2)?
              </h5>
              <p className="text-xs text-neutral-400 pt-0.5">
                Wymaga min. 2 punktów przewagi przy stanie równowagi (np. 12:10, 16:14 zamiast zakończenia na 11:10)
              </p>
            </div>
          </div>
          <Switch
            checked={state.winByTwo}
            onCheckedChange={(checked) => onChange({ winByTwo: checked })}
          />
        </div>
      </div>

      {/* Standings Points Rule */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-emerald-400" />
            <h5 className="text-xs font-semibold text-neutral-200 tracking-wide uppercase font-mono">
              Zasada punktacji tabeli (Points Rule)
            </h5>
          </div>
          <Badge variant={state.pointsRule === "2_1_matrix" ? "emerald" : "cyan"} size="sm">
            {state.pointsRule === "2_1_matrix" ? "Matrix FSS" : "Liga 3-1-0"}
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* 2:1 Matrix */}
          <button
            type="button"
            onClick={() => onChange({ pointsRule: "2_1_matrix" })}
            className={cn(
              "text-left p-4 rounded-xl border transition-all duration-150 active:scale-[0.98]",
              state.pointsRule === "2_1_matrix"
                ? "bg-emerald-950/20 border-emerald-500/60 ring-1 ring-emerald-500/40"
                : "bg-neutral-900/60 border-white/10 hover:border-white/20"
            )}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-neutral-100 font-mono">
                Matrix setowy FSS (2:0 / 2:1)
              </span>
              {state.pointsRule === "2_1_matrix" && (
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
              )}
            </div>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Wygrana <strong className="text-neutral-200">2:0</strong> daje <strong className="text-emerald-400">2-0 pkt</strong>. Wygrana <strong className="text-neutral-200">2:1</strong> daje <strong className="text-emerald-400">2-1 pkt</strong> (przegrany zyskuje 1 pkt).
            </p>
          </button>

          {/* Standard 3-1-0 */}
          <button
            type="button"
            onClick={() => onChange({ pointsRule: "standard_3_1_0" })}
            className={cn(
              "text-left p-4 rounded-xl border transition-all duration-150 active:scale-[0.98]",
              state.pointsRule === "standard_3_1_0"
                ? "bg-emerald-950/20 border-emerald-500/60 ring-1 ring-emerald-500/40"
                : "bg-neutral-900/60 border-white/10 hover:border-white/20"
            )}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-neutral-100 font-mono">
                Standard ligowy (3 / 1 / 0)
              </span>
              {state.pointsRule === "standard_3_1_0" && (
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
              )}
            </div>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Zwycięstwo daje <strong className="text-emerald-400">3 pkt</strong>, remis daje <strong className="text-amber-400">1 pkt</strong>, porażka <strong className="text-neutral-300">0 pkt</strong>.
            </p>
          </button>
        </div>
      </div>

      {/* Master Player Score Submission Toggle */}
      <div className="p-4 rounded-xl bg-neutral-900/60 border border-white/10 space-y-2">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-2.5">
            <div className="p-2 rounded-lg bg-neutral-800 text-neutral-200 border border-white/10 shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h5 className="text-xs font-semibold text-neutral-200 leading-snug">
                Wprowadzanie wyników przez zawodników
              </h5>
              <p className="text-xs text-neutral-400 pt-0.5">
                Zezwalaj graczom na wprowadzanie i zatwierdzanie wyników bezpośrednio z prywatnych linków (<code className="font-mono text-[11px] text-emerald-400/90">/[slug]/p/[playerSecret]</code>)
              </p>
            </div>
          </div>
          <Switch
            checked={state.allowPlayerScoreSubmission}
            onCheckedChange={(checked) => onChange({ allowPlayerScoreSubmission: checked })}
          />
        </div>
      </div>
    </div>
  );
};
