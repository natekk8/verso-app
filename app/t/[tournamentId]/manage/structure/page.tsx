"use client";
import Link from "next/link";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { getAdminToken } from "@/lib/auth";
import { use, useState } from "react";
import { motion } from "motion/react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Plus, Table, TreeStructure, DotsSixVertical, WarningCircle, Trash, CaretRight } from "@phosphor-icons/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export default function StructurePage({
  params,
}: {
  params: Promise<{ tournamentId: string }>;
}) {
  const { tournamentId } = use(params);
  const adminToken = getAdminToken(tournamentId) || "";

  const phases = useQuery(api.phases.getByTournament, { tournamentId: tournamentId as Id<"tournaments"> });
  const createPhase = useMutation(api.phases.create);
  const removePhase = useMutation(api.phases.remove);

  const [isCreating, setIsCreating] = useState(false);
  const [newPhaseName, setNewPhaseName] = useState("");
  const [newPhaseType, setNewPhaseType] = useState<"group" | "bracket">("group");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPhaseName.trim()) return;
    try {
      setIsCreating(true);
      await createPhase({
        tournamentId: tournamentId as Id<"tournaments">,
        adminToken,
        name: newPhaseName.trim(),
        type: newPhaseType,
        order: phases ? phases.length : 0,
        matchDuration: 45
      });
      setNewPhaseName("");
      setIsCreating(false);
      toast.success("Faza została utworzona");
    } catch (err) {
      setIsCreating(false);
      toast.error("Błąd podczas tworzenia fazy");
    }
  };

  const handleRemove = async (id: string) => {
    if (!confirm("Na pewno usunąć tę fazę i WSZYSTKIE jej mecze/grupy?")) return;
    try {
      await removePhase({ phaseId: id as Id<"phases">, tournamentId: tournamentId as Id<"tournaments">, adminToken });
      toast.success("Faza usunięta");
    } catch (err) {
      toast.error("Błąd usuwania");
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight mb-2">Podział i Fazy</h1>
            <p className="text-muted-foreground">Skonfiguruj grupy i drabinki pucharowe.</p>
          </div>
          
          <Dialog>
            <DialogTrigger className="inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors focus-visible:outline-none h-9 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white shadow-[0_0_14px_rgba(37,99,235,0.2)]">
              <Plus weight="bold" className="w-4 h-4" /> Dodaj fazę
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Utwórz nową fazę</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Nazwa fazy</Label>
                  <Input 
                    placeholder="np. Faza Grupowa, Finały" 
                    value={newPhaseName} 
                    onChange={e => setNewPhaseName(e.target.value)} 
                    required 
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label>Rodzaj fazy</Label>
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    <button
                      type="button"
                      onClick={() => setNewPhaseType("group")}
                      className={`flex flex-col items-center p-4 border rounded-xl transition-all ${newPhaseType === "group" ? "border-blue-500 bg-blue-500/10 text-blue-400" : "border-zinc-800 hover:border-zinc-700"}`}
                    >
                      <Table className="w-8 h-8 mb-2" />
                      <span className="text-sm font-medium">Grupy</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewPhaseType("bracket")}
                      className={`flex flex-col items-center p-4 border rounded-xl transition-all ${newPhaseType === "bracket" ? "border-blue-500 bg-blue-500/10 text-blue-400" : "border-zinc-800 hover:border-zinc-700"}`}
                    >
                      <TreeStructure className="w-8 h-8 mb-2" />
                      <span className="text-sm font-medium">Drabinka</span>
                    </button>
                  </div>
                </div>
                <div className="pt-4 flex justify-end">
                  <Button type="submit" disabled={isCreating || !newPhaseName.trim()}>
                    {isCreating ? "Zapisywanie..." : "Utwórz fazę"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Lista faz */}
        <div className="space-y-4">
          {!phases ? (
            <div className="h-32 bg-zinc-900/50 rounded-2xl animate-pulse" />
          ) : phases.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-zinc-800 rounded-2xl bg-zinc-900/20">
              <TreeStructure className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
              <h3 className="text-lg font-medium">Brak zdefiniowanych faz</h3>
              <p className="text-sm text-zinc-500 mt-1 max-w-sm mx-auto">
                Aby móc generować mecze, musisz najpierw stworzyć Fazę Grupową lub Drabinkę.
              </p>
            </div>
          ) : (
            phases.map((phase, idx) => (
              <motion.div 
                key={phase._id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="bg-zinc-900 border border-zinc-800/80 rounded-2xl p-5 flex flex-col sm:flex-row gap-4 justify-between group hover:border-zinc-700 transition-colors"
              >
                <div className="flex gap-4">
                  <div className="mt-1 text-zinc-600 cursor-grab active:cursor-grabbing">
                    <DotsSixVertical className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-lg text-zinc-100">{phase.name}</h3>
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
                        {phase.type === "group" ? "Grupy" : "Drabinka"}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-500">
                      {phase.status === "pending" && "Wersja robocza • Gotowa do losowania"}
                      {phase.status === "active" && "W toku • Rozgrywana"}
                      {phase.status === "finished" && "Zakończona"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-10 sm:ml-0">
                  <Link href={`/t/${tournamentId}/manage/structure/${phase._id}`}>
                    <Button variant="outline" size="sm" className="gap-2 border-zinc-800 hover:bg-zinc-800">
                      Konfiguruj <CaretRight weight="bold" />
                    </Button>
                  </Link>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => handleRemove(phase._id)}
                    className="text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10"
                  >
                    <Trash weight="bold" />
                  </Button>
                </div>
              </motion.div>
            ))
          )}
        </div>

      </motion.div>
    </div>
  );
}
