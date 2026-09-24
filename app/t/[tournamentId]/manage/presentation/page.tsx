"use client";

import { use } from "react";
import { MonitorPlay } from "@phosphor-icons/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function PresentationPlaceholderPage({
  params,
}: {
  params: Promise<{ tournamentId: string }>;
}) {
  const { tournamentId } = use(params);
  
  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center">
      <MonitorPlay className="w-16 h-16 text-zinc-800 mb-4" />
      <h1 className="text-2xl font-semibold tracking-tight text-foreground mb-2">Ekran Prezentacyjny</h1>
      <p className="text-muted-foreground max-w-md mb-6">
        Moduł stworzony do wyświetlania na dużych ekranach i telewizorach na żywo podczas turnieju.
      </p>
      <Link href={`/t/${tournamentId}/public`} target="_blank">
        <Button className="bg-blue-600 hover:bg-blue-700">Uruchom podgląd na żywo (Live)</Button>
      </Link>
    </div>
  );
}
