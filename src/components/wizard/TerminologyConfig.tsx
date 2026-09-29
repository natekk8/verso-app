import React from "react";
import { Input } from "../ui/Input";
import { Sparkles } from "lucide-react";
import { cn } from "../ui/utils";

export interface TerminologyChip {
  singular: string;
  plural: string;
  label: string;
  sportExample: string;
}

export const TERMINOLOGY_CHIPS: TerminologyChip[] = [
  { singular: "Set", plural: "Sety", label: "Set / Sety", sportExample: "Tenis stołowy, Siatkówka" },
  { singular: "Gem", plural: "Gemy", label: "Gem / Gemy", sportExample: "Padel, Tenis ziemny" },
  { singular: "Głowa", plural: "Głowy", label: "Głowa / Głowy", sportExample: "Headis, Teqball" },
  { singular: "Połowa", plural: "Połowy", label: "Połowa / Połowy", sportExample: "Piłka nożna, Futsal" },
  { singular: "Mapa", plural: "Mapy", label: "Mapa / Mapy", sportExample: "E-sport: CS2, Valorant" },
  { singular: "Runda", plural: "Rundy", label: "Runda / Rundy", sportExample: "Boks, Sztuki walki" },
];

export interface TerminologyConfigProps {
  singularUnit: string;
  pluralUnit: string;
  onChange: (units: { singularUnit: string; pluralUnit: string }) => void;
  className?: string;
}

export const TerminologyConfig: React.FC<TerminologyConfigProps> = ({
  singularUnit,
  pluralUnit,
  onChange,
  className,
}) => {
  const handleChipClick = (chip: TerminologyChip) => {
    onChange({
      singularUnit: chip.singular,
      pluralUnit: chip.plural,
    });
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-neutral-100 tracking-wide uppercase font-mono">
            Nomenklatura & Jednostki Gry
          </h4>
          <p className="text-xs text-neutral-400">
            Dostosuj nazwy jednostek meczowych — wszystkie pytania i karty meczowe dostosują się automatycznie
          </p>
        </div>
      </div>

      {/* Quick-fill chips */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-xs text-neutral-400 font-mono">
          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          <span>Szybkie szablony terminologii:</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {TERMINOLOGY_CHIPS.map((chip) => {
            const isActive =
              singularUnit.trim().toLowerCase() === chip.singular.toLowerCase() &&
              pluralUnit.trim().toLowerCase() === chip.plural.toLowerCase();

            return (
              <button
                key={chip.label}
                type="button"
                onClick={() => handleChipClick(chip)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-150 select-none active:scale-[0.97]",
                  isActive
                    ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300 ring-1 ring-emerald-500/30"
                    : "bg-white/[0.03] border-white/10 text-neutral-300 hover:text-white hover:bg-white/[0.07]"
                )}
                title={chip.sportExample}
              >
                <span>{chip.label}</span>
                <span className="ml-1.5 text-[10px] text-neutral-400 font-normal">
                  ({chip.sportExample.split(",")[0]})
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Liczba pojedyncza (Singular Unit)"
          value={singularUnit}
          onChange={(e) =>
            onChange({
              singularUnit: e.target.value,
              pluralUnit,
            })
          }
          placeholder="np. Set, Głowa, Gem, Połowa"
          helperText="Używana w pytaniach o pojedynczą partię (np. 'Do ilu punktów gra się Set?')"
        />

        <Input
          label="Liczba mnoga (Plural Unit)"
          value={pluralUnit}
          onChange={(e) =>
            onChange({
              singularUnit,
              pluralUnit: e.target.value,
            })
          }
          placeholder="np. Sety, Głowy, Gemy, Połowy"
          helperText="Używana w pytaniach o sumę partii (np. 'Do ilu Sety gra się, żeby wygrać mecz?')"
        />
      </div>
    </div>
  );
};
