import React, { useState, useMemo } from "react";
import { FullTournamentData, useQuery, api, EnrichedMatchDoc, EnrichedStanding } from "../lib/convex-client";
import { calculateStandings } from "../engine/standings";
import { generateKnockoutBracket, KnockoutMatch } from "../engine/knockout";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Tooltip } from "../components/ui/Tooltip";
import {
  Calendar,
  Trophy,
  GitFork,
  Users,
  Search,
  Info,
  CheckCircle2,
  Medal,
  Clock,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Coffee,
} from "lucide-react";

export interface SpectatorPortalProps {
  tournament: FullTournamentData;
}

export type SpectatorTab = "schedule" | "standings" | "bracket" | "participants";

export const SpectatorPortal: React.FC<SpectatorPortalProps> = ({ tournament }) => {
  const [activeTab, setActiveTab] = useState<SpectatorTab>("schedule");

  // Query all players and matches
  const players = useQuery(api.players.listByTournament, {
    tournamentId: tournament._id,
  }) || [];

  const matches: EnrichedMatchDoc[] = useQuery(api.matches.listByTournament, {
    tournamentId: tournament._id,
  }) || [];

  // Standings calculation
  const calculatedStandings: EnrichedStanding[] = useMemo(() => {
    if (!players || players.length === 0) return [];

    const playerIds = players.map((p: any) => p._id);
    const matchInputs = matches.map((m: any) => ({
      player1Id: m.player1Id,
      player2Id: m.player2Id,
      status: m.status,
      sets: m.sets || [],
    }));

    const rawStandings = calculateStandings(
      playerIds,
      matchInputs,
      tournament.sportRules?.pointsRule || "2_1_matrix"
    );

    const playerMap = new Map<string, any>(players.map((p: any) => [p._id, p]));

    return rawStandings.map((s) => {
      const p = playerMap.get(s.playerId);
      return {
        ...s,
        player: p,
        name: p?.name || s.playerId,
        groupSlotIndex: p?.groupSlotIndex,
        checkedIn: p?.checkedIn,
      };
    });
  }, [players, matches, tournament.sportRules]);

  // Schedule View Filters
  const [selectedDayId, setSelectedDayId] = useState<string>("all");
  const [selectedPitchId, setSelectedPitchId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredMatches = useMemo(() => {
    return matches.filter((m) => {
      if (selectedDayId !== "all" && m.dayId !== selectedDayId) return false;
      if (selectedPitchId !== "all" && m.pitchId !== selectedPitchId) return false;
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase();
        const p1Name = m.player1?.name?.toLowerCase() || "";
        const p2Name = m.player2?.name?.toLowerCase() || "";
        return p1Name.includes(q) || p2Name.includes(q);
      }
      return true;
    });
  }, [matches, selectedDayId, selectedPitchId, searchQuery]);

  // Live in-progress matches
  const liveMatches = matches.filter((m) => m.status === "in_progress");

  // Knockout Bracket Projection:
  // If tournament has existing knockout stage matches in database, use them.
  // Otherwise, if top 4 qualifiers exist, project the bracket from standings!
  const bracketMatches: (KnockoutMatch & {
    p1Name?: string;
    p2Name?: string;
    scoreStr?: string;
    completed?: boolean;
    winnerNum?: 1 | 2;
  })[] = useMemo(() => {
    const knockoutStage = tournament.stages?.find((s) => s.type === "knockout");
    const dbKnockoutMatches = matches.filter((m) => m.stageId === knockoutStage?._id);

    if (dbKnockoutMatches.length > 0) {
      return dbKnockoutMatches.map((m) => {
        const isCompleted = m.status === "completed";
        const winnerNum = isCompleted
          ? m.winnerId === m.player1Id
            ? 1
            : 2
          : undefined;

        const scoreStr =
          m.sets && m.sets.length > 0
            ? m.sets.map((s) => `${s.s1}:${s.s2}`).join(", ")
            : undefined;

        return {
          id: m._id,
          roundName: (m.bracketRound || "semifinals") as any,
          slot1: {
            slotId: "s1",
            sourceType: "group_rank",
            sourceRef: m.slot1Source?.sourceRef || "Awans",
            playerId: m.player1Id,
          },
          slot2: {
            slotId: "s2",
            sourceType: "group_rank",
            sourceRef: m.slot2Source?.sourceRef || "Awans",
            playerId: m.player2Id,
          },
          winnerPlayerId: m.winnerId,
          p1Name: m.player1?.name || "Oczekuje",
          p2Name: m.player2?.name || "Oczekuje",
          scoreStr,
          completed: isCompleted,
          winnerNum,
        };
      });
    }

    // Projected Bracket (Top 4 Qualifiers)
    const baseBracket = generateKnockoutBracket(4, true);
    const top4 = calculatedStandings.slice(0, 4);

    return baseBracket.map((km) => {
      let p1Name = km.slot1.sourceRef;
      let p2Name = km.slot2.sourceRef;

      if (km.id === "sf-1") {
        p1Name = top4[0]?.name ? `1. ${top4[0].name}` : "1. Grupa A";
        p2Name = top4[3]?.name ? `4. ${top4[3].name}` : "4. Grupa A";
      } else if (km.id === "sf-2") {
        p1Name = top4[1]?.name ? `2. ${top4[1].name}` : "2. Grupa A";
        p2Name = top4[2]?.name ? `3. ${top4[2].name}` : "3. Grupa A";
      } else if (km.id === "final") {
        p1Name = "Zwycięzca Półfinału 1";
        p2Name = "Zwycięzca Półfinału 2";
      } else if (km.id === "third-place") {
        p1Name = "Przegrany Półfinału 1";
        p2Name = "Przegrany Półfinału 2";
      }

      return {
        ...km,
        p1Name,
        p2Name,
      };
    });
  }, [tournament.stages, matches, calculatedStandings]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Hero Header Card */}
      <div className="p-6 sm:p-8 rounded-3xl bg-neutral-900/40 border border-white/10 backdrop-blur-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="cyan" size="sm">
              PUBLICZNY PORTAL TURNIEJU
            </Badge>
            <span className="text-xs font-mono text-neutral-400">/{tournament.slug}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mt-1.5">
            {tournament.name}
          </h1>
          <p className="text-xs sm:text-sm text-neutral-400 mt-1 max-w-xl">
            Oficjalny portal dla kibiców i uczestników. Wyniki na żywo, harmonogram meczów,
            aktualna tabela oraz drabinka fazy pucharowej.
          </p>
        </div>

        {/* Live indicator chip if matches in progress */}
        {liveMatches.length > 0 && (
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
            <Badge variant="emerald" dot pulse size="sm">
              NA ŻYWO ({liveMatches.length})
            </Badge>
            <span className="text-xs font-mono font-medium">Trwają mecze na hali</span>
          </div>
        )}
      </div>

      {/* Main Tab Navigation */}
      <div className="flex border-b border-white/10 overflow-x-auto gap-2 text-sm font-medium">
        <button
          onClick={() => setActiveTab("schedule")}
          className={`pb-3.5 px-4 flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
            activeTab === "schedule"
              ? "border-emerald-500 text-white font-bold"
              : "border-transparent text-neutral-400 hover:text-white"
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Harmonogram</span>
          <span className="px-2 py-0.5 rounded-full text-xs bg-white/[0.06] text-neutral-300">
            {matches.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("standings")}
          className={`pb-3.5 px-4 flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
            activeTab === "standings"
              ? "border-emerald-500 text-white font-bold"
              : "border-transparent text-neutral-400 hover:text-white"
          }`}
        >
          <Trophy className="w-4 h-4" />
          <span>Tabela / Wyniki</span>
        </button>

        <button
          onClick={() => setActiveTab("bracket")}
          className={`pb-3.5 px-4 flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
            activeTab === "bracket"
              ? "border-emerald-500 text-white font-bold"
              : "border-transparent text-neutral-400 hover:text-white"
          }`}
        >
          <GitFork className="w-4 h-4" />
          <span>Drabinka Pucharowa</span>
        </button>

        <button
          onClick={() => setActiveTab("participants")}
          className={`pb-3.5 px-4 flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
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
      </div>

      {/* TAB 1: SCHEDULE VIEW */}
      {activeTab === "schedule" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Filter Bar */}
          <div className="p-4 rounded-2xl bg-neutral-900/40 border border-white/10 backdrop-blur-xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              {/* Day filter */}
              <button
                onClick={() => setSelectedDayId("all")}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono transition-all ${
                  selectedDayId === "all"
                    ? "bg-emerald-500 text-white font-bold"
                    : "bg-white/[0.04] text-neutral-400 hover:text-white"
                }`}
              >
                Wszystkie dni
              </button>
              {tournament.days?.map((d) => (
                <button
                  key={d._id}
                  onClick={() => setSelectedDayId(d._id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono transition-all ${
                    selectedDayId === d._id
                      ? "bg-emerald-500 text-white font-bold"
                      : "bg-white/[0.04] text-neutral-400 hover:text-white"
                  }`}
                >
                  {d.date}
                </button>
              ))}

              <span className="text-neutral-600 hidden sm:inline">|</span>

              {/* Pitch filter */}
              <button
                onClick={() => setSelectedPitchId("all")}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono transition-all ${
                  selectedPitchId === "all"
                    ? "bg-emerald-500 text-white font-bold"
                    : "bg-white/[0.04] text-neutral-400 hover:text-white"
                }`}
              >
                Wszystkie stoły
              </button>
              {tournament.pitches?.map((p) => (
                <button
                  key={p._id}
                  onClick={() => setSelectedPitchId(p._id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono transition-all ${
                    selectedPitchId === p._id
                      ? "bg-emerald-500 text-white font-bold"
                      : "bg-white/[0.04] text-neutral-400 hover:text-white"
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative min-w-[220px]">
              <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Szukaj zawodnika..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3.5 py-1.5 rounded-xl bg-neutral-950 border border-white/10 text-xs text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Match Cards List */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMatches.map((m) => {
              const isLive = m.status === "in_progress";
              const isCompleted = m.status === "completed";

              return (
                <Card
                  key={m._id}
                  className={`p-5 space-y-3.5 transition-all duration-200 ${
                    isLive
                      ? "border-emerald-500/40 bg-emerald-500/[0.04] ring-1 ring-emerald-500/20 shadow-lg shadow-emerald-950/20"
                      : "border-white/10 bg-neutral-900/40 hover:border-white/20"
                  }`}
                >
                  {/* Card Header */}
                  <div className="flex items-center justify-between text-xs font-mono text-neutral-400">
                    <span className="font-semibold text-white">Runda {m.roundNumber}</span>
                    <div className="flex items-center gap-2">
                      <span>{m.pitch?.name || "Stół"}</span>
                      <span>•</span>
                      <span>{m.time || "18:00"}</span>
                    </div>
                  </div>

                  {/* Players & Scores */}
                  <div className="space-y-2 py-1">
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-sm font-semibold truncate ${
                          m.winnerId === m.player1Id ? "text-emerald-400 font-bold" : "text-white"
                        }`}
                      >
                        {m.player1?.name || "Zawodnik 1"}
                      </span>
                      {m.sets && m.sets.length > 0 && (
                        <span className="font-mono text-xs font-bold text-neutral-300">
                          {m.sets.map((s) => s.s1).join(" ")}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <span
                        className={`text-sm font-semibold truncate ${
                          m.winnerId === m.player2Id ? "text-emerald-400 font-bold" : "text-white"
                        }`}
                      >
                        {m.player2?.name || "Zawodnik 2"}
                      </span>
                      {m.sets && m.sets.length > 0 && (
                        <span className="font-mono text-xs font-bold text-neutral-300">
                          {m.sets.map((s) => s.s2).join(" ")}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Status Footer */}
                  <div className="flex items-center justify-between pt-2.5 border-t border-white/5 text-xs">
                    {isLive ? (
                      <Badge variant="emerald" dot pulse size="sm">
                        NA ŻYWO
                      </Badge>
                    ) : isCompleted ? (
                      <Badge variant="neutral" size="sm">
                        Zakończony
                      </Badge>
                    ) : (
                      <Badge variant="outline" size="sm">
                        Zaplanowany
                      </Badge>
                    )}

                    {m.sets && m.sets.length > 0 && (
                      <span className="text-[11px] font-mono text-neutral-500">
                        ({m.sets.map((s) => `${s.s1}:${s.s2}`).join(", ")})
                      </span>
                    )}
                  </div>
                </Card>
              );
            })}

            {filteredMatches.length === 0 && (
              <div className="col-span-full py-12 text-center text-neutral-500 text-sm">
                Brak meczów spełniających wybrane kryteria filtrów.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: STANDINGS TABLE & RECURSIVE TIEBREAKER TOOLTIPS */}
      {activeTab === "standings" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-400" />
                Klasyfikacja Fazy Grupowej
              </h2>
              <p className="text-xs text-neutral-400">
                Pozycje 1–4 kwalifikują się do półfinałów drabinki pucharowej
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono text-neutral-400">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/20 border border-emerald-500/40 inline-block" />
              <span>Awans (Playoff)</span>
            </div>
          </div>

          <Card className="overflow-hidden border border-white/10 bg-neutral-900/40">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-xs font-mono text-neutral-400 uppercase bg-white/[0.02]">
                    <th className="py-3.5 px-4 w-12 text-center">#</th>
                    <th className="py-3.5 px-4">Zawodnik</th>
                    <th className="py-3.5 px-4 text-center">M</th>
                    <th className="py-3.5 px-4 text-center">W</th>
                    <th className="py-3.5 px-4 text-center">P</th>
                    <th className="py-3.5 px-4 text-center">Sety</th>
                    <th className="py-3.5 px-4 text-center">Punkty</th>
                    <th className="py-3.5 px-4 text-right font-bold text-white">PKT</th>
                    <th className="py-3.5 px-4 text-center w-14">Tiebreaker</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono text-sm">
                  {calculatedStandings.map((s, idx) => {
                    const isPlayoffSpot = idx < 4;
                    // Check if tied with someone else on points
                    const isTied = calculatedStandings.some(
                      (other) => other.playerId !== s.playerId && other.points === s.points
                    );

                    return (
                      <tr
                        key={s.playerId}
                        className={`hover:bg-white/[0.02] transition-colors ${
                          isPlayoffSpot ? "bg-emerald-500/[0.02]" : ""
                        }`}
                      >
                        <td className="py-3.5 px-4 text-center">
                          {isPlayoffSpot ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20 text-xs">
                              {s.rank}
                            </span>
                          ) : (
                            <span className="text-neutral-500">{s.rank}</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 font-sans font-semibold text-white">
                          <div className="flex items-center gap-2">
                            <span>{s.name}</span>
                            {s.player?.seed && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.08] text-neutral-400 font-mono">
                                #{s.player.seed}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-center text-neutral-300">{s.played}</td>
                        <td className="py-3.5 px-4 text-center text-emerald-400 font-bold">
                          {s.won}
                        </td>
                        <td className="py-3.5 px-4 text-center text-rose-400">{s.lost}</td>
                        <td className="py-3.5 px-4 text-center text-neutral-300">
                          {s.setsWon}:{s.setsLost}
                          <span className="text-neutral-500 text-xs ml-1">
                            ({s.setDifference >= 0 ? `+${s.setDifference}` : s.setDifference})
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center text-neutral-300">
                          {s.pointsWon}:{s.pointsLost}
                          <span className="text-neutral-500 text-xs ml-1">
                            ({s.pointDifference >= 0 ? `+${s.pointDifference}` : s.pointDifference})
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-extrabold text-white text-base">
                          {s.points}
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          {isTied ? (
                            <Tooltip
                              content={
                                <div className="space-y-2 p-2 max-w-xs text-left">
                                  <div className="font-bold text-xs text-amber-300 flex items-center gap-1.5">
                                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                                    <span>Rozstrzygnięcie remisu</span>
                                  </div>
                                  <div className="text-[11px] text-neutral-300 space-y-1">
                                    <p className="font-medium text-white">
                                      {s.tiebreakerExplanation ||
                                        "Pozycja ustalona na podstawie bezpośrednich meczów / różnicy setów."}
                                    </p>
                                    <div className="pt-1.5 border-t border-white/10 text-[10px] text-neutral-400">
                                      Hierarchia reguł:
                                      <br />1. Punkty ogólne
                                      <br />2. Bezpośredni bilans (H2H)
                                      <br />3. Wygrane mecze
                                      <br />4. Różnica setów
                                      <br />5. Różnica małych punktów
                                    </div>
                                  </div>
                                </div>
                              }
                              side="left"
                            >
                              <button className="p-1 rounded-lg text-amber-400 hover:bg-amber-500/10 cursor-help transition-colors">
                                <Info className="w-4 h-4" />
                              </button>
                            </Tooltip>
                          ) : (
                            <span className="text-neutral-600 text-xs">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 3: INTERACTIVE KNOCKOUT BRACKET */}
      {activeTab === "bracket" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <GitFork className="w-5 h-5 text-emerald-400" />
              Drabinka Fazy Pucharowej
            </h2>
            <p className="text-xs text-neutral-400">
              Drabinka pojedynczej eliminacji z meczem o 3. miejsce
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
            {/* Round 1: Semifinals */}
            <div className="space-y-6">
              <div className="flex items-center gap-2 pb-2 border-b border-white/10">
                <Badge variant="neutral" size="sm">
                  PÓŁFINAŁY (SF)
                </Badge>
                <span className="text-xs text-neutral-400 font-mono">2 mecze</span>
              </div>

              <div className="space-y-4">
                {bracketMatches
                  .filter((m) => m.roundName === "semifinals" || m.id.startsWith("sf"))
                  .map((m) => (
                    <Card
                      key={m.id}
                      className="p-4 bg-neutral-900/60 border border-white/10 space-y-3"
                    >
                      <div className="text-[10px] uppercase font-mono tracking-wider text-neutral-500">
                        {m.id === "sf-1" ? "Półfinał 1" : "Półfinał 2"}
                      </div>

                      <div className="space-y-2">
                        <div
                          className={`flex items-center justify-between p-2 rounded-lg text-sm font-semibold ${
                            m.winnerNum === 1
                              ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30"
                              : "text-white"
                          }`}
                        >
                          <span className="truncate">{m.p1Name}</span>
                          {m.winnerNum === 1 && <Trophy className="w-3.5 h-3.5 text-emerald-400" />}
                        </div>

                        <div
                          className={`flex items-center justify-between p-2 rounded-lg text-sm font-semibold ${
                            m.winnerNum === 2
                              ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30"
                              : "text-white"
                          }`}
                        >
                          <span className="truncate">{m.p2Name}</span>
                          {m.winnerNum === 2 && <Trophy className="w-3.5 h-3.5 text-emerald-400" />}
                        </div>
                      </div>

                      {m.scoreStr && (
                        <div className="text-right text-xs font-mono text-neutral-400 pt-1">
                          Wynik: {m.scoreStr}
                        </div>
                      )}
                    </Card>
                  ))}
              </div>
            </div>

            {/* Round 2: Final & 3rd Place Match */}
            <div className="space-y-6">
              {/* Final */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-white/10">
                  <Badge variant="emerald" size="sm">
                    WIELKI FINAŁ
                  </Badge>
                  <span className="text-xs text-neutral-400 font-mono">Mecz o 1. miejsce</span>
                </div>

                {bracketMatches
                  .filter((m) => m.roundName === "final" || m.id === "final")
                  .map((m) => (
                    <Card
                      key={m.id}
                      className="p-5 bg-gradient-to-b from-neutral-900/80 to-neutral-950 border border-amber-500/30 space-y-4 shadow-xl"
                    >
                      <div className="text-xs uppercase font-mono tracking-wider text-amber-400 flex items-center gap-1.5 font-bold">
                        <Medal className="w-4 h-4" />
                        <span>Mecz o Złoty Medal</span>
                      </div>

                      <div className="space-y-2">
                        <div
                          className={`flex items-center justify-between p-2.5 rounded-xl text-sm font-bold ${
                            m.winnerNum === 1
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                              : "text-white"
                          }`}
                        >
                          <span className="truncate">{m.p1Name}</span>
                          {m.winnerNum === 1 && (
                            <Badge variant="emerald" size="sm">
                              ZWYCIĘZCA
                            </Badge>
                          )}
                        </div>

                        <div
                          className={`flex items-center justify-between p-2.5 rounded-xl text-sm font-bold ${
                            m.winnerNum === 2
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                              : "text-white"
                          }`}
                        >
                          <span className="truncate">{m.p2Name}</span>
                          {m.winnerNum === 2 && (
                            <Badge variant="emerald" size="sm">
                              ZWYCIĘZCA
                            </Badge>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
              </div>

              {/* 3rd Place Match */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2 pb-2 border-b border-white/10">
                  <Badge variant="neutral" size="sm">
                    MECZ O 3. MIEJSCE
                  </Badge>
                  <span className="text-xs text-neutral-400 font-mono">Brązowy medal</span>
                </div>

                {bracketMatches
                  .filter((m) => m.roundName === "third_place" || m.id === "third-place")
                  .map((m) => (
                    <Card
                      key={m.id}
                      className="p-4 bg-neutral-900/40 border border-white/10 space-y-3"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between p-2 rounded-lg text-sm font-medium text-white">
                          <span className="truncate">{m.p1Name}</span>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded-lg text-sm font-medium text-white">
                          <span className="truncate">{m.p2Name}</span>
                        </div>
                      </div>
                    </Card>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: PARTICIPANT DIRECTORY */}
      {activeTab === "participants" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-400" />
                Katalog Zawodników Turnieju ({players.length})
              </h2>
              <p className="text-xs text-neutral-400">
                Oficjalna lista zarejestrowanych uczestników ze statystykami
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {players.map((p: any) => {
              const standing = calculatedStandings.find((s) => s.playerId === p._id);
              const initials = p.name
                .split(" ")
                .map((w: string) => w[0])
                .join("");

              return (
                <Card
                  key={p._id}
                  className="p-5 space-y-4 bg-neutral-900/40 border border-white/10 hover:border-white/20 transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center font-mono font-bold text-white text-base">
                        {initials}
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-base">{p.name}</h3>
                        <span className="text-xs font-mono text-emerald-400 font-semibold">
                          Slot #{p.groupSlotIndex ?? "-"}
                        </span>
                      </div>
                    </div>

                    <Badge
                      variant={p.checkedIn ? "emerald" : "outline"}
                      dot={p.checkedIn}
                      size="sm"
                    >
                      {p.checkedIn ? "OBECNY" : "OCZEKUJE"}
                    </Badge>
                  </div>

                  {standing && (
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/5 text-center font-mono text-xs">
                      <div className="p-2 rounded-lg bg-black/30">
                        <span className="text-[10px] text-neutral-500 block uppercase">Miejsce</span>
                        <span className="font-bold text-white text-sm">#{standing.rank}</span>
                      </div>
                      <div className="p-2 rounded-lg bg-black/30">
                        <span className="text-[10px] text-neutral-500 block uppercase">Bilans</span>
                        <span className="font-bold text-emerald-400 text-sm">
                          {standing.won}W-{standing.lost}L
                        </span>
                      </div>
                      <div className="p-2 rounded-lg bg-black/30">
                        <span className="text-[10px] text-neutral-500 block uppercase">Punkty</span>
                        <span className="font-bold text-white text-sm">{standing.points}</span>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
