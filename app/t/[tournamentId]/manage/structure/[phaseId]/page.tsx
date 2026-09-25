"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { getAdminToken } from "@/lib/auth";
import { use, useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Users,
  Shuffle,
  CaretLeft,
  Trash,
  Plus,
  SoccerBall,
  ArrowRight,
  ListBullets,
  WarningCircle,
  X,
  Clock,
} from "@phosphor-icons/react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────

interface ManualMatchForm {
  player1Id: string;
  player2Id: string;
  round: number;
  matchLabel: string;
  scheduledTime: string;
}

const EMPTY_FORM: ManualMatchForm = {
  player1Id: "",
  player2Id: "",
  round: 1,
  matchLabel: "",
  scheduledTime: "",
};

// ─── Page ─────────────────────────────────────────────────────

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

  // ─── Queries ────────────────────────────────────────────────
  const t = useQuery(api.tournaments.get, {
    id: tournamentId as Id<"tournaments">,
  });
  const phase = useQuery(api.phases.getByTournament, {
    tournamentId: tournamentId as Id<"tournaments">,
  })?.find((p) => p._id === phaseId);
  const groups = useQuery(api.groups.getByPhase, {
    phaseId: phaseId as Id<"phases">,
  });
  const allPlayers = useQuery(api.players.getByTournament, {
    tournamentId: tournamentId as Id<"tournaments">,
  });
  const matches = useQuery(api.matches.getByPhase, {
    phaseId: phaseId as Id<"phases">,
  });

  // ─── Mutations ──────────────────────────────────────────────
  const createGroup = useMutation(api.groups.create);
  const removeGroup = useMutation(api.groups.remove);
  const addPlayerToGroup = useMutation(api.groups.addPlayer);
  const removePlayerFromGroup = useMutation(api.groups.removePlayer);
  const createMatches = useMutation(api.matches.createMany);
  const createSingleMatch = useMutation(api.matches.createSingle);
  const removePhaseMatches = useMutation(api.matches.removeByPhase);
  const removeMatch = useMutation(api.matches.remove);

  // ─── Local state ────────────────────────────────────────────
  const [newGroupName, setNewGroupName] = useState("");
  const [legs, setLegs] = useState(1);
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [manualForm, setManualForm] = useState<ManualMatchForm>(EMPTY_FORM);
  const [savingManual, setSavingManual] = useState(false);
  const [generatingRR, setGeneratingRR] = useState(false);

  // ─── Loading / not found ─────────────────────────────────────
  if (
    t === undefined ||
    phase === undefined ||
    groups === undefined ||
    allPlayers === undefined ||
    matches === undefined
  ) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-500 text-sm">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-5 h-5 border-2 border-zinc-700 border-t-blue-500 rounded-full mr-3"
        />
        Wczytywanie struktury fazy...
      </div>
    );
  }

  if (!phase) {
    return (
      <div className="flex items-center gap-2 p-8 text-rose-500 text-sm bg-rose-500/10 rounded-xl border border-rose-500/20 max-w-lg mx-auto mt-10">
        <WarningCircle className="w-5 h-5" />
        Nie znaleziono fazy.
      </div>
    );
  }

  // ─── Derived ────────────────────────────────────────────────
  const assignedPlayerIds = new Set(groups.flatMap((g) => g.playerIds));
  const unassignedPlayers = (allPlayers ?? []).filter(
    (p) => !assignedPlayerIds.has(p._id)
  );

  // Group matches by round
  const matchesByRound = (matches ?? []).reduce<Record<number, typeof matches>>(
    (acc, m) => {
      if (!acc[m.round]) acc[m.round] = [];
      acc[m.round].push(m);
      return acc;
    },
    {}
  );
  const sortedRounds = Object.keys(matchesByRound)
    .map(Number)
    .sort((a, b) => a - b);

  // ─── Handlers ───────────────────────────────────────────────

  const handleCreateGroup = async () => {
    if (!adminToken || !newGroupName.trim()) return;
    try {
      await createGroup({
        tournamentId: tournamentId as Id<"tournaments">,
        phaseId: phaseId as Id<"phases">,
        name: newGroupName.trim(),
        playerIds: [],
        adminToken,
      });
      setNewGroupName("");
      toast.success("Grupa utworzona");
    } catch {
      toast.error("Błąd podczas tworzenia grupy");
    }
  };

  const handleRemoveGroup = async (groupId: string) => {
    if (!adminToken) return;
    if (!confirm("Na pewno usunąć grupę i wszystkich jej graczy?")) return;
    try {
      await removeGroup({
        groupId: groupId as Id<"groups">,
        tournamentId: tournamentId as Id<"tournaments">,
        adminToken,
      });
      toast.success("Grupa usunięta");
    } catch {
      toast.error("Błąd usuwania grupy");
    }
  };

  const handleAssignPlayer = async (playerId: string, groupId: string) => {
    if (!adminToken) return;
    try {
      await addPlayerToGroup({
        groupId: groupId as Id<"groups">,
        tournamentId: tournamentId as Id<"tournaments">,
        playerId: playerId as Id<"players">,
        adminToken,
      });
    } catch {
      toast.error("Błąd przypisania gracza");
    }
  };

  const handleRemoveFromGroup = async (groupId: string, playerId: string) => {
    if (!adminToken) return;
    try {
      await removePlayerFromGroup({
        groupId: groupId as Id<"groups">,
        tournamentId: tournamentId as Id<"tournaments">,
        playerId: playerId as Id<"players">,
        adminToken,
      });
    } catch {
      toast.error("Błąd usunięcia gracza z grupy");
    }
  };

  const handleGenerateRoundRobin = async () => {
    if (!groups || groups.length === 0) {
      toast.error("Utwórz najpierw grupę i przypisz graczy");
      return;
    }
    if (
      !confirm(
        `To usunie obecne mecze tej fazy i wygeneruje nowe (każdy z każdym, ilość rund: ${legs}). Kontynuować?`
      )
    )
      return;

    setGeneratingRR(true);
    try {
      await removePhaseMatches({
        phaseId: phaseId as Id<"phases">,
        adminToken: adminToken!,
      });

      const { generateRoundRobin: runBerger } = await import(
        "@/lib/tournament-logic"
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

      if (newMatches.length === 0) {
        toast.warning("Żadna grupa nie ma wystarczającej liczby graczy");
        return;
      }

      await createMatches({ adminToken: adminToken!, matches: newMatches as any });
      toast.success(`Wygenerowano ${newMatches.length} meczów`);
    } catch (e) {
      toast.error("Błąd generowania meczów");
      console.error(e);
    } finally {
      setGeneratingRR(false);
    }
  };

  const handleClearMatches = async () => {
    if (!adminToken) return;
    if (!confirm("Na pewno wyczyścić wszystkie mecze tej fazy?")) return;
    try {
      await removePhaseMatches({
        phaseId: phaseId as Id<"phases">,
        adminToken: adminToken!,
      });
      toast.success("Mecze usunięte");
    } catch {
      toast.error("Błąd usuwania meczów");
    }
  };

  const handleDeleteMatch = async (matchId: string) => {
    if (!adminToken) return;
    try {
      await removeMatch({ id: matchId as Id<"matches">, adminToken });
      toast.success("Mecz usunięty");
    } catch {
      toast.error("Błąd usuwania meczu");
    }
  };

  const handleSaveManualMatch = async () => {
    if (!adminToken) return;
    if (!manualForm.player1Id || !manualForm.player2Id) {
      toast.error("Wybierz obu zawodników");
      return;
    }
    if (manualForm.player1Id === manualForm.player2Id) {
      toast.error("Zawodnicy muszą być różni");
      return;
    }
    setSavingManual(true);
    try {
      const nextMatchNum = (matches?.length ?? 0) + 1;
      await createSingleMatch({
        adminToken,
        tournamentId: tournamentId as Id<"tournaments">,
        phaseId: phaseId as Id<"phases">,
        player1Id: manualForm.player1Id as Id<"players">,
        player2Id: manualForm.player2Id as Id<"players">,
        round: manualForm.round,
        matchNumber: nextMatchNum,
        matchLabel: manualForm.matchLabel.trim() || `M${nextMatchNum}`,
        ...(manualForm.scheduledTime
          ? { scheduledTime: manualForm.scheduledTime }
          : {}),
      });
      toast.success("Mecz dodany");
      setManualForm(EMPTY_FORM);
      setManualModalOpen(false);
    } catch (e) {
      toast.error("Błąd dodawania meczu");
      console.error(e);
    } finally {
      setSavingManual(false);
    }
  };

  const playerName = (id: string | null | undefined) =>
    allPlayers?.find((p) => p._id === id)?.name ?? "—";

  const groupName = (id: string | null | undefined) =>
    groups?.find((g) => g._id === id)?.name;

  // ─── Render ─────────────────────────────────────────────────
  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href={`/t/${tournamentId}/manage/structure`}
          className="p-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700 rounded-xl transition-all shrink-0"
        >
          <CaretLeft className="w-5 h-5 text-zinc-300" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
            Konfiguracja: <span className="text-blue-400">{phase.name}</span>
          </h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            Przypisz graczy do grup i wygeneruj harmonogram meczów.
          </p>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* ── LEFT: Players pool ─────────────────────────────── */}
        <div className="w-full lg:w-72 shrink-0 space-y-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-500/10 rounded-md">
              <Users className="w-4 h-4 text-blue-400" />
            </div>
            <h2 className="text-sm font-semibold text-zinc-200">
              Pula zawodników
            </h2>
            <span className="ml-auto text-xs font-medium bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full">
              {unassignedPlayers.length}
            </span>
          </div>

          <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-2xl overflow-hidden shadow-sm">
            {unassignedPlayers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-zinc-500 text-xs gap-3">
                <div className="p-3 bg-zinc-800/50 rounded-full">
                  <Users className="w-6 h-6 text-zinc-400" />
                </div>
                <span>Wszyscy zawodnicy przypisani</span>
              </div>
            ) : (
              <div className="divide-y divide-zinc-800/60 max-h-[500px] overflow-y-auto">
                <AnimatePresence>
                  {unassignedPlayers.map((p, i) => (
                    <motion.div
                      key={p._id}
                      layout
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -8 }}
                      transition={{ delay: i * 0.02 }}
                      className="flex items-center justify-between px-4 py-3 hover:bg-zinc-800/40 transition-colors group"
                    >
                      <span className="text-sm font-medium text-zinc-200 truncate mr-3">
                        {p.name}
                      </span>
                      {groups.length > 0 && (
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <Select
                            onValueChange={async (gId: string | null) => {
                              if (!gId) return;
                              await handleAssignPlayer(p._id, gId);
                            }}
                          >
                            <SelectTrigger className="h-7 px-2 text-[11px] w-[100px] bg-zinc-950 border-zinc-700 hover:border-blue-500/50 transition-colors">
                              <SelectValue placeholder="Do grupy..." />
                            </SelectTrigger>
                            <SelectContent>
                              {groups.map((g) => (
                                <SelectItem key={g._id} value={g._id} className="text-xs">
                                  {g.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>

          {groups.length === 0 && unassignedPlayers.length > 0 && (
            <p className="text-xs text-zinc-500 text-center px-4">
              Utwórz grupę po prawej, by przypisać zawodników.
            </p>
          )}
        </div>

        {/* ── RIGHT: Groups + Generator ──────────────────────── */}
        <div className="flex-1 min-w-0 space-y-8">
          {/* Toolbar: create group + generate controls */}
          <div className="flex flex-wrap items-center gap-3 p-4 bg-zinc-900/40 border border-zinc-800/80 rounded-2xl">
            {/* New group form */}
            <div className="flex gap-2 flex-1 min-w-[260px]">
              <Input
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateGroup()}
                placeholder="Nazwa grupy (np. Grupa A)"
                className="bg-zinc-950 border-zinc-800 h-9"
              />
              <Button
                onClick={handleCreateGroup}
                disabled={!newGroupName.trim() || !adminToken}
                variant="outline"
                className="h-9 shrink-0 border-zinc-700 hover:border-blue-500 hover:bg-blue-500/10 hover:text-blue-400 transition-colors"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Dodaj grupę
              </Button>
            </div>

            <div className="w-px h-6 bg-zinc-800 hidden sm:block mx-1" />

            {/* Round-robin generator */}
            {groups.length > 0 && (
              <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 h-9">
                <label className="text-[11px] text-zinc-500 whitespace-nowrap font-medium uppercase tracking-wider ml-1">
                  Rund:
                </label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={legs}
                  onChange={(e) => setLegs(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-12 h-6 px-1 text-center bg-zinc-900 border-none text-xs focus-visible:ring-1 focus-visible:ring-blue-500"
                />
                <Button
                  onClick={handleGenerateRoundRobin}
                  disabled={generatingRR || !adminToken}
                  className="h-6 bg-blue-600 hover:bg-blue-500 text-white text-[11px] px-2.5 rounded-md transition-colors"
                >
                  <Shuffle className="w-3 h-3 mr-1" />
                  {generatingRR ? "Generuję..." : "Każdy z każdym"}
                </Button>
              </div>
            )}

            {/* Manual match button */}
            <Button
              variant="outline"
              className="h-9 border-zinc-800 bg-zinc-950 text-zinc-300 hover:text-zinc-100 hover:border-zinc-700 transition-colors"
              onClick={() => setManualModalOpen(true)}
            >
              <Plus className="w-4 h-4 mr-1.5 text-blue-500" />
              Dodaj mecz
            </Button>
          </div>

          <Dialog open={manualModalOpen} onOpenChange={setManualModalOpen}>
            <DialogContent className="sm:max-w-md bg-zinc-950 border-zinc-800 shadow-xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-zinc-100">
                  <div className="p-1.5 bg-blue-500/10 rounded-md">
                    <SoccerBall className="w-5 h-5 text-blue-400" />
                  </div>
                  Dodaj mecz ręcznie
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-5 py-3">
                {/* Players vs block */}
                <div className="relative flex flex-col gap-2">
                  {/* Player 1 Selection */}
                  <div className="bg-zinc-900/50 border border-zinc-800/80 p-3 rounded-xl space-y-2">
                    <Label className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">
                      Zawodnik 1 (Gospodarz)
                    </Label>
                    <Select
                      value={manualForm.player1Id}
                      onValueChange={(v) =>
                        setManualForm((f) => ({ ...f, player1Id: v || "" }))
                      }
                    >
                      <SelectTrigger className="w-full h-9 bg-zinc-950 border-zinc-800">
                        <SelectValue placeholder="Wybierz zawodnika" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[250px]">
                        {allPlayers?.map((p) => (
                          <SelectItem key={p._id} value={p._id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* VS Badge */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-7 h-7 rounded-full bg-zinc-950 border border-zinc-800 shadow-sm">
                    <span className="text-[9px] font-bold text-zinc-500">VS</span>
                  </div>

                  {/* Player 2 Selection */}
                  <div className="bg-zinc-900/50 border border-zinc-800/80 p-3 rounded-xl space-y-2">
                    <Label className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">
                      Zawodnik 2 (Gość)
                    </Label>
                    <Select
                      value={manualForm.player2Id}
                      onValueChange={(v) =>
                        setManualForm((f) => ({ ...f, player2Id: v || "" }))
                      }
                    >
                      <SelectTrigger className="w-full h-9 bg-zinc-950 border-zinc-800">
                        <SelectValue placeholder="Wybierz zawodnika" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[250px]">
                        {allPlayers
                          ?.filter((p) => p._id !== manualForm.player1Id)
                          .map((p) => (
                            <SelectItem key={p._id} value={p._id}>
                              {p.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Round */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-zinc-400">Kolejka (Runda)</Label>
                    <Input
                      type="number"
                      min={1}
                      value={manualForm.round}
                      onChange={(e) =>
                        setManualForm((f) => ({
                          ...f,
                          round: parseInt(e.target.value) || 1,
                        }))
                      }
                      className="bg-zinc-900 border-zinc-800 h-9"
                    />
                  </div>

                  {/* Match label */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-zinc-400">
                      Etykieta (np. Finał)
                    </Label>
                    <Input
                      value={manualForm.matchLabel}
                      onChange={(e) =>
                        setManualForm((f) => ({
                          ...f,
                          matchLabel: e.target.value,
                        }))
                      }
                      placeholder="Zostaw puste dla domyślnej"
                      className="bg-zinc-900 border-zinc-800 h-9 placeholder:text-zinc-600"
                    />
                  </div>
                </div>

                {/* Scheduled time */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-400 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    Godzina (opcjonalnie)
                  </Label>
                  <Input
                    type="time"
                    value={manualForm.scheduledTime}
                    onChange={(e) =>
                      setManualForm((f) => ({
                        ...f,
                        scheduledTime: e.target.value,
                      }))
                    }
                    className="bg-zinc-900 border-zinc-800 h-9 w-full"
                  />
                </div>
              </div>

              <DialogFooter className="mt-2 border-t border-zinc-800/50 pt-4 sm:justify-end">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setManualModalOpen(false);
                    setManualForm(EMPTY_FORM);
                  }}
                  className="text-zinc-400 hover:text-zinc-200"
                >
                  Anuluj
                </Button>
                <Button
                  onClick={handleSaveManualMatch}
                  disabled={
                    savingManual ||
                    !manualForm.player1Id ||
                    !manualForm.player2Id ||
                    !adminToken
                  }
                  className="bg-blue-600 hover:bg-blue-500 text-white min-w-[120px]"
                >
                  {savingManual ? "Zapisywanie..." : "Dodaj mecz"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Groups grid */}
          {groups.length === 0 ? (
            <div className="border border-dashed border-zinc-800/60 bg-zinc-900/20 rounded-2xl flex flex-col items-center justify-center py-16 text-zinc-500 gap-3">
              <div className="p-4 bg-zinc-800/30 rounded-full">
                <Users className="w-8 h-8" />
              </div>
              <p className="text-sm font-medium text-zinc-300">Brak grup w tej fazie</p>
              <p className="text-xs max-w-xs text-center">Wpisz nazwę grupy w panelu powyżej i kliknij „Dodaj grupę".</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
              <AnimatePresence mode="popLayout">
                {groups.map((g, i) => (
                  <motion.div
                    key={g._id}
                    layout
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                    transition={{ type: "spring", stiffness: 400, damping: 30, delay: i * 0.04 }}
                    className="bg-zinc-900/80 border border-zinc-800/80 rounded-2xl overflow-hidden shadow-sm flex flex-col"
                  >
                    {/* Group header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/60 bg-zinc-950/30">
                      <div className="flex items-center gap-2.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        <h3 className="font-semibold text-sm text-zinc-100 tracking-tight">
                          {g.name}
                        </h3>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                          {g.playerIds.length} graczy
                        </span>
                        <button
                          onClick={() => handleRemoveGroup(g._id)}
                          className="text-zinc-600 hover:text-rose-500 transition-colors p-1 rounded-md hover:bg-rose-500/10"
                          title="Usuń grupę"
                        >
                          <Trash className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Players in group */}
                    <div className="p-2 space-y-1 min-h-[100px] flex-1">
                      {g.playerIds.length === 0 ? (
                        <div className="text-xs text-zinc-500 h-full flex items-center justify-center text-center py-6">
                          Pusta grupa — przypisz zawodników z panelu po lewej
                        </div>
                      ) : (
                        <AnimatePresence>
                          {g.playerIds.map((pid) => {
                            if (!pid) return null;
                            const player = allPlayers?.find((pl) => pl._id === pid);
                            if (!player) return null;
                            return (
                              <motion.div
                                key={pid}
                                layout
                                initial={{ opacity: 0, x: 10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, height: 0, margin: 0, overflow: "hidden" }}
                                className="flex items-center justify-between bg-zinc-800/30 hover:bg-zinc-800/60 border border-transparent hover:border-zinc-700/50 rounded-lg px-3 py-2 group transition-all"
                              >
                                <span className="text-xs font-medium text-zinc-300 truncate">
                                  {player.name}
                                </span>
                                <button
                                  onClick={() => handleRemoveFromGroup(g._id, pid)}
                                  className="text-zinc-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0 p-1 rounded-md hover:bg-rose-500/10"
                                  title="Usuń z grupy"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </motion.div>
                            );
                          })}
                        </AnimatePresence>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}

          {/* ── Matches section ──────────────────────────────── */}
          {matches && matches.length > 0 && (
            <div className="space-y-5 pt-4">
              {/* Section header */}
              <div className="flex items-center justify-between border-b border-zinc-800/60 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-zinc-800 rounded-md">
                    <ListBullets className="w-4 h-4 text-zinc-300" />
                  </div>
                  <h2 className="text-base font-semibold text-zinc-100">
                    Mecze w fazie
                  </h2>
                  <span className="text-[11px] font-bold bg-blue-500/10 text-blue-400 px-2.5 py-0.5 rounded-full uppercase tracking-wider ml-2">
                    {matches.length} meczów
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearMatches}
                  disabled={!adminToken}
                  className="text-xs h-8 text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10"
                >
                  <Trash className="w-3.5 h-3.5 mr-1.5" />
                  Wyczyść wszystkie
                </Button>
              </div>

              {/* Rounds */}
              <div className="space-y-6">
                {sortedRounds.map((round) => (
                  <div key={round} className="space-y-3">
                    <div className="flex items-center gap-3">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                        Kolejka {round}
                      </h3>
                      <div className="flex-1 h-px bg-zinc-800/50" />
                    </div>
                    <div className="grid sm:grid-cols-2 gap-2">
                      <AnimatePresence initial={false}>
                        {matchesByRound[round]?.map((m, idx) => (
                          <motion.div
                            key={m._id}
                            layout
                            initial={{ opacity: 0, scale: 0.96 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.96 }}
                            transition={{ type: "spring", stiffness: 400, damping: 30, delay: idx * 0.02 }}
                            className="flex items-center justify-between bg-zinc-900/50 border border-zinc-800/80 rounded-xl p-3 group hover:border-zinc-700 hover:bg-zinc-900 transition-all shadow-sm"
                          >
                            <div className="flex items-center gap-3.5 min-w-0 flex-1">
                              {/* Match label badge */}
                              <span className="text-[10px] font-bold text-zinc-400 bg-zinc-950 border border-zinc-800 px-2 py-1 rounded-md shrink-0 font-mono w-10 text-center">
                                {m.matchLabel}
                              </span>
                              
                              {/* Players */}
                              <div className="flex items-center gap-2 text-sm min-w-0 flex-1">
                                <span className="font-medium text-zinc-200 truncate text-right flex-1">
                                  {playerName(m.player1Id)}
                                </span>
                                <span className="text-[10px] font-bold text-zinc-600 mx-1">VS</span>
                                <span className="font-medium text-zinc-200 truncate flex-1">
                                  {playerName(m.player2Id)}
                                </span>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-3 pl-3 shrink-0">
                              <div className="flex flex-col items-end gap-1">
                                {m.groupId && (
                                  <span className="hidden sm:inline text-[9px] font-medium text-zinc-500 bg-zinc-800/50 px-1.5 py-0.5 rounded uppercase tracking-wider">
                                    {groupName(m.groupId)}
                                  </span>
                                )}
                                {m.scheduledTime && (
                                  <span className="hidden sm:flex items-center gap-1 text-[10px] text-zinc-400">
                                    <Clock className="w-3 h-3" />
                                    {m.scheduledTime}
                                  </span>
                                )}
                              </div>
                              <button
                                onClick={() => handleDeleteMatch(m._id)}
                                className="text-zinc-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all p-1.5 rounded-md hover:bg-rose-500/10"
                                title="Usuń mecz"
                              >
                                <Trash className="w-4 h-4" />
                              </button>
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state for matches when groups exist but no matches */}
          {matches && matches.length === 0 && groups.length > 0 && (
            <div className="border border-dashed border-zinc-800/60 bg-zinc-900/20 rounded-2xl flex flex-col items-center justify-center py-12 text-zinc-500 gap-3 mt-6">
              <div className="p-4 bg-zinc-800/30 rounded-full">
                <SoccerBall className="w-8 h-8" />
              </div>
              <p className="text-sm font-medium text-zinc-300">Brak meczów</p>
              <p className="text-xs text-center max-w-sm">
                Kliknij „Każdy z każdym", aby automatycznie wygenerować pary na podstawie grup, lub użyj „Dodaj mecz", by stworzyć je ręcznie.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export const runtime = "edge";

