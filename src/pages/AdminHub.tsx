import React, { useState, useEffect, useMemo } from "react";
import { FullTournamentData, useQuery, useMutation, api, EnrichedMatchDoc } from "../lib/convex-client";
import { useRouter } from "../lib/router";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Switch } from "../components/ui/Switch";
import { SportWizard } from "../components/wizard/SportWizard";
import { validateMatchScore } from "../engine/scoring";
import { validateScheduleIntegrity, type ScheduledMatch } from "../engine/scheduler";
import {
  Users,
  Calendar,
  Trophy,
  Share2,
  Settings,
  Plus,
  Trash2,
  Copy,
  Check,
  AlertTriangle,
  LogOut,
  Edit2,
  Clock,
  Radio,
  ExternalLink,
  RefreshCw,
  Sparkles,
  X,
  AlertCircle,
  Flag,
} from "lucide-react";

export interface AdminHubProps {
  tournament: FullTournamentData;
  adminSecret?: string;
}

export type AdminTab = "participants" | "schedule" | "scoring" | "sharing" | "rules";

export const AdminHub: React.FC<AdminHubProps> = ({ tournament, adminSecret: initialSecret }) => {
  const { navigate } = useRouter();
  const slug = tournament.slug;

  // 1. Session Rehydration & Token Storage
  const [activeSecret, setActiveSecret] = useState<string | null>(() => {
    if (initialSecret && initialSecret.trim().length > 0) {
      return initialSecret;
    }
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage.getItem(`verso_admin_${slug}`);
    }
    return null;
  });

  // Keep localStorage updated with activeSecret
  useEffect(() => {
    if (activeSecret && typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(`verso_admin_${slug}`, activeSecret);
    }
  }, [activeSecret, slug]);

  // Auth verification — SECURITY: server-side validation via verifyAdminSecret query.
  // adminSecret is deliberately redacted from public tournament data; we verify through
  // the dedicated endpoint that checks against the hashed server-side value.
  const authResult = useQuery(
    api.tournaments.verifyAdminSecret,
    activeSecret ? { slug, adminSecret: activeSecret } : ("skip" as any)
  );
  // undefined = loading, null = skip, { isValid: boolean } = result
  const isAuthLoading = activeSecret !== null && authResult === undefined;
  const isAuthValid = Boolean(authResult?.isValid || authResult?.valid);


  const [activeTab, setActiveTab] = useState<AdminTab>("participants");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleLogout = () => {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.removeItem(`verso_admin_${slug}`);
    }
    setActiveSecret(null);
    navigate(`/${slug}`);
  };

  // Queries & Mutations
  const players = useQuery(api.players.listByTournament, {
    tournamentId: tournament._id,
    adminSecret: activeSecret || undefined,
  }) || [];

  const matches = useQuery(api.matches.listByTournament, {
    tournamentId: tournament._id,
    adminSecret: activeSecret || undefined,
  }) || [];

  const toggleCheckIn = useMutation(api.players.toggleCheckIn);
  const createPlayer = useMutation(api.players.create);
  const bulkCreatePlayers = useMutation(api.players.bulkCreate);
  const deletePlayer = useMutation(api.players.deletePlayer);
  const updateScore = useMutation(api.matches.updateScore);
  const setWalkover = useMutation(api.matches.setWalkover);
  const generateSchedule = useMutation(api.matches.generateFromSchedule);
  const updateSettings = useMutation(api.tournaments.updateSettings);

  // Modals state
  const [isAddPlayerOpen, setIsAddPlayerOpen] = useState(false);
  const [playerNameInput, setPlayerNameInput] = useState("");
  const [bulkNamesInput, setBulkNamesInput] = useState("");
  const [isBulkMode, setIsBulkMode] = useState(false);

  const [scoreModalMatch, setScoreModalMatch] = useState<EnrichedMatchDoc | null>(null);
  const [scoreSets, setScoreSets] = useState<{ s1: number; s2: number }[]>([{ s1: 0, s2: 0 }]);
  const [scoreError, setScoreError] = useState<string | null>(null);

  const [walkoverMatch, setWalkoverMatch] = useState<EnrichedMatchDoc | null>(null);
  const [walkoverWinnerId, setWalkoverWinnerId] = useState<string>("");
  const [walkoverReason, setWalkoverReason] = useState<string>("Nieobecność");

  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduleDuration, setScheduleDuration] = useState(20);
  const [scheduleRest, setScheduleRest] = useState(10);
  const [isScheduling, setIsScheduling] = useState(false);

  // Selected Day Filter for Schedule Matrix
  const [selectedDayId, setSelectedDayId] = useState<string | "all">("all");

  // 2. Schedule Conflict Detection via validateScheduleIntegrity
  const scheduleConflicts = useMemo(() => {
    if (!matches || matches.length === 0) {
      return { isValid: true, pitchOverlaps: [], playerOverlaps: [], restViolations: [] };
    }

    const scheduledMatches: ScheduledMatch[] = matches
      .filter((m: any) => m.dayId && m.pitchId && m.time)
      .map((m: any) => {
        const day = tournament.days.find((d) => d._id === m.dayId);
        const pitch = tournament.pitches.find((p) => p._id === m.pitchId);
        const dateStr = day?.date || "2026-10-02";

        const startTs =
          m.startTimestamp ||
          Date.parse(`${dateStr}T${m.time}:00Z`) ||
          Date.now();
        const endTs =
          m.endTimestamp ||
          (m.endTime ? Date.parse(`${dateStr}T${m.endTime}:00Z`) : startTs + 20 * 60 * 1000);

        return {
          matchId: m._id,
          round: m.roundNumber,
          player1Id: m.player1Id,
          player2Id: m.player2Id,
          dayId: m.dayId!,
          date: dateStr,
          pitchId: m.pitchId!,
          pitchName: pitch?.name || "Stół",
          startTime: m.time || "18:00",
          endTime: m.endTime || "18:20",
          startTimestamp: startTs,
          endTimestamp: endTs,
        };
      });

    return validateScheduleIntegrity(scheduledMatches, 10);
  }, [matches, tournament.days, tournament.pitches]);

  // Handlers
  const handleToggleCheckIn = async (playerId: string, current: boolean) => {
    if (!activeSecret) return;
    try {
      await toggleCheckIn({
        playerId,
        adminSecret: activeSecret,
        checkedIn: !current,
      });
      showToast(`Zaktualizowano status obecności zawodnika`);
    } catch (e: any) {
      showToast(`Błąd: ${e.message}`);
    }
  };

  const handleAddPlayer = async () => {
    if (!activeSecret) return;
    try {
      if (isBulkMode) {
        const names = bulkNamesInput
          .split("\n")
          .map((n) => n.trim())
          .filter((n) => n.length > 0);
        if (names.length === 0) return;
        await bulkCreatePlayers({
          tournamentId: tournament._id,
          adminSecret: activeSecret,
          names,
        });
        showToast(`Dodano ${names.length} zawodników`);
        setBulkNamesInput("");
      } else {
        if (!playerNameInput.trim()) return;
        await createPlayer({
          tournamentId: tournament._id,
          adminSecret: activeSecret,
          name: playerNameInput.trim(),
        });
        showToast(`Dodano zawodnika: ${playerNameInput}`);
        setPlayerNameInput("");
      }
      setIsAddPlayerOpen(false);
    } catch (e: any) {
      showToast(`Błąd: ${e.message}`);
    }
  };

  const handleDeletePlayer = async (playerId: string, name: string) => {
    if (!activeSecret) return;
    if (!confirm(`Czy na pewno usunąć zawodnika ${name}?`)) return;
    try {
      await deletePlayer({ playerId, adminSecret: activeSecret });
      showToast(`Usunięto zawodnika ${name}`);
    } catch (e: any) {
      showToast(`Błąd: ${e.message}`);
    }
  };

  const handleOpenScoreModal = (match: EnrichedMatchDoc) => {
    setScoreModalMatch(match);
    if (match.sets && match.sets.length > 0) {
      setScoreSets(match.sets);
    } else {
      setScoreSets([{ s1: 0, s2: 0 }]);
    }
    setScoreError(null);
  };

  const handleSaveScore = async () => {
    if (!scoreModalMatch || !activeSecret) return;
    const validation = validateMatchScore(scoreSets, tournament.sportRules);
    if (!validation.isValid) {
      setScoreError(validation.error || "Niepoprawny wynik seta");
      return;
    }
    try {
      await updateScore({
        matchId: scoreModalMatch._id,
        sets: scoreSets,
        adminSecret: activeSecret,
      });
      showToast("Zapisano wynik meczu");
      setScoreModalMatch(null);
    } catch (e: any) {
      setScoreError(e.message || "Błąd zapisu wyniku");
    }
  };

  const handleOpenWalkoverModal = (match: EnrichedMatchDoc) => {
    setWalkoverMatch(match);
    setWalkoverWinnerId(match.player1Id);
    setWalkoverReason("Nieobecność");
  };

  const handleConfirmWalkover = async () => {
    if (!walkoverMatch || !activeSecret || !walkoverWinnerId) return;
    try {
      await setWalkover({
        matchId: walkoverMatch._id,
        winnerPlayerId: walkoverWinnerId,
        adminSecret: activeSecret,
        reason: walkoverReason,
      });
      showToast("Zarejestrowano walkower");
      setWalkoverMatch(null);
    } catch (e: any) {
      showToast(`Błąd walkowera: ${e.message}`);
    }
  };

  const handleRunBergerSchedule = async () => {
    if (!activeSecret) return;
    setIsScheduling(true);
    try {
      const stage = tournament.stages?.[0];
      const group = tournament.groups?.[0];
      await generateSchedule({
        tournamentId: tournament._id,
        adminSecret: activeSecret,
        stageId: stage?._id,
        groupId: group?._id,
        autoSchedulePitchesAndTime: true,
        matchDurationMinutes: scheduleDuration,
        restIntervalMinutes: scheduleRest,
      });
      showToast("Wygenerowano terminarz Bergera z automatycznym przydziałem stołów");
      setIsScheduleModalOpen(false);
    } catch (e: any) {
      showToast(`Błąd generowania terminarza: ${e.message}`);
    } finally {
      setIsScheduling(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      showToast(`Skopiowano ${label} do schowka`);
    }
  };

  // Show loading spinner while server validates the admin token
  if (isAuthLoading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="flex items-center gap-3 text-neutral-400">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          <span className="font-mono text-sm tracking-wider">Weryfikacja uprawnień...</span>
        </div>
      </div>
    );
  }

  // If not authenticated
  if (!isAuthValid) {

    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center space-y-6 border-white/10 bg-neutral-900/60 backdrop-blur-xl">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 mx-auto flex items-center justify-center">
            <AlertCircle className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-white">Wymagana autoryzacja organizatora</h2>
            <p className="text-sm text-neutral-400">
              Aby zarządzać turniejem <span className="text-white font-medium">{tournament.name}</span>,
              musisz posiadać unikalny klucz administratora.
            </p>
          </div>

          <div className="space-y-3">
            <input
              type="password"
              placeholder="Wklej klucz adminSecret..."
              onChange={(e) => setActiveSecret(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-neutral-950 border border-white/10 text-white font-mono text-sm focus:border-emerald-500 focus:outline-none"
            />
            <Button
              variant="primary"
              className="w-full"
              onClick={() => {
                if (activeSecret) {
                  showToast("Zweryfikowano klucz admina");
                }
              }}
            >
              Zaloguj do Panelu
            </Button>
          </div>

          <div className="pt-2 border-t border-white/5">
            <Button variant="ghost" size="sm" onClick={() => navigate(`/${slug}`)}>
              Wróć do portalu widza
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "https://verso.app";
  const checkedInCount = players.filter((p: any) => p.checkedIn).length;

  return (
    <div className="w-full max-w-7xl 2xl:max-w-[1600px] 3xl:max-w-[2000px] 4xl:max-w-[2500px] mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12 py-8 space-y-8">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-neutral-900 border border-emerald-500/40 text-emerald-300 text-sm px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 backdrop-blur-xl animate-in fade-in slide-in-from-bottom-4">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header Card */}
      <div className="p-6 rounded-2xl bg-neutral-900/40 border border-white/10 backdrop-blur-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="emerald" dot size="sm">
              PANEL ORGANIZATORA (ADMIN HUB)
            </Badge>
            <span className="text-xs font-mono text-neutral-400">/{slug}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
            {tournament.name}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="glass"
            size="sm"
            onClick={() => copyToClipboard(activeSecret || "", "klucz admina")}
            className="text-xs gap-1.5"
          >
            <Copy className="w-3.5 h-3.5" />
            Kopiuj klucz
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => window.open(`/${slug}`, "_blank")}
            className="text-xs gap-1.5"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Podgląd widza
          </Button>

          <Button
            variant="danger"
            size="sm"
            onClick={handleLogout}
            className="text-xs gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            Wyloguj
          </Button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-white/10 overflow-x-auto gap-2 text-sm font-medium">
        <button
          onClick={() => setActiveTab("participants")}
          className={`pb-3 px-3 flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
            activeTab === "participants"
              ? "border-emerald-500 text-white font-bold"
              : "border-transparent text-neutral-400 hover:text-white"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Uczestnicy</span>
          <span className="px-2 py-0.5 rounded-full text-xs bg-white/[0.06] text-neutral-300">
            {players.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("schedule")}
          className={`pb-3 px-3 flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
            activeTab === "schedule"
              ? "border-emerald-500 text-white font-bold"
              : "border-transparent text-neutral-400 hover:text-white"
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Harmonogram & Stoły</span>
          {!scheduleConflicts.isValid && (
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          )}
        </button>

        <button
          onClick={() => setActiveTab("scoring")}
          className={`pb-3 px-3 flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
            activeTab === "scoring"
              ? "border-emerald-500 text-white font-bold"
              : "border-transparent text-neutral-400 hover:text-white"
          }`}
        >
          <Trophy className="w-4 h-4" />
          <span>Wyniki & Walkowery</span>
        </button>

        <button
          onClick={() => setActiveTab("sharing")}
          className={`pb-3 px-3 flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
            activeTab === "sharing"
              ? "border-emerald-500 text-white font-bold"
              : "border-transparent text-neutral-400 hover:text-white"
          }`}
        >
          <Share2 className="w-4 h-4" />
          <span>Centrum Linków</span>
        </button>

        <button
          onClick={() => setActiveTab("rules")}
          className={`pb-3 px-3 flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
            activeTab === "rules"
              ? "border-emerald-500 text-white font-bold"
              : "border-transparent text-neutral-400 hover:text-white"
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Zasady Gry</span>
        </button>
      </div>

      {/* Tab 1: Participants & Check-In Desk */}
      {activeTab === "participants" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Biurko Odprawy & Lista Zawodników
              </h2>
              <p className="text-xs text-neutral-400">
                Stan obecności: {checkedInCount} / {players.length} zameldowanych (
                {players.length > 0
                  ? Math.round((checkedInCount / players.length) * 100)
                  : 0}
                %)
              </p>
            </div>

            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsAddPlayerOpen(true)}
              className="gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Dodaj zawodnika
            </Button>
          </div>

          <Card className="overflow-hidden border border-white/10 bg-neutral-900/40">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-xs font-mono text-neutral-400 uppercase bg-white/[0.02]">
                    <th className="py-3 px-4">Slot</th>
                    <th className="py-3 px-4">Imię i nazwisko</th>
                    <th className="py-3 px-4 text-center">Status odprawy</th>
                    <th className="py-3 px-4 text-center">Link zawodnika</th>
                    <th className="py-3 px-4 text-right">Akcje</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono text-sm">
                  {players.map((p: any) => (
                    <tr key={p._id} className="hover:bg-white/[0.02]">
                      <td className="py-3 px-4 font-bold text-emerald-400">
                        #{p.groupSlotIndex ?? "-"}
                      </td>
                      <td className="py-3 px-4 font-sans font-semibold text-white">
                        {p.name}
                        {p.seed && (
                          <span className="ml-2 text-xs px-2 py-0.5 rounded bg-white/[0.08] text-neutral-400 font-mono">
                            Rozstawienie {p.seed}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleToggleCheckIn(p._id, p.checkedIn)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium cursor-pointer transition-all ${
                            p.checkedIn
                              ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 hover:bg-emerald-500/20"
                              : "bg-white/[0.04] border border-white/10 text-neutral-400 hover:bg-white/[0.08]"
                          }`}
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${
                              p.checkedIn ? "bg-emerald-400" : "bg-neutral-600"
                            }`}
                          />
                          {p.checkedIn ? "Obecny" : "Oczekuje"}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() =>
                            copyToClipboard(
                              `${origin}/${slug}/p/${p.secretCode}`,
                              `link zawodnika ${p.name}`
                            )
                          }
                          className="px-2.5 py-1 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-xs text-neutral-300 inline-flex items-center gap-1.5"
                        >
                          <Copy className="w-3 h-3" />
                          Kopiuj URL
                        </button>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleDeletePlayer(p._id, p.name)}
                          className="p-1.5 rounded-lg text-neutral-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          title="Usuń zawodnika"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {players.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-neutral-500">
                        Brak zarejestrowanych zawodników. Kliknij „Dodaj zawodnika”.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Tab 2: Schedule Matrix & Slot Editor with Rest Conflict Warnings */}
      {activeTab === "schedule" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Harmonogram & Macierz Boisk
              </h2>
              <p className="text-xs text-neutral-400">
                Łącznie meczów w turnieju: {matches.length}
              </p>
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsScheduleModalOpen(true)}
              className="gap-1.5"
            >
              <RefreshCw className="w-4 h-4" />
              Automatyczne Losowanie Berger
            </Button>
          </div>

          {/* Rest Conflict Alert Banner */}
          {!scheduleConflicts.isValid && (
            <div className="p-4 sm:p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 space-y-2 backdrop-blur-md animate-in fade-in">
              <div className="flex items-center gap-2.5 font-bold text-sm">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                <span>
                  Wykryto kolizje w harmonogramie (
                  {scheduleConflicts.restViolations.length +
                    scheduleConflicts.pitchOverlaps.length +
                    scheduleConflicts.playerOverlaps.length}
                  ):
                </span>
              </div>
              <ul className="text-xs space-y-1 list-disc list-inside text-amber-300/90 pl-1 font-mono">
                {scheduleConflicts.restViolations.map((v, i) => (
                  <li key={`rest-${i}`}>{v}</li>
                ))}
                {scheduleConflicts.pitchOverlaps.map((v, i) => (
                  <li key={`pitch-${i}`}>{v}</li>
                ))}
                {scheduleConflicts.playerOverlaps.map((v, i) => (
                  <li key={`player-${i}`}>{v}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Day Selector Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setSelectedDayId("all")}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono transition-all ${
                selectedDayId === "all"
                  ? "bg-emerald-500 text-white font-bold"
                  : "bg-white/[0.04] text-neutral-400 hover:text-white"
              }`}
            >
              Wszystkie dni ({matches.length})
            </button>
            {tournament.days.map((d: any) => {
              const dayMatches = matches.filter((m: any) => m.dayId === d._id);
              return (
                <button
                  key={d._id}
                  onClick={() => setSelectedDayId(d._id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono transition-all ${
                    selectedDayId === d._id
                      ? "bg-emerald-500 text-white font-bold"
                      : "bg-white/[0.04] text-neutral-400 hover:text-white"
                  }`}
                >
                  {d.date} ({dayMatches.length})
                </button>
              );
            })}
          </div>

          {/* Match Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {matches
              .filter((m: any) => selectedDayId === "all" || m.dayId === selectedDayId)
              .map((m: any) => {
                const pitch = tournament.pitches.find((p) => p._id === m.pitchId);
                const isConflict =
                  scheduleConflicts.restViolations.some((rv) => rv.includes(m._id)) ||
                  scheduleConflicts.pitchOverlaps.some((po) => po.includes(m._id)) ||
                  scheduleConflicts.playerOverlaps.some((po) => po.includes(m._id));

                return (
                  <Card
                    key={m._id}
                    className={`p-4 space-y-3 transition-all ${
                      isConflict
                        ? "border-amber-500/50 bg-amber-500/10 text-amber-200"
                        : "border-white/10 bg-neutral-900/40 hover:border-white/20"
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-mono text-neutral-400">
                      <span className="font-semibold text-white">Runda {m.roundNumber}</span>
                      <span>
                        {pitch?.name || "Stół"} • {m.time || "18:00"}
                      </span>
                    </div>

                    <div className="space-y-1 font-medium">
                      <div className="flex items-center justify-between">
                        <span
                          className={`truncate ${
                            m.winnerId === m.player1Id ? "text-emerald-400 font-bold" : "text-white"
                          }`}
                        >
                          {m.player1?.name || "Zawodnik 1"}
                        </span>
                        {m.sets && m.sets.length > 0 && (
                          <span className="font-mono text-xs text-neutral-300">
                            {m.sets.map((s: any) => s.s1).join("-")}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span
                          className={`truncate ${
                            m.winnerId === m.player2Id ? "text-emerald-400 font-bold" : "text-white"
                          }`}
                        >
                          {m.player2?.name || "Zawodnik 2"}
                        </span>
                        {m.sets && m.sets.length > 0 && (
                          <span className="font-mono text-xs text-neutral-300">
                            {m.sets.map((s: any) => s.s2).join("-")}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs">
                      <Badge
                        variant={
                          m.status === "completed"
                            ? "neutral"
                            : m.status === "in_progress"
                            ? "emerald"
                            : "outline"
                        }
                        size="sm"
                      >
                        {m.status === "completed"
                          ? "Zakończony"
                          : m.status === "in_progress"
                          ? "W toku"
                          : "Oczekuje"}
                      </Badge>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleOpenScoreModal(m)}
                          className="px-2 py-1 rounded bg-white/[0.05] hover:bg-white/[0.1] text-neutral-300 text-xs"
                        >
                          Wynik
                        </button>
                        <button
                          onClick={() => handleOpenWalkoverModal(m)}
                          className="px-2 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs"
                        >
                          Walkower
                        </button>
                      </div>
                    </div>
                  </Card>
                );
              })}
          </div>
        </div>
      )}

      {/* Tab 3: Scoring & Walkovers */}
      {activeTab === "scoring" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div>
            <h2 className="text-xl font-bold text-white">Rejestracja Wyników & Walkowery</h2>
            <p className="text-xs text-neutral-400">
              Szybkie wprowadzanie i weryfikacja rezultatów spotkań według reguł dyscypliny
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {matches.map((m: any) => (
              <Card key={m._id} className="p-5 space-y-4 bg-neutral-900/40">
                <div className="flex items-center justify-between">
                  <Badge variant="neutral" size="sm">
                    RUNDA {m.roundNumber} • {m.time || "18:00"}
                  </Badge>
                  <span className="text-xs font-mono text-neutral-400">
                    {m.pitch?.name || "Stół"}
                  </span>
                </div>

                <div className="flex items-center justify-between text-base font-semibold">
                  <div className="space-y-1">
                    <div className={m.winnerId === m.player1Id ? "text-emerald-400 font-bold" : ""}>
                      {m.player1?.name || "Zawodnik 1"}
                    </div>
                    <div className={m.winnerId === m.player2Id ? "text-emerald-400 font-bold" : ""}>
                      {m.player2?.name || "Zawodnik 2"}
                    </div>
                  </div>

                  <div className="text-right font-mono">
                    {m.sets && m.sets.length > 0 ? (
                      <div className="px-3 py-1.5 rounded-lg bg-black/40 text-emerald-400 font-bold text-sm">
                        {m.sets.map((s: any) => `${s.s1}:${s.s2}`).join(" ")}
                      </div>
                    ) : (
                      <span className="text-xs text-neutral-500">Brak wyniku</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/5">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleOpenScoreModal(m)}
                    className="gap-1 text-xs"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    Wprowadź wynik
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleOpenWalkoverModal(m)}
                    className="gap-1 text-xs"
                  >
                    <Flag className="w-3.5 h-3.5" />
                    Walkower
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Secret Sharing Center */}
      {activeTab === "sharing" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Share2 className="w-5 h-5 text-emerald-400" />
              Centrum Dystrybucji Linków
            </h2>
            <p className="text-xs text-neutral-400">
              Bezhasłowe, dedykowane łącza dla zawodników, sędziów i kibiców
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Public Spectator */}
            <Card className="p-5 space-y-3 bg-neutral-900/40">
              <div className="flex items-center justify-between">
                <Badge variant="cyan" size="sm">
                  PORTAL WIDZA
                </Badge>
                <span className="text-xs text-neutral-400">Dla każdego</span>
              </div>
              <h3 className="font-bold text-white">Publiczny Portal Kibica</h3>
              <p className="text-xs text-neutral-400">
                Podgląd harmonogramu, tabeli na żywo i drabinki bez uprawnień edycyjnych.
              </p>
              <div className="flex items-center gap-2 pt-2">
                <input
                  readOnly
                  value={`${origin}/${slug}`}
                  className="flex-1 px-3 py-1.5 rounded-lg bg-neutral-950 border border-white/10 text-xs font-mono text-neutral-300 truncate"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => copyToClipboard(`${origin}/${slug}`, "link widza")}
                >
                  <Copy className="w-3.5 h-3.5" />
                </Button>
              </div>
            </Card>

            {/* Referee Terminal */}
            <Card className="p-5 space-y-3 bg-neutral-900/40">
              <div className="flex items-center justify-between">
                <Badge variant="amber" size="sm">
                  TERMINAL SĘDZIEGO
                </Badge>
                <span className="text-xs text-neutral-400">Przy stole</span>
              </div>
              <h3 className="font-bold text-white">Terminal Sędziowski</h3>
              <p className="text-xs text-neutral-400">
                Dotykowy scorekeeper z dużymi przyciskami +1/-1 i 15-sekundowym cofaniem.
              </p>
              <div className="flex items-center gap-2 pt-2">
                <input
                  readOnly
                  value={`${origin}/${slug}/referee/${tournament.refereeSecret || activeSecret}`}
                  className="flex-1 px-3 py-1.5 rounded-lg bg-neutral-950 border border-white/10 text-xs font-mono text-neutral-300 truncate"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    copyToClipboard(
                      `${origin}/${slug}/referee/${tournament.refereeSecret || activeSecret}`,
                      "link sędziego"
                    )
                  }
                >
                  <Copy className="w-3.5 h-3.5" />
                </Button>
              </div>
            </Card>

            {/* Venue Presenter Kiosk */}
            <Card className="p-5 space-y-3 bg-neutral-900/40">
              <div className="flex items-center justify-between">
                <Badge variant="emerald" size="sm">
                  KIOSK TV
                </Badge>
                <span className="text-xs text-neutral-400">Prezentacja</span>
              </div>
              <h3 className="font-bold text-white">Prezenter TV na Hali</h3>
              <p className="text-xs text-neutral-400">
                Automatycznie obracający się slajder wyników dla ekranów i telewizorów.
              </p>
              <div className="flex items-center gap-2 pt-2">
                <input
                  readOnly
                  value={`${origin}/${slug}/present`}
                  className="flex-1 px-3 py-1.5 rounded-lg bg-neutral-950 border border-white/10 text-xs font-mono text-neutral-300 truncate"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => copyToClipboard(`${origin}/${slug}/present`, "link TV")}
                >
                  <Copy className="w-3.5 h-3.5" />
                </Button>
              </div>
            </Card>

            {/* Admin Hub Bookmark */}
            <Card className="p-5 space-y-3 bg-neutral-900/40">
              <div className="flex items-center justify-between">
                <Badge variant="rose" size="sm">
                  KLUCZ ORGANIZATORA
                </Badge>
                <span className="text-xs text-rose-400 font-bold">Poufne</span>
              </div>
              <h3 className="font-bold text-white">Bezpośredni Link Admina</h3>
              <p className="text-xs text-neutral-400">
                Zapisz ten link w zakładkach, aby natychmiast wracać do edycji turnieju.
              </p>
              <div className="flex items-center gap-2 pt-2">
                <input
                  readOnly
                  value={`${origin}/${slug}/admin/${activeSecret}`}
                  className="flex-1 px-3 py-1.5 rounded-lg bg-neutral-950 border border-white/10 text-xs font-mono text-neutral-300 truncate"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    copyToClipboard(`${origin}/${slug}/admin/${activeSecret}`, "link admina")
                  }
                >
                  <Copy className="w-3.5 h-3.5" />
                </Button>
              </div>
            </Card>
          </div>

          {/* Player Personal Links List */}
          <Card className="p-6 space-y-4 bg-neutral-900/40">
            <h3 className="font-bold text-white text-base">
              Indywidualne Terminale Zawodników ({players.length})
            </h3>
            <p className="text-xs text-neutral-400">
              Każdy gracz posiada unikalny adres z własnym terminarzem i licznikiem do meczu.
            </p>

            <div className="divide-y divide-white/5 font-mono text-xs">
              {players.map((p: any) => (
                <div key={p._id} className="py-2.5 flex items-center justify-between gap-4">
                  <div className="font-sans font-semibold text-white">
                    #{p.groupSlotIndex ?? "-"} {p.name}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-neutral-500 hidden sm:inline">
                      /p/{p.secretCode}
                    </span>
                    <Button
                      variant="glass"
                      size="sm"
                      onClick={() =>
                        copyToClipboard(
                          `${origin}/${slug}/p/${p.secretCode}`,
                          `link dla ${p.name}`
                        )
                      }
                      className="text-xs"
                    >
                      <Copy className="w-3 h-3 mr-1" />
                      Kopiuj
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Tab 5: Rules Editor */}
      {activeTab === "rules" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="p-6 rounded-2xl bg-neutral-900/40 border border-white/10 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div>
                <h2 className="text-xl font-bold text-white">Zasady Punktacji i Reguły Gry</h2>
                <p className="text-xs text-neutral-400">
                  Edycja reguł turnieju przy użyciu modułu SportWizard
                </p>
              </div>

              {/* Allow Player Score Submission Toggle */}
              <div className="flex items-center gap-3">
                <span className="text-xs text-neutral-300">
                  Zezwalaj zawodnikom na wprowadzanie wyników:
                </span>
                <Switch
                  checked={tournament.allowPlayerScoreSubmission}
                  onCheckedChange={async (checked) => {
                    if (!activeSecret) return;
                    await updateSettings({
                      tournamentId: tournament._id,
                      adminSecret: activeSecret,
                      allowPlayerScoreSubmission: checked,
                    });
                    showToast(
                      checked
                        ? "Włączono wprowadzanie wyników przez graczy"
                        : "Zablokowano wprowadzanie wyników przez graczy"
                    );
                  }}
                />
              </div>
            </div>

            <SportWizard
              mode="edit"
              tournamentName={tournament.name}
              initialState={{
                preset: tournament.sportRules.preset,
                singularUnit: tournament.sportRules.singularUnit,
                pluralUnit: tournament.sportRules.pluralUnit,
                targetPointsPerUnit: tournament.sportRules.targetPointsPerUnit,
                unitsToWinMatch: tournament.sportRules.unitsToWinMatch,
                hasDeciderTiebreak: tournament.sportRules.hasDeciderTiebreak,
                deciderThreshold: tournament.sportRules.deciderThreshold,
                deciderPoints: tournament.sportRules.deciderPoints,
                winByTwo: tournament.sportRules.winByTwo,
              }}
              onSave={async (state) => {
                if (!activeSecret) return;
                await updateSettings({
                  tournamentId: tournament._id,
                  adminSecret: activeSecret,
                  sportRules: {
                    singularUnit: state.singularUnit,
                    pluralUnit: state.pluralUnit,
                    targetPointsPerUnit: state.targetPointsPerUnit,
                    unitsToWinMatch: state.unitsToWinMatch,
                    hasDeciderTiebreak: state.hasDeciderTiebreak,
                    deciderThreshold: state.deciderThreshold,
                    deciderPoints: state.deciderPoints,
                    winByTwo: state.winByTwo,
                  },
                });
                showToast("Zaktualizowano reguły dyscypliny");
              }}
            />
          </div>
        </div>
      )}

      {/* MODAL: Add Player */}
      {isAddPlayerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <Card className="max-w-md w-full p-6 space-y-4 bg-neutral-900 border-white/10 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h3 className="font-bold text-white text-base">Dodaj Zawodnika</h3>
              <button
                onClick={() => setIsAddPlayerOpen(false)}
                className="text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-4 text-xs">
              <button
                onClick={() => setIsBulkMode(false)}
                className={`pb-1 border-b-2 ${
                  !isBulkMode ? "border-emerald-500 text-white font-bold" : "text-neutral-400"
                }`}
              >
                Pojedynczy gracz
              </button>
              <button
                onClick={() => setIsBulkMode(true)}
                className={`pb-1 border-b-2 ${
                  isBulkMode ? "border-emerald-500 text-white font-bold" : "text-neutral-400"
                }`}
              >
                Dodaj wielu (wklej listę)
              </button>
            </div>

            {!isBulkMode ? (
              <div className="space-y-2">
                <label className="text-xs text-neutral-400">Imię i nazwisko</label>
                <input
                  type="text"
                  placeholder="np. Jan Kowalski"
                  value={playerNameInput}
                  onChange={(e) => setPlayerNameInput(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-neutral-950 border border-white/10 text-white text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-xs text-neutral-400">
                  Lista uczestników (jeden wiersz = jeden zawodnik)
                </label>
                <textarea
                  rows={5}
                  placeholder="Jan Kowalski&#10;Anna Nowak&#10;Piotr Wiśniewski"
                  value={bulkNamesInput}
                  onChange={(e) => setBulkNamesInput(e.target.value)}
                  className="w-full p-3 rounded-xl bg-neutral-950 border border-white/10 text-white text-xs font-mono focus:border-emerald-500 focus:outline-none"
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsAddPlayerOpen(false)}
              >
                Anuluj
              </Button>
              <Button variant="primary" size="sm" onClick={handleAddPlayer}>
                Dodaj
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* MODAL: Score Override */}
      {scoreModalMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <Card className="max-w-md w-full p-6 space-y-5 bg-neutral-900 border-white/10 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h3 className="font-bold text-white text-base">Wprowadź Wynik Meczu</h3>
              <button
                onClick={() => setScoreModalMatch(null)}
                className="text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-between text-sm font-semibold text-white">
              <span>{scoreModalMatch.player1?.name || "Zawodnik 1"}</span>
              <span className="text-neutral-500">vs</span>
              <span>{scoreModalMatch.player2?.name || "Zawodnik 2"}</span>
            </div>

            <div className="space-y-3">
              {scoreSets.map((s, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-xl bg-neutral-950 border border-white/10"
                >
                  <span className="text-xs font-mono text-neutral-400">Set {idx + 1}</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      value={s.s1}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        setScoreSets((prev) => {
                          const next = [...prev];
                          next[idx] = { ...next[idx], s1: val };
                          return next;
                        });
                      }}
                      className="w-14 h-9 text-center font-mono font-bold rounded-lg bg-neutral-900 border border-white/15 text-white"
                    />
                    <span className="text-neutral-500 font-bold">:</span>
                    <input
                      type="number"
                      min={0}
                      value={s.s2}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        setScoreSets((prev) => {
                          const next = [...prev];
                          next[idx] = { ...next[idx], s2: val };
                          return next;
                        });
                      }}
                      className="w-14 h-9 text-center font-mono font-bold rounded-lg bg-neutral-900 border border-white/15 text-white"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between text-xs">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setScoreSets((prev) => [...prev, { s1: 0, s2: 0 }])}
              >
                + Dodaj set
              </Button>
              {scoreSets.length > 1 && (
                <button
                  onClick={() => setScoreSets((prev) => prev.slice(0, -1))}
                  className="text-neutral-400 hover:text-rose-400"
                >
                  Usuń set
                </button>
              )}
            </div>

            {scoreError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                {scoreError}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setScoreModalMatch(null)}
              >
                Anuluj
              </Button>
              <Button variant="primary" size="sm" onClick={handleSaveScore}>
                Zapisz Wynik
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* MODAL: Walkover Confirmation */}
      {walkoverMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <Card className="max-w-md w-full p-6 space-y-5 bg-neutral-900 border-white/10 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h3 className="font-bold text-white text-base">Zarejestruj Walkower</h3>
              <button
                onClick={() => setWalkoverMatch(null)}
                className="text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <label className="text-xs text-neutral-400 font-medium">
                Wybierz zwycięzcę przez walkower:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setWalkoverWinnerId(walkoverMatch.player1Id)}
                  className={`p-3 rounded-xl border text-sm font-semibold transition-all ${
                    walkoverWinnerId === walkoverMatch.player1Id
                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-300"
                      : "border-white/10 bg-neutral-950 text-neutral-300"
                  }`}
                >
                  {walkoverMatch.player1?.name || "Zawodnik 1"}
                </button>
                <button
                  type="button"
                  onClick={() => setWalkoverWinnerId(walkoverMatch.player2Id)}
                  className={`p-3 rounded-xl border text-sm font-semibold transition-all ${
                    walkoverWinnerId === walkoverMatch.player2Id
                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-300"
                      : "border-white/10 bg-neutral-950 text-neutral-300"
                  }`}
                >
                  {walkoverMatch.player2?.name || "Zawodnik 2"}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-neutral-400 font-medium">Powód walkowera:</label>
              <div className="flex flex-wrap gap-2">
                {["Nieobecność", "Spóźnienie > 15 min", "Kontuzja", "Inny"].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setWalkoverReason(r)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      walkoverReason === r
                        ? "bg-rose-500 text-white"
                        : "bg-white/[0.05] text-neutral-400 hover:text-white"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setWalkoverMatch(null)}
              >
                Anuluj
              </Button>
              <Button variant="danger" size="sm" onClick={handleConfirmWalkover}>
                Zatwierdź Walkower
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* MODAL: Automatic Berger Scheduler */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <Card className="max-w-md w-full p-6 space-y-5 bg-neutral-900 border-white/10 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h3 className="font-bold text-white text-base">Automatyczne Losowanie Berger</h3>
              <button
                onClick={() => setIsScheduleModalOpen(false)}
                className="text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-neutral-400 leading-relaxed">
              Algorytm Bergera wygeneruje pełną siatkę każdy-z-każdym z optymalnym przydziałem
              stołów i przerw wypoczynkowych dla zawodników.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-neutral-400 block mb-1">
                  Szacowany czas trwania meczu (minuty):
                </label>
                <input
                  type="number"
                  min={5}
                  max={120}
                  value={scheduleDuration}
                  onChange={(e) => setScheduleDuration(parseInt(e.target.value) || 20)}
                  className="w-full px-3.5 py-2 rounded-xl bg-neutral-950 border border-white/10 text-white font-mono text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-neutral-400 block mb-1">
                  Minimalna przerwa między meczami zawodnika (minuty):
                </label>
                <input
                  type="number"
                  min={0}
                  max={60}
                  value={scheduleRest}
                  onChange={(e) => setScheduleRest(parseInt(e.target.value) || 10)}
                  className="w-full px-3.5 py-2 rounded-xl bg-neutral-950 border border-white/10 text-white font-mono text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsScheduleModalOpen(false)}
              >
                Anuluj
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleRunBergerSchedule}
                isLoading={isScheduling}
              >
                Generuj Terminarz
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
