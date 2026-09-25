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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
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
        Wczytywanie...
      </div>
    );
  }

  if (!phase) {
    return (
      <div className="flex items-center gap-2 p-8 text-rose-500 text-sm">
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
          className="p-2 bg-zinc-900 hover:bg-zinc-800 rounded-xl transition-colors shrink-0"
        >
          <CaretLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Konfiguracja: {phase.name}
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Przypisz graczy do grup i wygeneruj harmonogram meczów.
          </p>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* ── LEFT: Players pool ─────────────────────────────── */}
        <div className="w-full lg:w-72 shrink-0 space-y-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-zinc-400" />
            <h2 className="text-sm font-semibold text-zinc-300">
              Pula zawodników
            </h2>
            <span className="ml-auto text-xs font-medium bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full">
              {unassignedPlayers.length}
            </span>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            {unassignedPlayers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-zinc-600 text-xs gap-2">
                <Users className="w-8 h-8" />
                <span>Wszyscy przypisani</span>
              </div>
            ) : (
              <div className="divide-y divide-zinc-800">
                {unassignedPlayers.map((p) => (
                  <motion.div
                    key={p._id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    className="flex items-center justify-between px-4 py-2.5 hover:bg-zinc-800/50 transition-colors"
                  >
                    <span className="text-sm font-medium truncate mr-2">
                      {p.name}
                    </span>
                    {groups.length > 0 && (
                      <select
                        className="text-xs bg-zinc-950 border border-zinc-700 rounded-lg px-2 py-1 text-zinc-300 shrink-0 cursor-pointer hover:border-blue-500 transition-colors focus:outline-none focus:border-blue-500"
                        defaultValue=""
                        onChange={async (e) => {
                          const gId = e.target.value;
                          if (!gId) return;
                          await handleAssignPlayer(p._id, gId);
                          e.target.value = "";
                        }}
                      >
                        <option value="" disabled>
                          → Grupa
                        </option>
                        {groups.map((g) => (
                          <option key={g._id} value={g._id}>
                            {g.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {groups.length === 0 && (
            <p className="text-xs text-zinc-600 text-center">
              Utwórz grupę po prawej, by przypisać zawodników.
            </p>
          )}
        </div>

        {/* ── RIGHT: Groups + Generator ──────────────────────── */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Toolbar: create group + generate controls */}
          <div className="flex flex-wrap items-center gap-3">
            {/* New group form */}
            <div className="flex gap-2 flex-1 min-w-[260px]">
              <Input
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateGroup()}
                placeholder="Nazwa grupy (np. Grupa A)"
                className="bg-zinc-900 border-zinc-800 h-9"
              />
              <Button
                onClick={handleCreateGroup}
                disabled={!newGroupName.trim() || !adminToken}
                variant="outline"
                className="h-9 shrink-0 border-zinc-700 hover:border-blue-500 hover:bg-blue-500/10 hover:text-blue-400"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Dodaj grupę
              </Button>
            </div>

            {/* Round-robin generator */}
            {groups.length > 0 && (
              <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5">
                <label className="text-xs text-zinc-500 whitespace-nowrap font-medium">
                  Rund:
                </label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={legs}
                  onChange={(e) => setLegs(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-14 h-7 text-center bg-zinc-950 border-zinc-700 text-sm"
                />
                <Button
                  onClick={handleGenerateRoundRobin}
                  disabled={generatingRR || !adminToken}
                  className="h-7 bg-blue-600 hover:bg-blue-500 text-white text-xs px-3"
                >
                  <Shuffle className="w-3.5 h-3.5 mr-1.5" />
                  {generatingRR ? "Generuję..." : "Generuj każdy z każdym"}
                </Button>
              </div>
            )}

            {/* Manual match button */}
            <Button
              variant="outline"
              className="h-9 border-zinc-700 text-zinc-300 hover:border-zinc-500"
              onClick={() => setManualModalOpen(true)}
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Dodaj mecz ręcznie
            </Button>

            <Dialog open={manualModalOpen} onOpenChange={setManualModalOpen}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <SoccerBall className="w-4 h-4 text-blue-400" />
                    Dodaj mecz ręcznie
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-2">
                  {/* Player 1 */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-zinc-400">Zawodnik 1</Label>
                    <select
                      value={manualForm.player1Id}
                      onChange={(e) =>
                        setManualForm((f) => ({ ...f, player1Id: e.target.value }))
                      }
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-blue-500 transition-colors"
                    >
                      <option value="">— Wybierz zawodnika —</option>
                      {allPlayers?.map((p) => (
                        <option key={p._id} value={p._id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* VS divider */}
                  <div className="flex items-center gap-3 text-zinc-600 text-xs font-bold">
                    <div className="flex-1 h-px bg-zinc-800" />
                    VS
                    <div className="flex-1 h-px bg-zinc-800" />
                  </div>

                  {/* Player 2 */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-zinc-400">Zawodnik 2</Label>
                    <select
                      value={manualForm.player2Id}
                      onChange={(e) =>
                        setManualForm((f) => ({ ...f, player2Id: e.target.value }))
                      }
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-blue-500 transition-colors"
                    >
                      <option value="">— Wybierz zawodnika —</option>
                      {allPlayers
                        ?.filter((p) => p._id !== manualForm.player1Id)
                        .map((p) => (
                          <option key={p._id} value={p._id}>
                            {p.name}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Round */}
                    <div className="space-y-1.5">
                      <Label className="text-xs text-zinc-400">Kolejka</Label>
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
                        className="bg-zinc-900 border-zinc-700 h-9"
                      />
                    </div>

                    {/* Match label */}
                    <div className="space-y-1.5">
                      <Label className="text-xs text-zinc-400">
                        Etykieta meczu
                      </Label>
                      <Input
                        value={manualForm.matchLabel}
                        onChange={(e) =>
                          setManualForm((f) => ({
                            ...f,
                            matchLabel: e.target.value,
                          }))
                        }
                        placeholder="np. Finał, M12"
                        className="bg-zinc-900 border-zinc-700 h-9"
                      />
                    </div>
                  </div>

                  {/* Scheduled time */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-zinc-400">
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
                      className="bg-zinc-900 border-zinc-700 h-9"
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setManualModalOpen(false);
                      setManualForm(EMPTY_FORM);
                    }}
                    className="border-zinc-700"
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
                    className="bg-blue-600 hover:bg-blue-500 text-white"
                  >
                    {savingManual ? "Zapisywanie..." : "Dodaj mecz"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Groups grid */}
          {groups.length === 0 ? (
            <div className="border-2 border-dashed border-zinc-800 rounded-2xl flex flex-col items-center justify-center py-16 text-zinc-600 gap-3">
              <Users className="w-10 h-10" />
              <p className="text-sm font-medium">Brak grup</p>
              <p className="text-xs">Wpisz nazwę grupy powyżej i kliknij „Dodaj grupę".</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
              <AnimatePresence>
                {groups.map((g) => (
                  <motion.div
                    key={g._id}
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden"
                  >
                    {/* Group header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-800/40">
                      <h3 className="font-semibold text-sm text-zinc-200 tracking-tight">
                        {g.name}
                      </h3>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-500 font-medium">
                          {g.playerIds.length} graczy
                        </span>
                        <button
                          onClick={() => handleRemoveGroup(g._id)}
                          className="text-zinc-600 hover:text-rose-500 transition-colors p-0.5 rounded"
                          title="Usuń grupę"
                        >
                          <Trash className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Players in group */}
                    <div className="p-2 space-y-1 min-h-[80px]">
                      {g.playerIds.length === 0 ? (
                        <div className="text-xs text-zinc-600 text-center py-5">
                          Pusta grupa — przypisz zawodników z lewej
                        </div>
                      ) : (
                        g.playerIds.map((pid) => {
                          if (!pid) return null;
                          const player = allPlayers?.find((pl) => pl._id === pid);
                          if (!player) return null;
                          return (
                            <div
                              key={pid}
                              className="flex items-center justify-between bg-zinc-800/50 hover:bg-zinc-800 rounded-lg px-3 py-1.5 group transition-colors"
                            >
                              <span className="text-xs font-medium text-zinc-300 truncate">
                                {player.name}
                              </span>
                              <button
                                onClick={() =>
                                  handleRemoveFromGroup(g._id, pid)
                                }
                                className="text-zinc-600 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all ml-2 shrink-0"
                                title="Usuń z grupy"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}

          {/* ── Matches section ──────────────────────────────── */}
          {matches && matches.length > 0 && (
            <div className="space-y-4 pt-2">
              {/* Section header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ListBullets className="w-4 h-4 text-zinc-400" />
                  <h2 className="text-sm font-semibold text-zinc-300">
                    Mecze fazy
                  </h2>
                  <span className="text-xs font-medium bg-blue-500/15 text-blue-400 px-2 py-0.5 rounded-full">
                    {matches.length} meczów
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearMatches}
                  disabled={!adminToken}
                  className="text-xs h-7 border-zinc-700 text-zinc-500 hover:text-rose-400 hover:border-rose-500/50"
                >
                  <Trash className="w-3 h-3 mr-1.5" />
                  Wyczyść wszystkie
                </Button>
              </div>

              {/* Rounds */}
              <div className="space-y-4">
                {sortedRounds.map((round) => (
                  <div key={round} className="space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 pl-1">
                      Kolejka {round}
                    </h3>
                    <div className="space-y-1.5">
                      {matchesByRound[round]?.map((m) => (
                        <motion.div
                          key={m._id}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 group hover:border-zinc-700 transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {/* Match label badge */}
                            <span className="text-[10px] font-bold text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-md shrink-0 font-mono">
                              {m.matchLabel}
                            </span>
                            {/* Players */}
                            <div className="flex items-center gap-2 text-sm min-w-0">
                              <span className="font-medium text-zinc-200 truncate">
                                {playerName(m.player1Id)}
                              </span>
                              <ArrowRight className="w-3 h-3 text-zinc-600 shrink-0" />
                              <span className="font-medium text-zinc-200 truncate">
                                {playerName(m.player2Id)}
                              </span>
                            </div>
                            {/* Group tag */}
                            {m.groupId && (
                              <span className="hidden sm:inline text-[10px] text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded shrink-0">
                                {groupName(m.groupId)}
                              </span>
                            )}
                            {/* Time tag */}
                            {m.scheduledTime && (
                              <span className="hidden sm:inline text-[10px] text-zinc-500 shrink-0">
                                {m.scheduledTime}
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => handleDeleteMatch(m._id)}
                            className="text-zinc-600 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all shrink-0 ml-2"
                            title="Usuń mecz"
                          >
                            <Trash className="w-3.5 h-3.5" />
                          </button>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state for matches when groups exist but no matches */}
          {matches && matches.length === 0 && groups.length > 0 && (
            <div className="border border-dashed border-zinc-800 rounded-2xl flex flex-col items-center justify-center py-10 text-zinc-600 gap-2">
              <SoccerBall className="w-8 h-8" />
              <p className="text-sm">Brak meczów</p>
              <p className="text-xs text-center max-w-xs">
                Kliknij „Generuj każdy z każdym" lub dodaj mecze ręcznie.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export const runtime = "edge";
