"use client";

import Link from "next/link";

interface PublicHeaderProps {
  tournamentName: string;
  tournamentId: string;
}

export function PublicHeader({ tournamentName, tournamentId }: PublicHeaderProps) {
  return (
    <header className="h-14 sticky top-0 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800/50 z-30 px-4 md:px-6 flex items-center justify-between">
      <Link href={`/t/${tournamentId}/public`} className="flex items-center gap-4 group">
        <span className="font-black text-xl tracking-tighter text-zinc-100 uppercase group-hover:text-blue-500 transition-colors">
          VERSO
        </span>
        <div className="w-px h-5 bg-zinc-800" />
        <span className="font-medium text-sm text-zinc-400 line-clamp-1 group-hover:text-zinc-300 transition-colors">
          {tournamentName}
        </span>
      </Link>
    </header>
  );
}
