import React from "react";
import {
  DEFAULT_SPORT_PRESETS,
  type SportPreset,
} from "../../engine/scoring";
import { Badge } from "../ui/Badge";
import { cn } from "../ui/utils";
import {
  CircleDot,
  Trophy,
  Dices,
  Gamepad2,
  Sliders,
  Check,
} from "lucide-react";
import type { WizardSportState } from "./types";

export interface PresetOption {
  id: SportPreset;
  title: string;
  badge: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  defaults: Partial<WizardSportState>;
}

export const PRESET_OPTIONS: PresetOption[] = [
  {
    id: "table_tennis",
    title: "Tenis stołowy",
    badge: "11 pkt • Bo3 • Tiebreak 15",
    description: "Klasyczny format setowy FSS z decydującym setem do 15 pkt przy stanie 1:1 i zasadą win-by-2.",
    icon: CircleDot,
    defaults: {
      ...DEFAULT_SPORT_PRESETS.table_tennis,
      pointsRule: "2_1_matrix",
    },
  },
  {
    id: "padel",
    title: "Padel",
    badge: "6 gemów • Bo3",
    description: "Standardowy format gemowy z wygraną do 2 gemów/setów i wymogiem 2 gemów przewagi.",
    icon: Trophy,
    defaults: {
      ...DEFAULT_SPORT_PRESETS.padel,
      pointsRule: "standard_3_1_0",
    },
  },
  {
    id: "football",
    title: "Piłka nożna",
    badge: "1 połowa • Standard 3-1-0",
    description: "Prosty format bramkowy z klasyczną ligową punktacją za wygraną (3 pkt) i remis (1 pkt).",
    icon: Dices,
    defaults: {
      ...DEFAULT_SPORT_PRESETS.football,
      pointsRule: "standard_3_1_0",
    },
  },
  {
    id: "esport",
    title: "E-sport",
    badge: "13 rund • Bo3 MR12",
    description: "Format Counter-Strike / Valorant: gra do 13 wygranych rund na mapie i 2 wygranych map w meczu.",
    icon: Gamepad2,
    defaults: {
      ...DEFAULT_SPORT_PRESETS.esport,
      pointsRule: "2_1_matrix",
    },
  },
  {
    id: "custom",
    title: "Własny sport",
    badge: "Pełna personalizacja",
    description: "Zdefiniuj dowolne jednostki gry (Głowa, Runda, Leg), punktację, tiebreak oraz zasady punktacji ligowej.",
    icon: Sliders,
    defaults: {
      ...DEFAULT_SPORT_PRESETS.custom,
      pointsRule: "2_1_matrix",
    },
  },
];

export interface PresetSelectorProps {
  selectedPreset: SportPreset;
  onSelect: (preset: SportPreset, defaults: Partial<WizardSportState>) => void;
  className?: string;
}

export const PresetSelector: React.FC<PresetSelectorProps> = ({
  selectedPreset,
  onSelect,
  className,
}) => {
  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-neutral-100 tracking-wide uppercase font-mono">
            Wybierz szablon sportu
          </h4>
          <p className="text-xs text-neutral-400">
            Wybierz gotowy zestaw reguł lub stwórz w pełni własny system rozgrywek
          </p>
        </div>
        <Badge variant="cyan" size="sm">
          5 Szablonów
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {PRESET_OPTIONS.map((preset) => {
          const isSelected = selectedPreset === preset.id;
          const Icon = preset.icon;

          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onSelect(preset.id, preset.defaults)}
              className={cn(
                "relative group text-left p-4 rounded-xl border transition-all duration-150 select-none active:scale-[0.98]",
                isSelected
                  ? "bg-emerald-950/20 border-emerald-500/60 ring-1 ring-emerald-500/40 shadow-[0_0_24px_-4px_rgba(16,185,129,0.2)]"
                  : "bg-neutral-900/60 border-white/10 hover:border-white/20 hover:bg-neutral-900/90"
              )}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div
                  className={cn(
                    "p-2 rounded-lg border transition-colors",
                    isSelected
                      ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                      : "bg-white/[0.03] border-white/10 text-neutral-400 group-hover:text-white"
                  )}
                >
                  <Icon className="w-5 h-5" />
                </div>
                {isSelected ? (
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500 text-neutral-950">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </span>
                ) : null}
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <h5 className="font-semibold text-sm text-neutral-100 group-hover:text-white">
                    {preset.title}
                  </h5>
                </div>
                <p className="text-[11px] font-mono text-emerald-400/90 font-medium">
                  {preset.badge}
                </p>
                <p className="text-xs text-neutral-400 line-clamp-2 leading-relaxed pt-1">
                  {preset.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
