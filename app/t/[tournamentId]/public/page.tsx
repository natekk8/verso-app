"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { use } from "react";
import { motion } from "motion/react";
import { PublicHeader } from "@/components/layout/public-header";
import { calculateStandings } from "@/lib/tournament-logic";
import {
  Trophy,
  CalendarBlank,
  Users,
  SoccerBall,
  Clock,
  ListNumbers,
  CircleNotch,
  WarningCircle,
  PlayCircle,
  CheckCircle
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
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center">
        <CircleNotch weight="bold" className="w-8 h-8 text-blue-500 animate-spin mb-4" />
        <p className="text-zinc-500 text-sm font-medium animate-pulse">Ładowanie turnieju...</p>
      </div>
    );
  }

  if (t === null) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-20 h-20 bg-zinc-900/50 border border-zinc-800 rounded-3xl flex items-center justify-center mb-6 shadow-2xl"
        >
          <WarningCircle weight="duotone" className="w-10 h-10 text-zinc-500" />
        </motion.div>
        <motion.h1 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-3xl font-bold mb-3 text-zinc-100"
        >
          Nie znaleziono turnieju
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-zinc-400 text-center max-w-sm"
        >
          Ten turniej nie istnieje lub jego strona publiczna została wyłączona przez organizatora.
        </motion.p>
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
    draft: { label: "Planowany", color: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20", icon: CalendarBlank },
    active: { label: "Trwa", color: "bg-blue-500/10 text-blue-400 border-blue-500/20", icon: PlayCircle },
    finished: { label: "Zakończony", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", icon: CheckCircle }
  };
  
  // Safe fallback in case status is undefined
  const statusInfo = statusMap[t.status as keyof typeof statusMap] || statusMap.draft;
  const StatusIcon = statusInfo.icon;

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants: any = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 selection:bg-blue-500/30 font-sans pb-24">
      <PublicHeader tournamentName={t.name} tournamentId={tournamentId} />
      
      {/* Subtle Background Glow */}
      <div className="fixed top-0 left-0 right-0 h-[500px] bg-gradient-to-b from-blue-900/10 to-transparent pointer-events-none -z-10" />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="mb-16 md:mb-24"
        >
          <motion.div variants={itemVariants} className="flex flex-wrap items-center gap-3 mb-6">
            <div className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-widest rounded-full border flex items-center gap-1.5 ${statusInfo.color}`}>
              <StatusIcon weight="bold" className="w-4 h-4" />
              {statusInfo.label}
            </div>
            {t.sport && (
              <span className="text-sm font-medium text-zinc-400 flex items-center gap-1.5 bg-zinc-900/50 px-3 py-1.5 rounded-full border border-zinc-800">
                <SoccerBall weight="fill" className="text-zinc-500" />
                {t.sport}
              </span>
            )}
          </motion.div>
          
          <motion.h1 variants={itemVariants} className="text-5xl md:text-7xl font-black tracking-tighter mb-6 leading-[1.1] text-transparent bg-clip-text bg-gradient-to-br from-white to-zinc-500">
            {t.name}
          </motion.h1>
          
          {t.description && (
            <motion.p variants={itemVariants} className="text-lg md:text-xl text-zinc-400 max-w-3xl mb-10 leading-relaxed font-light">
              {t.description}
            </motion.p>
          )}
          
          <motion.div variants={itemVariants} className="flex flex-wrap items-center gap-6 text-sm font-medium text-zinc-300 bg-zinc-900/40 backdrop-blur-md border border-zinc-800/80 p-4 rounded-2xl w-fit shadow-lg shadow-black/20">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                <Users weight="duotone" className="w-4 h-4 text-blue-400" />
              </div>
              <span className="text-base">{players.length} <span className="text-zinc-500">uczestników</span></span>
            </div>
            <div className="w-px h-8 bg-zinc-800" />
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                <Trophy weight="duotone" className="w-4 h-4 text-amber-400" />
              </div>
              <span className="text-base">{phases.length} <span className="text-zinc-500">etapów</span></span>
            </div>
          </motion.div>
        </motion.div>

        <div className="grid xl:grid-cols-3 gap-10 xl:gap-12">
          {/* Main content - Standings */}
          <div className="xl:col-span-2 space-y-16">
            {phases.map((phase, pIndex) => {
              const phaseMatches = matches.filter(m => m.phaseId === phase._id);
              const standings = calculateStandings(
                players.map(p => p._id), 
                phaseMatches, 
                players as any,
                t.scoring.winPoints,
                t.scoring.drawPoints,
                t.scoring.lossPoints
              );
              
              return (
                <motion.div 
                  key={phase._id} 
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ delay: pIndex * 0.1, duration: 0.5, type: "spring", stiffness: 200, damping: 20 }}
                  className="space-y-6"
                >
                  <div className="flex items-center gap-3 pb-4 border-b border-zinc-800/80">
                    <div className="w-10 h-10 rounded-xl bg-zinc-900 flex items-center justify-center border border-zinc-800 shadow-inner">
                      <ListNumbers weight="duotone" className="w-5 h-5 text-blue-500" />
                    </div>
                    <h2 className="text-2xl font-bold tracking-tight text-zinc-100">
                      {phase.name}
                    </h2>
                  </div>
                  
                  <div className="bg-zinc-900/40 backdrop-blur-sm border border-zinc-800/80 rounded-3xl overflow-hidden shadow-2xl">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                        <thead className="text-[11px] font-bold uppercase tracking-wider bg-zinc-950/50 text-zinc-500 border-b border-zinc-800/80">
                          <tr>
                            <th className="px-5 py-4 w-12 text-center">#</th>
                            <th className="px-5 py-4">Uczestnik</th>
                            <th className="px-4 py-4 text-center" title="Rozegrane Mecze">M</th>
                            <th className="px-4 py-4 text-center text-emerald-500/70" title="Wygrane">W</th>
                            <th className="px-4 py-4 text-center text-amber-500/70" title="Remisy">R</th>
                            <th className="px-4 py-4 text-center text-rose-500/70" title="Przegrane">P</th>
                            <th className="px-4 py-4 text-center" title="Bramki/Punkty zdobyte : stracone">+/-</th>
                            <th className="px-5 py-4 text-center text-blue-400" title="Punkty w tabeli">PKT</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/50">
                          {standings.map((row, i) => (
                            <tr key={row.playerId} className="hover:bg-zinc-800/40 transition-colors group">
                              <td className="px-5 py-4 text-center font-mono text-zinc-500 group-hover:text-zinc-300 transition-colors">
                                {i + 1}
                              </td>
                              <td className="px-5 py-4 font-medium text-zinc-200">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full overflow-hidden bg-zinc-800 border border-zinc-700/50 shrink-0">
                                    <img 
                                      src={`https://api.dicebear.com/9.x/micah/svg?seed=${encodeURIComponent(row.playerName)}&backgroundColor=27272a`} 
                                      alt="" 
                                      className="w-full h-full object-cover" 
                                    />
                                  </div>
                                  <span className="truncate">{row.playerName}</span>
                                </div>
                              </td>
                              <td className="px-4 py-4 text-center text-zinc-400 font-mono">{row.played}</td>
                              <td className="px-4 py-4 text-center text-emerald-400/90 font-mono">{row.won}</td>
                              <td className="px-4 py-4 text-center text-amber-400/90 font-mono">{row.drawn}</td>
                              <td className="px-4 py-4 text-center text-rose-400/90 font-mono">{row.lost}</td>
                              <td className="px-4 py-4 text-center text-zinc-500 font-mono text-xs tracking-wider">
                                {row.goalsFor}<span className="text-zinc-700 mx-1">:</span>{row.goalsAgainst}
                              </td>
                              <td className="px-5 py-4 text-center font-black text-blue-400 text-base bg-blue-500/5 border-l border-zinc-800/50">
                                {row.points}
                              </td>
                            </tr>
                          ))}
                          
                          {standings.length === 0 && (
                            <tr>
                              <td colSpan={8} className="px-5 py-12 text-center text-zinc-500 text-sm">
                                Brak uczestników w tym etapie
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
          
          {/* Sidebar - Recent & Upcoming */}
          <div className="space-y-8">
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3, type: "spring" }}
              className="bg-zinc-900/40 backdrop-blur-sm border border-zinc-800/80 rounded-3xl p-6 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
              
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2.5 text-zinc-100">
                <Clock weight="duotone" className="w-6 h-6 text-emerald-500" />
                Ostatnie wyniki
              </h3>
              
              <div className="space-y-3 relative z-10">
                {finishedMatches.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center bg-zinc-950/50 rounded-2xl border border-dashed border-zinc-800">
                    <SoccerBall weight="duotone" className="w-8 h-8 text-zinc-700 mb-2" />
                    <p className="text-sm text-zinc-500">Brak zakończonych meczów</p>
                  </div>
                ) : (
                  finishedMatches.map((m, i) => {
                    const p1 = players.find(p => p._id === m.player1Id)?.name ?? "Wolny los";
                    const p2 = players.find(p => p._id === m.player2Id)?.name ?? "Wolny los";
                    const p1Won = (m.player1Score ?? 0) > (m.player2Score ?? 0);
                    const p2Won = (m.player2Score ?? 0) > (m.player1Score ?? 0);
                    const isDraw = (m.player1Score ?? 0) === (m.player2Score ?? 0);

                    return (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 + (i * 0.1) }}
                        key={m._id} 
                        className="bg-zinc-950/80 border border-zinc-800/80 rounded-2xl p-4 flex items-center justify-between group hover:border-zinc-700 transition-colors"
                      >
                        <div className={`flex-1 text-right text-sm truncate pr-3 ${p1Won ? 'font-bold text-zinc-100' : 'font-medium text-zinc-400'}`}>
                          {p1}
                        </div>
                        <div className={`shrink-0 font-black font-mono px-4 py-1.5 bg-zinc-900 rounded-xl border border-zinc-800 shadow-inner ${isDraw ? 'text-zinc-400' : 'text-blue-400'}`}>
                          {m.player1Score} <span className="text-zinc-600 font-sans font-normal mx-0.5">-</span> {m.player2Score}
                        </div>
                        <div className={`flex-1 text-left text-sm truncate pl-3 ${p2Won ? 'font-bold text-zinc-100' : 'font-medium text-zinc-400'}`}>
                          {p2}
                        </div>
                      </motion.div>
                    )
                  })
                )}
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4, type: "spring" }}
              className="bg-zinc-900/40 backdrop-blur-sm border border-zinc-800/80 rounded-3xl p-6 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
              
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2.5 text-zinc-100">
                <CalendarBlank weight="duotone" className="w-6 h-6 text-blue-500" />
                Nadchodzące
              </h3>
              
              <div className="space-y-3 relative z-10">
                {upcomingMatches.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center bg-zinc-950/50 rounded-2xl border border-dashed border-zinc-800">
                    <CalendarBlank weight="duotone" className="w-8 h-8 text-zinc-700 mb-2" />
                    <p className="text-sm text-zinc-500">Brak zaplanowanych meczów</p>
                  </div>
                ) : (
                  upcomingMatches.map((m, i) => {
                    const p1 = players.find(p => p._id === m.player1Id)?.name ?? "Wolny los";
                    const p2 = players.find(p => p._id === m.player2Id)?.name ?? "Wolny los";
                    return (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 + (i * 0.1) }}
                        key={m._id} 
                        className="bg-zinc-950/80 border border-zinc-800/80 rounded-2xl p-4 group hover:border-zinc-700 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-3 text-xs font-medium uppercase tracking-wider">
                          <span className="text-zinc-500 flex items-center gap-1.5">
                            <ListNumbers weight="bold" className="w-3.5 h-3.5" />
                            {m.matchLabel || `Mecz ${m.matchNumber}`}
                          </span>
                          {m.scheduledTime && (
                            <span className="text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                              {m.scheduledTime}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between font-semibold text-zinc-200">
                          <span className="truncate flex-1 text-right">{p1}</span>
                          <span className="text-zinc-600 mx-3 text-[10px] font-black uppercase tracking-widest bg-zinc-900 px-2 py-1 rounded-md border border-zinc-800">VS</span>
                          <span className="truncate flex-1 text-left">{p2}</span>
                        </div>
                      </motion.div>
                    )
                  })
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </main>
    </div>
  );
}

export const runtime = "edge";
