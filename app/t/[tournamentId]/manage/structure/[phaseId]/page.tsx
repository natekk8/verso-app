"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { getAdminToken } from "@/lib/auth";
import { use, useState } from "react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Users, Shuffle, CaretLeft, Trash, Plus } from "@phosphor-icons/react";
import Link from "next/link";
import { Input } from "@/components/ui/input";

export default function PhaseConfigPage({
  params,
}: {
  params: Promise<{ tournamentId: string; phaseId: string }>;
}) {
  const { tournamentId, phaseId } = use(params);
  const adminToken = getAdminToken(tournamentId) || "";

  const phase = useQuery(api.phases.getByTournament, { tournamentId: tournamentId as Id<"tournaments"> })?.find(p => p._id === phaseId);
  const players = useQuery(api.players.getByTournament, { tournamentId: tournamentId as Id<"tournaments"> });
  const groups = useQuery(api.groups.getByPhase, { phaseId: phaseId as Id<"phases"> });
  const matches = useQuery(api.matches.getByPhase, { phaseId: phaseId as Id<"phases"> });

  const createGroup = useMutation(api.groups.create);
  const removeGroup = useMutation(api.groups.remove);
  const addPlayerToGroup = useMutation(api.groups.addPlayer);
  const removePlayerFromGroup = useMutation(api.groups.removePlayer);
  const createMatches = useMutation(api.matches.createMany);
  const removePhaseMatches = useMutation(api.matches.removeByPhase);
  const updatePhaseStatus = useMutation(api.phases.updateStatus);

  const [newGroupName, setNewGroupName] = useState("");

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    try {
      await createGroup({
        tournamentId: tournamentId as Id<"tournaments">,
        phaseId: phaseId as Id<"phases">,
        name: newGroupName.trim(),
        playerIds: [],
        adminToken
      });
      setNewGroupName("");
      toast.success("Grupa utworzona");
    } catch (e) {
      toast.error("Błąd tworzenia grupy");
    }
  };

  const assignAllToGroup = async (groupId: Id<"groups">) => {
    if (!players) return;
    try {
      for (const p of players) {
        await addPlayerToGroup({ groupId, tournamentId: tournamentId as Id<"tournaments">, playerId: p._id, adminToken });
      }
      toast.success("Wszyscy gracze przypisani!");
    } catch (e) {
      toast.error("Błąd przypisywania graczy");
    }
  };

  const generateRoundRobin = async () => {
    if (!groups || groups.length === 0) {
      toast.error("Utwórz najpierw grupę i przypisz graczy");
      return;
    }
    
    if (!confirm("Na pewno? To usunie obecne mecze w tej fazie i wygeneruje nowe.")) return;

    try {
      await removePhaseMatches({ phaseId: phaseId as Id<"phases">, adminToken });

      const newMatches: any[] = [];
      let matchCounter = 1;

      for (const group of groups) {
        const pIds = [...group.playerIds];
        if (pIds.length < 2) continue;
        
        // Dummy round robin logic (each plays each once)
        for (let i = 0; i < pIds.length; i++) {
          for (let j = i + 1; j < pIds.length; j++) {
            if (pIds[i] && pIds[j]) {
              newMatches.push({
                tournamentId: tournamentId as Id<"tournaments">,
                phaseId: phaseId as Id<"phases">,
                groupId: group._id,
                player1Id: pIds[i],
                player2Id: pIds[j],
                round: 1,
                matchNumber: matchCounter++,
                matchLabel: `${group.name}`,
                status: "pending" as const
              });
            }
          }
        }
      }

      if (newMatches.length > 0) {
        await createMatches({ matches: newMatches, adminToken });
        await updatePhaseStatus({ phaseId: phaseId as Id<"phases">, tournamentId: tournamentId as Id<"tournaments">, status: "active", adminToken });
        toast.success(`Wygenerowano ${newMatches.length} meczów!`);
      } else {
        toast.error("Brak graczy do wygenerowania meczów");
      }
    } catch (e) {
      toast.error("Błąd generowania: " + String(e));
    }
  };

  if (phase === undefined || groups === undefined || players === undefined) return <div className="p-10 animate-pulse bg-zinc-900/20 h-64 rounded-2xl max-w-4xl mx-auto mt-10"></div>;
  if (!phase) return <div>Faza nie istnieje</div>;

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto">
      <Link href={`/t/${tournamentId}/manage/structure`} className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-300 mb-6 w-fit transition-colors">
        <CaretLeft weight="bold" /> Wróć do struktury
      </Link>
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight mb-2">{phase.name}</h1>
          <p className="text-muted-foreground">Skonfiguruj uczestników w tej fazie i wygeneruj terminarz.</p>
        </div>
        
        <Button onClick={generateRoundRobin} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)]">
          <Shuffle weight="bold" className="mr-2" /> Generuj Terminarz
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Zarządzanie grupami */}
        <div className="space-y-6">
          <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm">
            <h2 className="text-sm font-medium mb-4 flex items-center gap-2 text-foreground">
              <Plus className="w-4 h-4 text-blue-500" /> Utwórz nową grupę
            </h2>
            <div className="flex gap-2">
              <Input 
                placeholder="Nazwa, np. Grupa A" 
                value={newGroupName} 
                onChange={e => setNewGroupName(e.target.value)}
                className="bg-background"
              />
              <Button onClick={handleCreateGroup} disabled={!newGroupName.trim()} className="bg-blue-600 hover:bg-blue-700">Dodaj</Button>
            </div>
          </div>

          <div className="space-y-4">
            {groups.map((g) => (
              <div key={g._id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold">{g.name} <span className="text-xs text-zinc-500 font-normal">({g.playerIds.length} graczy)</span></h3>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => assignAllToGroup(g._id)}>+ Wszyscy z turnieju</Button>
                    <Button variant="ghost" size="icon" className="text-rose-400 hover:bg-rose-500/10" onClick={() => removeGroup({ groupId: g._id, tournamentId: tournamentId as Id<"tournaments">, adminToken })}><Trash /></Button>
                  </div>
                </div>
                
                {/* Lista graczy w grupie */}
                <div className="flex flex-wrap gap-2">
                  {g.playerIds.map(pid => {
                    const p = players.find(x => x._id === pid);
                    if (!p) return null;
                    return (
                      <div key={pid} className="flex items-center gap-2 bg-zinc-800 px-3 py-1.5 rounded-full text-xs font-medium border border-zinc-700">
                        <img src={`https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(p.name)}&backgroundColor=2563eb,3b82f6&textColor=ffffff&fontWeight=700&radius=20`} className="w-4 h-4 rounded-full" />
                        {p.name}
                        <button onClick={() => removePlayerFromGroup({ groupId: g._id, tournamentId: tournamentId as Id<"tournaments">, playerId: pid as Id<"players">, adminToken })} className="text-zinc-500 hover:text-rose-400 ml-1">×</button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Podgląd wygenerowanych meczów */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <h2 className="text-sm font-medium mb-4 flex items-center justify-between text-foreground">
            Podgląd meczów (Faza)
            <span className="text-xs bg-zinc-800 px-2 py-1 rounded text-zinc-400">{matches?.length || 0} spotkań</span>
          </h2>
          
          <div className="space-y-2 h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {!matches || matches.length === 0 ? (
              <div className="text-center text-sm text-zinc-500 py-10">Brak meczów. Kliknij "Generuj Terminarz".</div>
            ) : (
              matches.map((m) => {
                const p1 = players.find(p => p._id === m.player1Id)?.name || "?";
                const p2 = players.find(p => p._id === m.player2Id)?.name || "?";
                return (
                  <div key={m._id} className="flex justify-between items-center p-3 bg-zinc-950 border border-zinc-800/80 rounded-lg text-sm">
                    <span className="flex-1 text-right text-zinc-300 truncate px-2">{p1}</span>
                    <span className="text-zinc-600 font-bold px-2">VS</span>
                    <span className="flex-1 text-left text-zinc-300 truncate px-2">{p2}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export const runtime = 'edge';
