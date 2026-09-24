"use client";

import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";

interface PublicHeaderProps {
  tournamentName: string;
  tournamentId: string;
}

export function PublicHeader({ tournamentName, tournamentId }: PublicHeaderProps) {
  return (
    <header className="h-14 sticky top-0 bg-background/90 backdrop-blur-md border-b border-border/50 z-30 px-4 md:px-6 flex items-center justify-between">
      <Link href={`/t/${tournamentId}/public`} className="flex items-center gap-3 group">
        <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(59,130,246,0.3)] group-hover:scale-105 transition-transform">
          <span className="text-white font-bold text-xs tracking-tighter">V</span>
        </div>
        <span className="font-semibold text-sm tracking-tight text-foreground line-clamp-1">
          {tournamentName}
        </span>
      </Link>
      
      <div className="flex items-center gap-4">
        <ThemeToggle />
      </div>
    </header>
  );
}
