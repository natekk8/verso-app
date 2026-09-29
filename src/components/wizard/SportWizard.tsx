import React, { useState, useCallback, useEffect } from "react";
import type { SportPreset } from "../../engine/scoring";
import { PresetSelector } from "./PresetSelector";
import { TerminologyConfig } from "./TerminologyConfig";
import { RuleParameters } from "./RuleParameters";
import { LiveCardPreview } from "./LiveCardPreview";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { cn } from "../ui/utils";
import {
  DEFAULT_WIZARD_STATE,
  type WizardSportState,
} from "./types";
import {
  Check,
  RotateCcw,
  Sparkles,
  Info,
} from "lucide-react";

export interface SportWizardProps {
  initialState?: Partial<WizardSportState>;
  mode?: "create" | "edit";
  tournamentName?: string;
  onChange?: (state: WizardSportState) => void;
  onSave?: (state: WizardSportState) => Promise<void> | void;
  isLoading?: boolean;
  className?: string;
}

export const SportWizard: React.FC<SportWizardProps> = ({
  initialState,
  mode = "create",
  tournamentName,
  onChange,
  onSave,
  isLoading = false,
  className,
}) => {
  const [state, setState] = useState<WizardSportState>(() => ({
    ...DEFAULT_WIZARD_STATE,
    ...initialState,
  }));

  const [savedSuccess, setSavedSuccess] = useState(false);

  // Sync state if initialState changes externally
  useEffect(() => {
    if (initialState) {
      setState((prev) => ({
        ...prev,
        ...initialState,
      }));
    }
  }, [initialState]);

  const updateState = useCallback(
    (patch: Partial<WizardSportState>) => {
      setState((prev) => {
        const next = { ...prev, ...patch };
        onChange?.(next);
        return next;
      });
      setSavedSuccess(false);
    },
    [onChange]
  );

  const handlePresetSelect = (
    preset: SportPreset,
    defaults: Partial<WizardSportState>
  ) => {
    updateState({
      preset,
      ...defaults,
    });
  };

  const handleResetDefaults = () => {
    updateState(DEFAULT_WIZARD_STATE);
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (onSave) {
      await onSave(state);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    }
  };

  return (
    <div className={cn("w-full max-w-7xl mx-auto space-y-8", className)}>
      {/* Wizard Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Badge variant="cyan" size="sm">
              {mode === "create" ? "Nowy Turniej" : "Edycja Reguł"}
            </Badge>
            {tournamentName && (
              <span className="text-xs font-mono text-neutral-400">
                • {tournamentName}
              </span>
            )}
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">
            Kreator Dyscypliny & Punktacji
          </h2>
          <p className="text-xs md:text-sm text-neutral-400 leading-relaxed mt-1">
            Skonfiguruj terminologię jednostek gry, warunki wygranej partii, tiebreaki oraz uprawnienia zawodników
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleResetDefaults}
            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
          >
            Domyślne FSS
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            isLoading={isLoading}
            onClick={() => handleSave()}
            leftIcon={savedSuccess ? <Check className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
          >
            {savedSuccess ? "Zapisano!" : mode === "create" ? "Zatwierdź & Kontynuuj" : "Zapisz Zmiany"}
          </Button>
        </div>
      </div>

      {/* Main Grid: Left Form Controls, Right Sticky Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Configuration Sections */}
        <div className="lg:col-span-7 space-y-8">
          {/* Step 01: Preset Selection */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-mono text-emerald-400">
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 font-bold">
                01
              </span>
              <span className="uppercase tracking-wider">Szablon Bazowy</span>
            </div>
            <PresetSelector
              selectedPreset={state.preset}
              onSelect={handlePresetSelect}
            />
          </section>

          {/* Step 02: Terminology Configuration */}
          <section className="space-y-3 pt-4 border-t border-white/5">
            <div className="flex items-center gap-2 text-xs font-mono text-emerald-400">
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 font-bold">
                02
              </span>
              <span className="uppercase tracking-wider">Nomenklatura Jednostek</span>
            </div>
            <TerminologyConfig
              singularUnit={state.singularUnit}
              pluralUnit={state.pluralUnit}
              onChange={(units) => updateState(units)}
            />
          </section>

          {/* Step 03: Rule Parameters & Scoring Conditions */}
          <section className="space-y-3 pt-4 border-t border-white/5">
            <div className="flex items-center gap-2 text-xs font-mono text-emerald-400">
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 font-bold">
                03
              </span>
              <span className="uppercase tracking-wider">Parametry Punktacji</span>
            </div>
            <RuleParameters
              state={state}
              onChange={updateState}
            />
          </section>

          {/* Bottom Action Bar */}
          <div className="pt-6 border-t border-white/10 flex items-center justify-between">
            <span className="text-xs text-neutral-400 font-mono">
              Wszystkie zmiany synchronizują się automatycznie z podglądem na żywo.
            </span>
            <Button
              type="button"
              variant="primary"
              size="md"
              isLoading={isLoading}
              onClick={() => handleSave()}
            >
              {mode === "create" ? "Utwórz Konfigurację" : "Zapisz Reguły"}
            </Button>
          </div>
        </div>

        {/* Right Column: Sticky Live Preview & Summary Card */}
        <div className="lg:col-span-5 lg:sticky lg:top-8 space-y-6">
          <LiveCardPreview state={state} />

          {/* Summary Details Card */}
          <Card className="bg-neutral-900/40 border-white/5">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-mono text-neutral-300">
                <Info className="w-3.5 h-3.5 text-neutral-400" />
                <span className="font-semibold uppercase tracking-wide">
                  Podsumowanie Zasad ({state.preset.toUpperCase()})
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="p-2 rounded-lg bg-neutral-950/60 border border-white/5">
                  <span className="text-neutral-400 block text-[10px]">Jednostki:</span>
                  <span className="text-neutral-200 font-semibold">
                    {state.singularUnit} / {state.pluralUnit}
                  </span>
                </div>

                <div className="p-2 rounded-lg bg-neutral-950/60 border border-white/5">
                  <span className="text-neutral-400 block text-[10px]">Punkty w partii:</span>
                  <span className="text-emerald-400 font-semibold">
                    Do {state.targetPointsPerUnit} pkt
                  </span>
                </div>

                <div className="p-2 rounded-lg bg-neutral-950/60 border border-white/5">
                  <span className="text-neutral-400 block text-[10px]">Format meczu:</span>
                  <span className="text-neutral-200 font-semibold">
                    Wygrana {state.unitsToWinMatch} {state.pluralUnit} (Bo{state.unitsToWinMatch * 2 - 1})
                  </span>
                </div>

                <div className="p-2 rounded-lg bg-neutral-950/60 border border-white/5">
                  <span className="text-neutral-400 block text-[10px]">Decydująca partia:</span>
                  <span className={state.hasDeciderTiebreak ? "text-amber-400 font-semibold" : "text-neutral-400"}>
                    {state.hasDeciderTiebreak ? `Do ${state.deciderPoints} pkt` : "Brak"}
                  </span>
                </div>

                <div className="p-2 rounded-lg bg-neutral-950/60 border border-white/5">
                  <span className="text-neutral-400 block text-[10px]">Przewaga (win-by-2):</span>
                  <span className={state.winByTwo ? "text-emerald-400 font-semibold" : "text-neutral-400"}>
                    {state.winByTwo ? "Wymagana (2 pkt)" : "Niewymagana"}
                  </span>
                </div>

                <div className="p-2 rounded-lg bg-neutral-950/60 border border-white/5">
                  <span className="text-neutral-400 block text-[10px]">Wprowadzanie graczy:</span>
                  <span className={state.allowPlayerScoreSubmission ? "text-emerald-400 font-semibold" : "text-amber-400 font-semibold"}>
                    {state.allowPlayerScoreSubmission ? "Dozwolone" : "Zablokowane"}
                  </span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
