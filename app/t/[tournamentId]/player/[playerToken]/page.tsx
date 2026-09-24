"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { use } from "react";
import { User, Trophy, CalendarCheck } from "@phosphor-icons/react";
import { PublicHeader } from "@/components/layout/public-header";

export default function PlayerDashboardPage({
  params,
}: {
  params: Promise<{ tournamentId: string; playerToken: string }>;
}) {
  const { tournamentId, playerToken } = use(params);

  const t = useQuery(api.tournaments.getPublic, { id: tournamentId as Id<"tournaments"> });
  const players = useQuery(api.players.getByTournament, { tournamentId: tournamentId as Id<"tournaments"> });
  const player = players?.find(p => p.playerToken === playerToken);
  const matches = useQuery(api.matches.getByPlayer, { tournamentId: tournamentId as Id<"tournaments">, playerId: player?._id as Id<"players"> });

  if (t === undefined || players === undefined || (player && matches === undefined)) {
    return <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-500">Wczytywanie profilu...</div>;
  }
  if (!player || !t) {
    return <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-500">Nie znaleziono gracza. Upewnij się, że link jest poprawny.</div>;
  }

  // Calculate my stats
  let wins = 0;
  let draws = 0;
  let losses = 0;
  matches?.forEach(m => {
    if (m.status !== "finished") return;
    const myScore = m.player1Id === player._id ? m.player1Score! : m.player2Score!;
    const theirScore = m.player1Id === player._id ? m.player2Score! : m.player1Score!;
    if (myScore > theirScore) wins++;
    else if (myScore < theirScore) losses++;
    else draws++;
  });

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader tournamentName={t.name} tournamentId={tournamentId} />
      
      {/* Player Hero */}
      <div className="border-b border-border/50 bg-card py-12 px-6">
        <div className="max-w-3xl mx-auto flex flex-col md:flex-row md:items-center gap-6">
          <img 
            src={`https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(player.name)}&backgroundColor=2563eb,3b82f6&textColor=ffffff&fontWeight=700&radius=20`}
            alt={player.name}
            className="w-24 h-24 rounded-2xl shadow-[0_0_20px_rgba(59,130,246,0.3)]"
          />
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">{player.name}</h1>
            <p className="text-muted-foreground mt-1 font-medium flex items-center gap-2">
              <User className="w-4 h-4" /> Twój unikalny profil
            </p>
          </div>
          
          <div className="md:ml-auto flex gap-4 mt-6 md:mt-0">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center min-w-[80px]">
              <div className="text-2xl font-bold text-emerald-400">{wins}</div>
              <div className="text-xs text-zinc-500 uppercase font-semibold tracking-wider">Wygrane</div>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center min-w-[80px]">
              <div className="text-2xl font-bold text-zinc-400">{draws}</div>
              <div className="text-xs text-zinc-500 uppercase font-semibold tracking-wider">Remisy</div>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center min-w-[80px]">
              <div className="text-2xl font-bold text-rose-400">{losses}</div>
              <div className="text-xs text-zinc-500 uppercase font-semibold tracking-wider">Porażki</div>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-6 py-12 space-y-8">
        <h2 className="text-xl font-semibold flex items-center gap-2 border-b border-border/50 pb-4">
          <CalendarCheck className="text-blue-500 w-6 h-6" /> Twoje mecze
        </h2>
        
        <div className="space-y-4">
          {matches.length === 0 && <p className="text-muted-foreground text-sm">Nie zostałeś jeszcze przydzielony do żadnego meczu.</p>}
          
          {matches.map(m => {
            const isPlayer1 = m.player1Id === player._id;
            const opponentId = isPlayer1 ? m.player2Id : m.player1Id;
            const opponentName = players.find(p => p._id === opponentId)?.name || "?";
            
            let resultColor = "text-zinc-500";
            if (m.status === "finished") {
              const myScore = isPlayer1 ? m.player1Score! : m.player2Score!;
              const theirScore = isPlayer1 ? m.player2Score! : m.player1Score!;
              if (myScore > theirScore) resultColor = "text-emerald-500 bg-emerald-500/10 border-emerald-500/20";
              else if (myScore < theirScore) resultColor = "text-rose-500 bg-rose-500/10 border-rose-500/20";
              else resultColor = "text-amber-500 bg-amber-500/10 border-amber-500/20";
            } else {
              resultColor = "text-blue-400 bg-blue-500/10 border-blue-500/20";
            }

            return (
              <div key={m._id} className="bg-card border border-border/50 rounded-2xl p-5 flex flex-col sm:flex-row justify-between items-center gap-4 hover:border-zinc-700 transition-colors shadow-sm">
                <div className="flex items-center gap-4 w-full sm:w-auto">
                  <img src={`https://api.dicebear.com/9.x/micah/svg?seed=${encodeURIComponent(opponentName)}`} className="w-10 h-10 rounded-full border border-zinc-800 bg-zinc-900" />
                  <div>
                    <div className="text-xs text-zinc-500 font-medium mb-0.5">Przeciwnik</div>
                    <div className="font-semibold text-zinc-100">{opponentName}</div>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <div className="text-xs text-zinc-500 font-medium mb-0.5">Status</div>
                    <div className="text-sm font-medium">{m.status === "finished" ? "Zakończony" : "Do rozegrania"}</div>
                  </div>
                  
                  <div className={`px-4 py-2 rounded-xl font-mono font-bold tracking-widest border ${resultColor}`}>
                    {m.status === "finished" ? (
                      isPlayer1 ? `${m.player1Score} : ${m.player2Score}` : `${m.player2Score} : ${m.player1Score}`
                    ) : (
                      "VS"
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
