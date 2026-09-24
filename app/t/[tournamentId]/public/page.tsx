"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { use } from "react";
import { Trophy, CalendarBlank, ChartBar } from "@phosphor-icons/react";
import { PublicHeader } from "@/components/layout/public-header";

export default function PublicTournamentPage({
  params,
}: {
  params: Promise<{ tournamentId: string }>;
}) {
  const { tournamentId } = use(params);

  const t = useQuery(api.tournaments.getPublic, { id: tournamentId as Id<"tournaments"> });
  const players = useQuery(api.players.getByTournament, { tournamentId: tournamentId as Id<"tournaments"> });
  const matches = useQuery(api.matches.getByTournament, { tournamentId: tournamentId as Id<"tournaments"> });
  const phases = useQuery(api.phases.getByTournament, { tournamentId: tournamentId as Id<"tournaments"> });

  if (t === undefined || players === undefined || matches === undefined) {
    return <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-500">Wczytywanie...</div>;
  }
  if (t === null) {
    return <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-500">Turniej nie istnieje lub jest prywatny.</div>;
  }

  // Calculate Standings
  const calculateStandings = () => {
    const standings: Record<string, { points: number; played: number; scored: number; conceded: number }> = {};
    players.forEach(p => {
      standings[p._id] = { points: 0, played: 0, scored: 0, conceded: 0 };
    });

    matches.forEach(m => {
      if (m.status !== "finished" || !m.player1Id || !m.player2Id) return;
      
      const p1 = standings[m.player1Id];
      const p2 = standings[m.player2Id];
      if (!p1 || !p2) return;

      p1.played += 1;
      p2.played += 1;
      p1.scored += (m.player1Score || 0);
      p1.conceded += (m.player2Score || 0);
      p2.scored += (m.player2Score || 0);
      p2.conceded += (m.player1Score || 0);

      if (m.player1Score! > m.player2Score!) { p1.points += 3; }
      else if (m.player2Score! > m.player1Score!) { p2.points += 3; }
      else { p1.points += 1; p2.points += 1; }
    });

    return Object.entries(standings)
      .map(([id, stats]) => ({ id, name: players.find(p => p._id === id)?.name || "?", ...stats }))
      .sort((a, b) => b.points - a.points || (b.scored - b.conceded) - (a.scored - a.conceded));
  };

  const standings = calculateStandings();

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader tournamentName={t.name} tournamentId={tournamentId} />
      
      {/* Hero */}
      <div className="border-b border-border/50 bg-card py-12 px-6">
        <div className="max-w-4xl mx-auto flex items-center gap-6">
          <div className="w-20 h-20 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500 shadow-[0_0_30px_rgba(59,130,246,0.15)]">
            <Trophy className="w-10 h-10" weight="duotone" />
          </div>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="text-emerald-500 text-xs font-bold uppercase tracking-widest">LIVE</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-foreground">{t.name}</h1>
            {t.sport && <p className="text-muted-foreground mt-2 font-medium">{t.sport}</p>}
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-6 py-12 grid md:grid-cols-2 gap-12">
        
        {/* Tabela wyników */}
        <div className="space-y-6">
          <h2 className="text-xl font-semibold flex items-center gap-2 border-b border-border/50 pb-4">
            <ChartBar className="text-blue-500 w-6 h-6" /> Tabela
          </h2>
          <div className="bg-card border border-border/50 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-zinc-900/50 border-b border-border/50 text-muted-foreground">
                <tr>
                  <th className="py-3 px-4 text-left font-medium">#</th>
                  <th className="py-3 px-4 text-left font-medium">Uczestnik</th>
                  <th className="py-3 px-4 text-center font-medium">M</th>
                  <th className="py-3 px-4 text-center font-medium">PKT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {standings.map((row, idx) => (
                  <tr key={row.id} className="hover:bg-zinc-900/30 transition-colors">
                    <td className="py-3 px-4 text-zinc-500 font-mono">{idx + 1}</td>
                    <td className="py-3 px-4 font-medium text-zinc-200">{row.name}</td>
                    <td className="py-3 px-4 text-center text-zinc-500">{row.played}</td>
                    <td className="py-3 px-4 text-center font-bold text-blue-400">{row.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Ostatnie mecze */}
        <div className="space-y-6">
          <h2 className="text-xl font-semibold flex items-center gap-2 border-b border-border/50 pb-4">
            <CalendarBlank className="text-blue-500 w-6 h-6" /> Mecze
          </h2>
          <div className="space-y-3">
            {matches.length === 0 && <p className="text-muted-foreground text-sm">Brak meczów.</p>}
            {matches.slice().reverse().map(m => {
              const p1 = players.find(p => p._id === m.player1Id)?.name || "?";
              const p2 = players.find(p => p._id === m.player2Id)?.name || "?";
              return (
                <div key={m._id} className="bg-card border border-border/50 rounded-xl p-4 flex items-center justify-between shadow-sm">
                  <div className={`font-medium flex-1 text-right truncate ${m.status === "finished" && m.player1Score! > m.player2Score! ? "text-emerald-400" : "text-zinc-300"}`}>{p1}</div>
                  <div className="px-4 font-mono font-bold tracking-widest text-zinc-100 bg-zinc-950 py-1.5 rounded-lg mx-3 border border-zinc-800">
                    {m.status === "finished" ? `${m.player1Score} : ${m.player2Score}` : "VS"}
                  </div>
                  <div className={`font-medium flex-1 text-left truncate ${m.status === "finished" && m.player2Score! > m.player1Score! ? "text-emerald-400" : "text-zinc-300"}`}>{p2}</div>
                </div>
              );
            })}
          </div>
        </div>

      </main>
    </div>
  );
}

export const runtime = 'edge';
