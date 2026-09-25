"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { getAdminToken } from "@/lib/auth";
import { use, useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Users, UsersThree, Trash, Plus, ShieldCheck, User } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";

export default function TeamsPage({
  params,
}: {
  params: Promise<{ tournamentId: string }>;
}) {
  const { tournamentId } = use(params);
  const [adminToken, setAdminToken] = useState<string | null>(null);

  useEffect(() => {
    setAdminToken(getAdminToken(tournamentId) || "");
  }, [tournamentId]);

  const teams = useQuery(api.teams.getByTournament, { tournamentId: tournamentId as Id<"tournaments"> });
  const players = useQuery(api.players.getByTournament, { tournamentId: tournamentId as Id<"tournaments"> });
  const createTeam = useMutation(api.teams.create);
  const removeTeam = useMutation(api.teams.remove);

  const [newName, setNewName] = useState("");
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !adminToken) return;
    setIsCreating(true);
    try {
      await createTeam({
        tournamentId: tournamentId as Id<"tournaments">,
        adminToken,
        name: newName.trim(),
        playerIds: selectedPlayerIds as Id<"players">[],
      });
      setNewName("");
      setSelectedPlayerIds([]);
      toast.success(`Utworzono zespół: ${newName.trim()}`);
    } catch (e) {
      toast.error("Błąd tworzenia zespołu");
    } finally {
      setIsCreating(false);
    }
  };

  const handleRemove = async (id: string) => {
    if (!adminToken) return;
    if (!confirm("Na pewno usunąć ten zespół?")) return;
    try {
      await removeTeam({
        teamId: id as Id<"teams">,
        adminToken,
      });
      toast.success("Zespół usunięty");
    } catch (e) {
      toast.error("Błąd usuwania zespołu");
    }
  };

  const togglePlayer = (playerId: string) => {
    setSelectedPlayerIds(prev =>
      prev.includes(playerId)
        ? prev.filter(id => id !== playerId)
        : [...prev, playerId]
    );
  };

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight mb-2">Zespoły</h1>
            <p className="text-muted-foreground">Zarządzaj zespołami i przypisuj do nich zawodników.</p>
          </div>
          <div className="bg-purple-500/10 text-purple-400 px-4 py-2 rounded-lg border border-purple-500/20 flex items-center gap-2 text-sm font-medium">
            <UsersThree weight="bold" className="w-5 h-5" />
            {teams ? teams.length : 0} Zespołów
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          
          {/* Create Team (Left Column) */}
          <div className="lg:col-span-1 space-y-6">
            <section className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm">
              <h2 className="text-sm font-medium mb-4 flex items-center gap-2 text-foreground">
                <ShieldCheck className="w-4 h-4 text-purple-500" /> Nowy zespół
              </h2>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Input 
                    placeholder="Nazwa zespołu (np. FC Kaczki)" 
                    value={newName} 
                    onChange={e => setNewName(e.target.value)}
                    className="bg-background"
                  />
                </div>
                
                <div className="space-y-2 pt-2 border-t border-border/50">
                  <div className="text-xs font-medium text-muted-foreground mb-3 flex items-center justify-between">
                    <span>Przypisz zawodników ({selectedPlayerIds.length})</span>
                    {selectedPlayerIds.length > 0 && (
                      <button 
                        type="button" 
                        onClick={() => setSelectedPlayerIds([])}
                        className="text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Wyczyść
                      </button>
                    )}
                  </div>
                  
                  {!players ? (
                    <div className="space-y-2">
                      {[1,2].map(i => <div key={i} className="h-6 w-16 bg-zinc-800/30 rounded-full animate-pulse inline-block mr-2" />)}
                    </div>
                  ) : players.length === 0 ? (
                    <div className="text-xs text-muted-foreground italic">
                      Brak zawodników w turnieju.
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 max-h-[200px] overflow-y-auto pr-1 pb-1 -mr-2 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
                      {players.map((p) => {
                        const isSelected = selectedPlayerIds.includes(p._id);
                        return (
                          <Badge 
                            key={p._id}
                            variant={isSelected ? "default" : "outline"}
                            className={`cursor-pointer transition-all active:scale-95 select-none ${isSelected ? 'bg-purple-600 hover:bg-purple-700 text-white border-purple-500' : 'hover:border-purple-500/50'}`}
                            onClick={() => togglePlayer(p._id)}
                          >
                            {p.name}
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                </div>

                <Button 
                  type="submit" 
                  disabled={!newName.trim() || isCreating} 
                  className="w-full bg-purple-600 hover:bg-purple-700 mt-4 text-white"
                >
                  <Plus weight="bold" className="mr-2" />
                  Utwórz zespół
                </Button>
              </form>
            </section>
          </div>

          {/* Teams List (Right Column) */}
          <div className="lg:col-span-2">
            <section className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm min-h-[400px]">
              <div className="p-4 border-b border-border/50 bg-zinc-900/50 flex items-center justify-between">
                <h2 className="text-sm font-medium">Utworzone zespoły</h2>
              </div>
              
              <div className="p-3">
                {!teams || !players ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-1">
                    {[1,2,3,4].map(i => <div key={i} className="h-24 bg-zinc-800/30 rounded-xl animate-pulse" />)}
                  </div>
                ) : teams.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground flex flex-col items-center">
                    <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mb-4 border border-zinc-700">
                      <UsersThree className="w-6 h-6 text-zinc-500" />
                    </div>
                    <p className="text-sm">Brak zespołów</p>
                    <p className="text-xs mt-1 text-zinc-500">Utwórz pierwszy zespół po lewej stronie</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <AnimatePresence>
                      {teams.map((team) => {
                        const teamPlayers = players.filter(p => team.playerIds.includes(p._id));
                        
                        return (
                          <motion.div
                            key={team._id}
                            initial={{ opacity: 0, scale: 0.98, y: -5 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.2 }}
                            className="group relative flex flex-col justify-between p-4 bg-zinc-900/40 hover:bg-zinc-800/60 rounded-xl transition-all border border-border/40 hover:border-purple-500/30"
                          >
                            <div className="flex items-start justify-between mb-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg shadow-sm bg-gradient-to-br from-purple-500/20 to-purple-600/10 border border-purple-500/20 flex items-center justify-center shrink-0">
                                  <ShieldCheck weight="duotone" className="w-5 h-5 text-purple-400" />
                                </div>
                                <div>
                                  <div className="font-semibold text-sm text-zinc-100 line-clamp-1">{team.name}</div>
                                  <div className="text-[11px] text-zinc-500 font-medium flex items-center gap-1 mt-0.5">
                                    <User className="w-3 h-3" />
                                    {teamPlayers.length} zawodników
                                  </div>
                                </div>
                              </div>
                              
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => handleRemove(team._id)}
                                className="h-8 w-8 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-opacity -mt-1 -mr-1"
                              >
                                <Trash weight="bold" />
                              </Button>
                            </div>
                            
                            {teamPlayers.length > 0 ? (
                              <div className="flex flex-wrap gap-1 mt-auto">
                                {teamPlayers.slice(0, 5).map(p => (
                                  <div key={p._id} className="text-[10px] px-1.5 py-0.5 rounded-md bg-zinc-800 text-zinc-300 border border-zinc-700/50 truncate max-w-[80px]" title={p.name}>
                                    {p.name.split(' ')[0]}
                                  </div>
                                ))}
                                {teamPlayers.length > 5 && (
                                  <div className="text-[10px] px-1.5 py-0.5 rounded-md bg-zinc-800 text-zinc-500 border border-zinc-700/50">
                                    +{teamPlayers.length - 5}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="text-[11px] text-zinc-600 italic mt-auto pt-2">
                                Brak przypisanych zawodników
                              </div>
                            )}
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </section>
          </div>

        </div>
      </motion.div>
    </div>
  );
}

export const runtime = 'edge';
