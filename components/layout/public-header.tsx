"use client";

import Link from "next/link";

interface PublicHeaderProps {
  tournamentName: string;
  tournamentId: string;
}

export function PublicHeader({ tournamentName, tournamentId }: PublicHeaderProps) {
  return (
    <header className="h-14 sticky top-0 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800/50 z-30 px-4 md:px-6 flex items-center justify-between">
      <Link href={`/t/${tournamentId}/public`} className="flex items-center gap-3 group">
        <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(37,99,235,0.3)] group-hover:scale-105 transition-transform">
          <span className="text-white font-bold text-xs tracking-tighter">V</span>
        </div>
        <span className="font-semibold text-sm tracking-tight text-zinc-100 line-clamp-1">
          {tournamentName}
        </span>
      </Link>
    </header>
  );
}
