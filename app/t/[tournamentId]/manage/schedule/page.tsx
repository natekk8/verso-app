"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { use } from "react";
import { CalendarBlank } from "@phosphor-icons/react";

export default function SchedulePlaceholderPage({
  params,
}: {
  params: Promise<{ tournamentId: string }>;
}) {
  const { tournamentId } = use(params);
  
  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center">
      <CalendarBlank className="w-16 h-16 text-zinc-800 mb-4" />
      <h1 className="text-2xl font-semibold tracking-tight text-foreground mb-2">Szczegółowy Harmonogram</h1>
      <p className="text-muted-foreground max-w-md">
        Ta zakładka będzie pozwalała na ręczne zarządzanie czasami i boiskami poszczególnych meczy. Na ten moment mecze są rozgrywane bez przypisanej konkretnej godziny – przejdź do zakładki "Wyniki", aby je obsłużyć.
      </p>
    </div>
  );
}
