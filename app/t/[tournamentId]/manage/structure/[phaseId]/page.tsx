"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { getAdminToken } from "@/lib/auth";
import { use, useState, useEffect } from "react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Users, Shuffle, CaretLeft, Trash, Plus } from "@phosphor-icons/react";
import Link from "next/link";
import { Input } from "@/components/ui/input";

export default function ManagePhasePage({
  params,
}: {
  params: Promise<{ tournamentId: string; phaseId: string }>;
}) {
  const { tournamentId, phaseId } = use(params);
  const [adminToken, setAdminToken] = useState<string | null>(null);

  useEffect(() => {
    setAdminToken(getAdminToken(tournamentId));
  }, [tournamentId]);

  const t = useQuery(api.tournaments.get, { id: tournamentId as Id<"tournaments"> });
  const phase = useQuery(api.phases.getByTournament, { tournamentId: tournamentId as Id<"tournaments"> })?.find(p => p._id === phaseId);
  const groups = useQuery(api.groups.getByPhase, { phaseId: phaseId as Id<"phases"> });
  const allPlayers = useQuery(api.players.getByTournament, { tournamentId: tournamentId as Id<"tournaments"> });
  const matches = useQuery(api.matches.getByPhase, { phaseId: phaseId as Id<"phases"> });

  const createGroup = useMutation(api.groups.create);
  const removeGroup = useMutation(api.groups.remove);
  const addPlayerToGroup = useMutation(api.groups.addPlayer);
  const removePlayerFromGroup = useMutation(api.groups.removePlayer);
  const createMatches = useMutation(api.matches.createMany);
  const removePhaseMatches = useMutation(api.matches.removeByPhase);

  const [newGroupName, setNewGroupName] = useState("");
  const [legs, setLegs] = useState(1);

  if (t === undefined || phase === undefined || groups === undefined || allPlayers === undefined || matches === undefined) {
    return <div className="p-8 text-zinc-500">Wczytywanie...</div>;
  }

  if (!phase) {
    return <div className="p-8 text-rose-500">Nie znaleziono fazy.</div>;
  }

  const handleCreateGroup = async () => {
    if (!adminToken || !newGroupName.trim()) return;
    try {
      await createGroup({ tournamentId: tournamentId as Id<"tournaments">, phaseId: phaseId as Id<"phases">, name: newGroupName.trim(), playerIds: [], adminToken });
      setNewGroupName("");
      toast.success("Grupa utworzona");
    } catch (e) {
      toast.error("Błąd podczas tworzenia grupy");
    }
  };

  const handleRemoveGroup = async (groupId: string) => {
    if (!adminToken) return;
    if (!confirm("Na pewno usunąć grupę?")) return;
    try {
      await removeGroup({ groupId: groupId as Id<"groups">, tournamentId: tournamentId as Id<"tournaments">, adminToken });
      toast.success("Grupa usunięta");
    } catch (e) {
      toast.error("Błąd usuwania");
    }
  };

  const generateRoundRobin = async () => {
    if (!groups || groups.length === 0) {
      toast.error("Utwórz najpierw grupę i przypisz graczy");
      return;
    }
    
    if (!confirm(`Na pewno? To usunie obecne mecze w tej fazie i wygeneruje nowe harmonogramy każdy z każdym (Ilość rund: ${legs}).`)) return;

    try {
      await removePhaseMatches({ phaseId: phaseId as Id<"phases">, adminToken: adminToken! });

      const { generateRoundRobin: runBerger } = await import('@/lib/tournament-logic');
      const newMatches: any[] = [];
      let matchCounter = 1;

      for (const group of groups) {
        if (group.playerIds.length < 2) continue;
        
        const groupMatches = runBerger(
          group._id,
          phaseId as Id<"phases">,
          tournamentId as Id<"tournaments">,
          group.playerIds,
          matchCounter,
          legs
        );
        
        newMatches.push(...groupMatches);
        matchCounter += groupMatches.length;
      }

      await createMatches({ adminToken: adminToken!, matches: newMatches });
      toast.success("Mecze wygenerowane pomyślnie");
    } catch (e) {
      toast.error("Błąd generowania meczów");
      console.error(e);
    }
  };

  // Remaining players not in ANY group in THIS phase
  const assignedPlayerIds = new Set(groups.flatMap(g => g.playerIds));
  const unassignedPlayers = allPlayers.filter(p => !assignedPlayerIds.has(p._id));

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div className="flex items-center gap-4">
        <Link href={`/t/${tournamentId}/manage/structure`} className="p-2 bg-zinc-900 hover:bg-zinc-800 rounded-xl transition-colors">
          <CaretLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-foreground">Konfiguracja: {phase.name}</h1>
          <p className="text-muted-foreground mt-2">
            Przypisz graczy do grup (lub drabinki) i wygeneruj mecze.
          </p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* LEFT COL: Players pool */}
        <div className="w-full md:w-1/3 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Users className="w-5 h-5 text-zinc-400" /> Zawodnicy ({unassignedPlayers.length})
          </h2>
          <div className="bg-card border border-border/50 rounded-2xl p-4 min-h-[300px] max-h-[600px] overflow-y-auto space-y-2 shadow-sm">
            {unassignedPlayers.length === 0 ? (
              <p className="text-sm text-zinc-500 text-center py-10">Wszyscy gracze przypisani.</p>
            ) : (
              unassignedPlayers.map(p => (
                <div key={p._id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 flex justify-between items-center">
                  <span className="text-sm font-medium">{p.name}</span>
                  {/* Select group to assign */}
                  {groups.length > 0 && (
                    <select 
                      className="bg-zinc-950 border border-zinc-800 rounded-lg text-xs px-2 py-1"
                      onChange={async (e) => {
                        const targetGroupId = e.target.value;
                        if (!targetGroupId || !adminToken) return;
                        await addPlayerToGroup({ groupId: targetGroupId as Id<"groups">, tournamentId: tournamentId as Id<"tournaments">, playerId: p._id, adminToken });
                        e.target.value = "";
                      }}
                      defaultValue=""
                    >
                      <option value="" disabled>Dodaj do...</option>
                      {groups.map(g => (
                        <option key={g._id} value={g._id}>{g.name}</option>
                      ))}
                    </select>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* RIGHT COL: Groups */}
        <div className="w-full md:w-2/3 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex gap-2">
              <Input 
                value={newGroupName} 
                onChange={e => setNewGroupName(e.target.value)} 
                placeholder="Nazwa grupy (np. Grupa A)" 
                className="bg-card w-48"
              />
              <Button onClick={handleCreateGroup} variant="outline" className="shrink-0">
                <Plus className="w-4 h-4 mr-2" /> Dodaj
              </Button>
            </div>
            
            {groups.length > 0 && (
              <div className="flex items-center gap-2 bg-card p-1 rounded-xl border border-border/50">
                <label className="text-xs text-zinc-500 font-medium px-2">Mecze/Rewanże:</label>
                <Input 
                  type="number" 
                  min={1} 
                  max={10} 
                  value={legs} 
                  onChange={e => setLegs(parseInt(e.target.value) || 1)} 
                  className="w-16 h-8 text-center bg-zinc-950 border-zinc-800"
                />
                <Button onClick={generateRoundRobin} className="bg-blue-600 hover:bg-blue-500 text-white h-8">
                  <Shuffle className="w-4 h-4 mr-2" /> Wygeneruj
                </Button>
              </div>
            )}
          </div>

          {matches.length > 0 && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-xl p-4 text-sm font-medium flex items-center justify-between">
              <span>Wygenerowano {matches.length} meczów dla tej fazy!</span>
              <Button variant="outline" size="sm" className="border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/10" onClick={() => removePhaseMatches({ phaseId: phaseId as Id<"phases">, adminToken: adminToken! })}>
                Wyczyść mecze
              </Button>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            {groups.map(g => (
              <div key={g._id} className="bg-card border border-border/50 rounded-2xl p-4 shadow-sm">
                <div className="flex justify-between items-center mb-4 border-b border-zinc-800 pb-2">
                  <h3 className="font-bold text-foreground">{g.name}</h3>
                  <Button variant="ghost" size="sm" className="text-zinc-500 hover:text-rose-500 h-8 px-2" onClick={() => handleRemoveGroup(g._id)}>
                    <Trash className="w-4 h-4" />
                  </Button>
                </div>
                
                <div className="space-y-2">
                  {g.playerIds.length === 0 ? (
                    <p className="text-xs text-zinc-500 text-center py-4">Pusta grupa</p>
                  ) : (
                    g.playerIds.map(pid => {
                      if (!pid) return null;
                      const p = allPlayers.find(pl => pl._id === pid);
                      if (!p) return null;
                      return (
                        <div key={pid} className="bg-zinc-900/50 rounded-lg p-2 text-sm flex justify-between items-center group">
                          <span>{p.name}</span>
                          <button 
                            onClick={async () => {
                              if (!adminToken) return;
                              await removePlayerFromGroup({ groupId: g._id, tournamentId: tournamentId as Id<"tournaments">, playerId: pid as Id<"players">, adminToken });
                            }}
                            className="text-zinc-500 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash className="w-4 h-4" />
                          </button>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export const runtime = 'edge';
