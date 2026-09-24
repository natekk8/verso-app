"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { getAdminToken } from "@/lib/auth";
import { use, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Trophy, Check, WarningCircle } from "@phosphor-icons/react";

export default function ResultsPage({
  params,
}: {
  params: Promise<{ tournamentId: string }>;
}) {
  const { tournamentId } = use(params);
  const adminToken = getAdminToken(tournamentId) || "";

  const matches = useQuery(api.matches.getByTournament, { tournamentId: tournamentId as Id<"tournaments"> });
  const players = useQuery(api.players.getByTournament, { tournamentId: tournamentId as Id<"tournaments"> });
  const updateResult = useMutation(api.matches.updateResult);

  const [activeMatch, setActiveMatch] = useState<string | null>(null);
  const [score1, setScore1] = useState("");
  const [score2, setScore2] = useState("");

  const getPlayerName = (id: string | null) => {
    if (!id) return "TBD (Oczekuje)";
    const p = players?.find(p => p._id === id);
    return p ? p.name : "Nieznany";
  };

  const handleSaveResult = async (matchId: string) => {
    const s1 = parseInt(score1);
    const s2 = parseInt(score2);
    
    if (isNaN(s1) || isNaN(s2)) {
      toast.error("Wpisz poprawne wartości liczbowe");
      return;
    }

    try {
      await updateResult({
        id: matchId as Id<"matches">,
        adminToken,
        player1Score: s1,
        player2Score: s2
      });
      toast.success("Wynik zaktualizowany!");
      setActiveMatch(null);
    } catch (e) {
      toast.error("Błąd podczas zapisywania wyniku");
    }
  };

  if (matches === undefined || players === undefined) {
    return <div className="p-10 animate-pulse bg-zinc-900/20 h-64 rounded-2xl max-w-4xl mx-auto mt-10"></div>;
  }

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <h1 className="text-3xl font-semibold tracking-tight mb-2">Wyniki</h1>
        <p className="text-muted-foreground mb-8">Wpisuj wyniki spotkań. Tabele zaktualizują się automatycznie na żywo.</p>

        {matches.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-zinc-800 rounded-2xl bg-zinc-900/20">
            <Trophy className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
            <h3 className="text-lg font-medium">Brak wygenerowanych meczów</h3>
            <p className="text-sm text-zinc-500 mt-1">
              Przejdź do zakładki "Podział", skonfiguruj fazę i wygeneruj terminarz, aby móc wpisywać wyniki.
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            <AnimatePresence>
              {matches.map((match) => (
                <motion.div 
                  layout
                  key={match._id}
                  className={`border rounded-xl p-4 transition-colors ${match.status === "finished" ? "bg-zinc-900/30 border-zinc-800" : "bg-card border-zinc-700 shadow-sm"}`}
                >
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    
                    {/* Zespoły i wynik */}
                    <div className="flex-1 w-full flex items-center justify-between sm:justify-start gap-4 sm:gap-8">
                      <div className={`font-medium ${match.status === "finished" && match.player1Score! > match.player2Score! ? "text-emerald-400" : "text-zinc-200"} flex-1 text-right sm:text-left truncate`}>
                        {getPlayerName(match.player1Id)}
                      </div>
                      
                      {/* Pole wpisywania lub wyświetlanie wyniku */}
                      <div className="shrink-0 flex items-center gap-3">
                        {activeMatch === match._id ? (
                          <div className="flex items-center gap-2">
                            <Input 
                              type="number" 
                              className="w-14 text-center font-bold bg-zinc-950 border-blue-500/50 focus-visible:ring-blue-500" 
                              value={score1} 
                              onChange={e => setScore1(e.target.value)}
                              autoFocus
                            />
                            <span className="text-zinc-600 font-bold">:</span>
                            <Input 
                              type="number" 
                              className="w-14 text-center font-bold bg-zinc-950 border-blue-500/50 focus-visible:ring-blue-500" 
                              value={score2} 
                              onChange={e => setScore2(e.target.value)}
                            />
                            <Button size="icon" className="w-9 h-9 bg-blue-600 hover:bg-blue-500 ml-2" onClick={() => handleSaveResult(match._id)}>
                              <Check weight="bold" />
                            </Button>
                          </div>
                        ) : (
                          <div 
                            onClick={() => {
                              setActiveMatch(match._id);
                              setScore1(match.player1Score?.toString() || "");
                              setScore2(match.player2Score?.toString() || "");
                            }}
                            className={`px-4 py-2 rounded-lg font-bold font-mono tracking-widest cursor-pointer transition-all ${match.status === "finished" ? "bg-zinc-800 text-zinc-100 hover:bg-zinc-700" : "bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20"}`}
                          >
                            {match.status === "finished" ? `${match.player1Score} : ${match.player2Score}` : "VS"}
                          </div>
                        )}
                      </div>
                      
                      <div className={`font-medium ${match.status === "finished" && match.player2Score! > match.player1Score! ? "text-emerald-400" : "text-zinc-200"} flex-1 truncate`}>
                        {getPlayerName(match.player2Id)}
                      </div>
                    </div>

                    {/* Meta informacje meczu */}
                    <div className="w-full sm:w-auto flex justify-between sm:flex-col items-center sm:items-end text-xs text-zinc-500 shrink-0 border-t sm:border-t-0 sm:border-l border-zinc-800 pt-3 sm:pt-0 sm:pl-4">
                      <span className="bg-zinc-800/50 px-2 py-0.5 rounded text-zinc-400 font-medium">Mecz #{match.matchNumber}</span>
                      <span>{match.matchLabel}</span>
                    </div>

                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </motion.div>
    </div>
  );
}
