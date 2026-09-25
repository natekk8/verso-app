"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { use } from "react";
import { motion, AnimatePresence } from "motion/react";
import { PublicHeader } from "@/components/layout/public-header";
import { calculateStandings } from "@/lib/tournament-logic";
import {
  Trophy,
  CalendarBlank,
  Users,
  SoccerBall,
  Clock,
  MapPin,
  ListNumbers
} from "@phosphor-icons/react";

export default function PublicTournamentPage({
  params,
}: {
  params: Promise<{ tournamentId: string }>;
}) {
  const { tournamentId } = use(params);

  const t = useQuery(api.tournaments.getPublic, {
    id: tournamentId as Id<"tournaments">,
  });
  
  const players = useQuery(api.players.getByTournament, {
    tournamentId: tournamentId as Id<"tournaments">,
  });
  
  const matches = useQuery(api.matches.getByTournament, {
    tournamentId: tournamentId as Id<"tournaments">,
  });
  
  const phases = useQuery(api.phases.getByTournament, {
    tournamentId: tournamentId as Id<"tournaments">,
  });

  if (t === undefined || players === undefined || matches === undefined || phases === undefined) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-zinc-800 border-t-blue-500 animate-spin" />
      </div>
    );
  }

  if (t === null) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
        <div className="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center mb-6">
          <SoccerBall className="w-8 h-8 text-zinc-700" />
        </div>
        <h1 className="text-2xl font-semibold mb-2">Nie znaleziono turnieju</h1>
        <p className="text-zinc-500 text-center max-w-sm">
          Ten turniej nie istnieje lub jego strona publiczna została wyłączona przez organizatora.
        </p>
      </div>
    );
  }

  const finishedMatches = matches
    .filter(m => m.status === "finished")
    .sort((a, b) => (b._creationTime || 0) - (a._creationTime || 0))
    .slice(0, 5);
    
  const upcomingMatches = matches
    .filter(m => m.status === "pending" || m.status === "in_progress")
    .slice(0, 5);

  const statusMap = {
    draft: { label: "Planowany", color: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20" },
    active: { label: "Trwa", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
    finished: { label: "Zakończony", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" }
  };
  const statusInfo = statusMap[t.status];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 selection:bg-blue-500/30">
      <PublicHeader tournamentName={t.name} tournamentId={tournamentId} />
      
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-16"
        >
          <div className="flex items-center gap-3 mb-4">
            <span className={`px-3 py-1 text-[11px] font-bold uppercase tracking-wider rounded-full border ${statusInfo.color}`}>
              {statusInfo.label}
            </span>
            {t.sport && (
              <span className="text-sm font-medium text-zinc-400 flex items-center gap-1.5">
                <SoccerBall weight="fill" className="text-zinc-500" />
                {t.sport}
              </span>
            )}
          </div>
          
          <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-4 leading-tight">
            {t.name}
          </h1>
          
          {t.description && (
            <p className="text-lg text-zinc-400 max-w-2xl mb-8 leading-relaxed">
              {t.description}
            </p>
          )}
          
          <div className="flex flex-wrap items-center gap-6 text-sm font-medium text-zinc-400 bg-zinc-900/50 border border-zinc-800/50 p-4 rounded-2xl w-fit">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-400" />
              {players.length} uczestników
            </div>
            <div className="w-1 h-1 rounded-full bg-zinc-700" />
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-400" />
              {phases.length} etapy
            </div>
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main content - Standings */}
          <div className="lg:col-span-2 space-y-12">
            {phases.map(phase => (
              <div key={phase._id} className="space-y-6">
                <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2 pb-2 border-b border-zinc-800">
                  <ListNumbers className="w-6 h-6 text-blue-500" />
                  {phase.name}
                </h2>
                
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs uppercase bg-zinc-950/50 text-zinc-400">
                        <tr>
                          <th className="px-4 py-3 w-12 text-center">#</th>
                          <th className="px-4 py-3">Uczestnik</th>
                          <th className="px-3 py-3 text-center" title="Mecze">M</th>
                          <th className="px-3 py-3 text-center text-emerald-400" title="Wygrane">W</th>
                          <th className="px-3 py-3 text-center text-amber-400" title="Remisy">R</th>
                          <th className="px-3 py-3 text-center text-rose-400" title="Przegrane">P</th>
                          <th className="px-3 py-3 text-center" title="Bramki/Punkty">+/-</th>
                          <th className="px-4 py-3 text-center text-blue-400 font-bold" title="Punkty w tabeli">PKT</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/50">
                        {calculateStandings(
                          players.map(p => p._id), 
                          matches.filter(m => m.phaseId === phase._id), 
                          players as any,
                          t.scoring.winPoints,
                          t.scoring.drawPoints,
                          t.scoring.lossPoints
                        ).map((row, i) => (
                          <tr key={row.playerId} className="hover:bg-zinc-800/30 transition-colors">
                            <td className="px-4 py-3 text-center font-mono text-zinc-500">{i + 1}</td>
                            <td className="px-4 py-3 font-medium text-zinc-200">
                              <div className="flex items-center gap-2">
                                <img 
                                  src={`https://api.dicebear.com/9.x/micah/svg?seed=${encodeURIComponent(row.playerName)}&backgroundColor=27272a`} 
                                  alt="" 
                                  className="w-6 h-6 rounded-full" 
                                />
                                {row.playerName}
                              </div>
                            </td>
                            <td className="px-3 py-3 text-center text-zinc-400 font-mono">{row.played}</td>
                            <td className="px-3 py-3 text-center text-emerald-400/80 font-mono">{row.won}</td>
                            <td className="px-3 py-3 text-center text-amber-400/80 font-mono">{row.drawn}</td>
                            <td className="px-3 py-3 text-center text-rose-400/80 font-mono">{row.lost}</td>
                            <td className="px-3 py-3 text-center text-zinc-500 font-mono text-xs">
                              {row.goalsFor}:{row.goalsAgainst}
                            </td>
                            <td className="px-4 py-3 text-center font-bold text-blue-400 text-base">{row.points}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Sidebar - Recent & Upcoming */}
          <div className="space-y-8">
            
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-xl">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-emerald-500" />
                Ostatnie wyniki
              </h3>
              
              <div className="space-y-2">
                {finishedMatches.length === 0 ? (
                  <p className="text-sm text-zinc-500 text-center py-4">Brak zakończonych meczów</p>
                ) : (
                  finishedMatches.map(m => {
                    const p1 = players.find(p => p._id === m.player1Id)?.name ?? "BYE";
                    const p2 = players.find(p => p._id === m.player2Id)?.name ?? "BYE";
                    return (
                      <div key={m._id} className="bg-zinc-950 border border-zinc-800/80 rounded-xl p-3 flex items-center justify-between">
                        <div className="flex-1 text-right text-sm font-medium text-zinc-300 truncate pr-2">{p1}</div>
                        <div className="shrink-0 font-bold font-mono px-3 py-1 bg-zinc-900 rounded-lg text-blue-400 border border-zinc-800">
                          {m.player1Score} - {m.player2Score}
                        </div>
                        <div className="flex-1 text-left text-sm font-medium text-zinc-300 truncate pl-2">{p2}</div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-xl">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <CalendarBlank className="w-5 h-5 text-blue-500" />
                Nadchodzące
              </h3>
              
              <div className="space-y-2">
                {upcomingMatches.length === 0 ? (
                  <p className="text-sm text-zinc-500 text-center py-4">Brak zaplanowanych meczów</p>
                ) : (
                  upcomingMatches.map(m => {
                    const p1 = players.find(p => p._id === m.player1Id)?.name ?? "BYE";
                    const p2 = players.find(p => p._id === m.player2Id)?.name ?? "BYE";
                    return (
                      <div key={m._id} className="bg-zinc-950 border border-zinc-800/80 rounded-xl p-3 text-sm">
                        <div className="flex items-center justify-between mb-1.5 text-xs text-zinc-500">
                          <span>{m.matchLabel || `Mecz ${m.matchNumber}`}</span>
                          {m.scheduledTime && <span className="text-blue-400/80">{m.scheduledTime}</span>}
                        </div>
                        <div className="flex items-center justify-between font-medium">
                          <span className="truncate">{p1}</span>
                          <span className="text-zinc-600 mx-2 text-xs font-mono">VS</span>
                          <span className="truncate">{p2}</span>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}

export const runtime = "edge";
