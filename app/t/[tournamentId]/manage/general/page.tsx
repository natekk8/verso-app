"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { getAdminToken } from "@/lib/auth";
import { use, useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  PencilSimple,
  Link,
  TextAlignLeft,
  Flag,
  Globe,
  UserCirclePlus,
  Check,
  WarningCircle,
  Spinner,
  Copy,
  ArrowSquareOut,
} from "@phosphor-icons/react";

// ─── Types ─────────────────────────────────────────────────────────────────

type TournamentStatus = "draft" | "active" | "finished";

// ─── Sub-components ─────────────────────────────────────────────────────────

/** Bordered settings card — label on left, action on right (or stacked on small) */
function SettingRow({
  icon,
  title,
  description,
  children,
  last = false,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className={`flex flex-col md:flex-row gap-6 px-6 py-5 ${
        !last ? "border-b border-zinc-800" : ""
      }`}
    >
      <div className="flex gap-3 md:w-80 shrink-0">
        <div className="mt-0.5 text-zinc-500">{icon}</div>
        <div>
          <p className="text-sm font-medium text-zinc-100 leading-tight">{title}</p>
          <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{description}</p>
        </div>
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

/** Slim toggle switch */
function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 disabled:opacity-40 disabled:cursor-not-allowed ${
        checked ? "bg-blue-500" : "bg-zinc-700"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
          checked ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  );
}

/** Save button with loading state */
function SaveButton({
  onClick,
  disabled,
  loading,
  children = "Zapisz",
}: {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <Button
      size="sm"
      onClick={onClick}
      disabled={disabled || loading}
      className="gap-1.5 bg-blue-600 hover:bg-blue-500 text-white border-0 transition-colors"
    >
      {loading ? (
        <Spinner className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Check className="w-3.5 h-3.5" />
      )}
      {children}
    </Button>
  );
}

// ─── Status card config ──────────────────────────────────────────────────────

const STATUS_OPTIONS: {
  value: TournamentStatus;
  label: string;
  sublabel: string;
  color: string;
  dot: string;
}[] = [
  {
    value: "draft",
    label: "Szkic",
    sublabel: "Niewidoczny publicznie, w trakcie konfiguracji.",
    color: "border-zinc-700 bg-zinc-800/60",
    dot: "bg-zinc-500",
  },
  {
    value: "active",
    label: "Aktywny",
    sublabel: "Turniej trwa — mecze są rozgrywane.",
    color: "border-zinc-700 bg-zinc-800/60",
    dot: "bg-emerald-500",
  },
  {
    value: "finished",
    label: "Zakończony",
    sublabel: "Turniej dobiegł końca. Wyniki są archiwalne.",
    color: "border-zinc-700 bg-zinc-800/60",
    dot: "bg-zinc-400",
  },
];

// ─── Main component ──────────────────────────────────────────────────────────

export default function GeneralSettingsPage({
  params,
}: {
  params: Promise<{ tournamentId: string }>;
}) {
  const { tournamentId } = use(params);

  const [adminToken, setAdminToken] = useState("");

  // ─── Convex ───────────────────────────────────────────────────
  const tournament = useQuery(api.tournaments.get, {
    id: tournamentId as Id<"tournaments">,
  });

  const updateName = useMutation(api.tournaments.updateName);
  const updateSlug = useMutation(api.tournaments.updateSlug);
  const updateSettings = useMutation(api.tournaments.updateSettings);
  const updateStatus = useMutation(api.tournaments.updateStatus);
  const togglePublicPage = useMutation(api.tournaments.togglePublicPage);
  const toggleRegistration = useMutation(api.tournaments.toggleRegistration);

  // ─── Local state ───────────────────────────────────────────────
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");

  const [loadingName, setLoadingName] = useState(false);
  const [loadingSlug, setLoadingSlug] = useState(false);
  const [loadingDesc, setLoadingDesc] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState<TournamentStatus | null>(null);
  const [loadingPublic, setLoadingPublic] = useState(false);
  const [loadingReg, setLoadingReg] = useState(false);

  // ─── Auth ─────────────────────────────────────────────────────
  useEffect(() => {
    setAdminToken(getAdminToken(tournamentId) || "");
  }, [tournamentId]);

  // ─── Sync state with DB ───────────────────────────────────────
  useEffect(() => {
    if (tournament) {
      setName(tournament.name);
      setSlug(tournament.slug ?? "");
      setDescription(tournament.description ?? "");
    }
  }, [tournament]);

  // ─── Handlers ─────────────────────────────────────────────────

  const handleSaveName = async () => {
    if (!name.trim()) return;
    setLoadingName(true);
    try {
      await updateName({ id: tournamentId as Id<"tournaments">, name: name.trim(), adminToken });
      toast.success("Nazwa turnieju zaktualizowana");
    } catch (e: unknown) {
      toast.error((e as Error).message || "Błąd podczas zapisywania");
    } finally {
      setLoadingName(false);
    }
  };

  const handleSaveSlug = async () => {
    if (!slug.trim()) return;
    setLoadingSlug(true);
    try {
      const saved = await updateSlug({
        id: tournamentId as Id<"tournaments">,
        slug: slug.trim(),
        adminToken,
      });
      setSlug(saved ?? slug);
      toast.success("Slug zaktualizowany");
    } catch (e: unknown) {
      toast.error((e as Error).message || "Błąd podczas zapisywania slugu");
    } finally {
      setLoadingSlug(false);
    }
  };

  const handleSaveDescription = async () => {
    setLoadingDesc(true);
    try {
      await updateSettings({
        id: tournamentId as Id<"tournaments">,
        adminToken,
        description,
      });
      toast.success("Opis zaktualizowany");
    } catch (e: unknown) {
      toast.error((e as Error).message || "Błąd podczas zapisywania");
    } finally {
      setLoadingDesc(false);
    }
  };

  const handleSetStatus = async (status: TournamentStatus) => {
    if (tournament?.status === status) return;
    setLoadingStatus(status);
    try {
      await updateStatus({ id: tournamentId as Id<"tournaments">, adminToken, status });
      toast.success(`Status zmieniony na: ${STATUS_OPTIONS.find((s) => s.value === status)?.label}`);
    } catch (e: unknown) {
      toast.error((e as Error).message || "Błąd podczas zmiany statusu");
    } finally {
      setLoadingStatus(null);
    }
  };

  const handleTogglePublic = async (enabled: boolean) => {
    setLoadingPublic(true);
    try {
      await togglePublicPage({ id: tournamentId as Id<"tournaments">, adminToken, enabled });
      toast.success(enabled ? "Strona publiczna włączona" : "Strona publiczna wyłączona");
    } catch (e: unknown) {
      toast.error((e as Error).message || "Błąd podczas zmiany ustawień");
    } finally {
      setLoadingPublic(false);
    }
  };

  const handleToggleRegistration = async (enabled: boolean) => {
    setLoadingReg(true);
    try {
      await toggleRegistration({ id: tournamentId as Id<"tournaments">, adminToken, enabled });
      toast.success(enabled ? "Rejestracja otwarta" : "Rejestracja zamknięta");
    } catch (e: unknown) {
      toast.error((e as Error).message || "Błąd podczas zmiany ustawień");
    } finally {
      setLoadingReg(false);
    }
  };

  // ─── Loading skeleton ─────────────────────────────────────────
  if (tournament === undefined) {
    return (
      <div className="p-6 md:p-10 max-w-3xl mx-auto space-y-6">
        <div className="h-7 w-36 bg-zinc-800 rounded-lg animate-pulse" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-28 bg-zinc-900 border border-zinc-800 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  // ─── Auth guard ───────────────────────────────────────────────
  if (tournament === null || (adminToken && tournament.adminToken !== adminToken)) {
    return (
      <div className="p-8 max-w-md mx-auto text-center mt-24">
        <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
          <WarningCircle className="w-6 h-6 text-red-400" />
        </div>
        <h2 className="text-lg font-semibold mb-1">Brak dostępu</h2>
        <p className="text-sm text-zinc-500">
          Nie masz uprawnień do zarządzania tym turniejem lub taki turniej nie istnieje.
        </p>
      </div>
    );
  }

  const publicUrl = `verso.app/t/${tournament.slug ?? tournamentId}`;
  const nameDirty = name !== tournament.name;
  const slugDirty = slug !== (tournament.slug ?? "");
  const descDirty = description !== (tournament.description ?? "");

  return (
    <div className="p-6 md:p-10 max-w-3xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      >
        <h1 className="text-2xl font-semibold tracking-tight mb-8 text-zinc-50">
          Ustawienia ogólne
        </h1>

        <div className="space-y-5">
          {/* ─── Card 1: Nazwa + Slug + Opis ─────────────────────────────── */}
          <section className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            {/* Nazwa turnieju */}
            <SettingRow
              icon={<PencilSimple className="w-4 h-4" />}
              title="Nazwa turnieju"
              description="Wyświetlana w aplikacji i na stronie publicznej."
            >
              <div className="flex gap-2 items-center">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Mój turniej"
                  className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-blue-500 h-8 text-sm max-w-xs"
                  onKeyDown={(e) => e.key === "Enter" && nameDirty && handleSaveName()}
                />
                <AnimatePresence>
                  {nameDirty && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.15 }}
                    >
                      <SaveButton onClick={handleSaveName} loading={loadingName} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </SettingRow>

            {/* Slug */}
            <SettingRow
              icon={<Link className="w-4 h-4" />}
              title="Przyjazny URL (Slug)"
              description="Unikalny identyfikator w adresie URL turnieju."
            >
              <div className="space-y-2.5">
                <div className="flex gap-2 items-center">
                  <div className="flex items-center bg-zinc-800 border border-zinc-700 rounded-md overflow-hidden h-8 max-w-xs w-full focus-within:ring-1 focus-within:ring-blue-500">
                    <span className="px-2.5 text-xs text-zinc-600 border-r border-zinc-700 select-none whitespace-nowrap">
                      verso.app/t/
                    </span>
                    <input
                      value={slug}
                      onChange={(e) =>
                        setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
                      }
                      placeholder="moj-turniej"
                      className="flex-1 bg-transparent px-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none min-w-0"
                      onKeyDown={(e) => e.key === "Enter" && slugDirty && handleSaveSlug()}
                    />
                  </div>
                  <AnimatePresence>
                    {slugDirty && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ duration: 0.15 }}
                      >
                        <SaveButton onClick={handleSaveSlug} loading={loadingSlug} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                {tournament.slug && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-zinc-500 font-mono">{publicUrl}</span>
                    <button
                      type="button"
                      className="text-zinc-600 hover:text-zinc-400 transition-colors"
                      onClick={() => {
                        navigator.clipboard.writeText(`https://${publicUrl}`);
                        toast.success("Skopiowano URL");
                      }}
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            </SettingRow>

            {/* Opis */}
            <SettingRow
              icon={<TextAlignLeft className="w-4 h-4" />}
              title="Opis"
              description="Krótki opis turnieju widoczny na stronie publicznej."
              last
            >
              <div className="space-y-2">
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Opisz swój turniej..."
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:ring-1 focus:ring-blue-500 resize-none transition-shadow"
                />
                <AnimatePresence>
                  {descDirty && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.15 }}
                    >
                      <SaveButton onClick={handleSaveDescription} loading={loadingDesc} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </SettingRow>
          </section>

          {/* ─── Card 2: Status turnieju ─────────────────────────────────── */}
          <section className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="px-6 pt-5 pb-4 border-b border-zinc-800">
              <div className="flex gap-3 items-start">
                <Flag className="w-4 h-4 text-zinc-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-zinc-100">Status turnieju</p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Kontroluje widoczność i tryb turnieju.
                  </p>
                </div>
              </div>
            </div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {STATUS_OPTIONS.map((opt) => {
                const isActive = tournament.status === opt.value;
                const isLoading = loadingStatus === opt.value;
                return (
                  <motion.button
                    key={opt.value}
                    type="button"
                    onClick={() => handleSetStatus(opt.value)}
                    disabled={isActive || isLoading}
                    whileHover={!isActive ? { scale: 1.01 } : {}}
                    whileTap={!isActive ? { scale: 0.99 } : {}}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    className={`relative text-left rounded-lg border px-4 py-3.5 transition-all duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 ${
                      isActive
                        ? "border-blue-500 bg-blue-500/8"
                        : "border-zinc-700 bg-zinc-800/50 hover:border-zinc-600 cursor-pointer"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span
                        className={`inline-block w-2 h-2 rounded-full ${opt.dot} ${
                          opt.value === "active" && isActive ? "shadow-[0_0_6px_1px_#10b981]" : ""
                        }`}
                      />
                      <span
                        className={`text-sm font-medium ${
                          isActive ? "text-blue-400" : "text-zinc-200"
                        }`}
                      >
                        {opt.label}
                      </span>
                      {isLoading && (
                        <Spinner className="w-3 h-3 text-zinc-400 animate-spin ml-auto" />
                      )}
                      {isActive && !isLoading && (
                        <Check className="w-3.5 h-3.5 text-blue-400 ml-auto" />
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 leading-relaxed">{opt.sublabel}</p>
                  </motion.button>
                );
              })}
            </div>
          </section>

          {/* ─── Card 3: Strona publiczna + Rejestracja ──────────────────── */}
          <section className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            {/* Strona publiczna */}
            <SettingRow
              icon={<Globe className="w-4 h-4" />}
              title="Strona publiczna"
              description="Udostępnij turniej publicznie — bez logowania."
            >
              <div className="flex items-center gap-3">
                <Toggle
                  checked={tournament.publicPageEnabled}
                  onChange={handleTogglePublic}
                  disabled={loadingPublic}
                />
                <span className="text-xs text-zinc-500">
                  {tournament.publicPageEnabled ? "Włączona" : "Wyłączona"}
                </span>
              </div>
              <AnimatePresence>
                {tournament.publicPageEnabled && tournament.slug && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, marginTop: 0 }}
                    animate={{ opacity: 1, height: "auto", marginTop: 8 }}
                    exit={{ opacity: 0, height: 0, marginTop: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <a
                      href={`https://${publicUrl}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors font-mono"
                    >
                      {publicUrl}
                      <ArrowSquareOut className="w-3 h-3" />
                    </a>
                  </motion.div>
                )}
              </AnimatePresence>
            </SettingRow>

            {/* Rejestracja */}
            <SettingRow
              icon={<UserCirclePlus className="w-4 h-4" />}
              title="Rejestracja uczestników"
              description="Pozwól uczestnikom zgłaszać się przez formularz rejestracyjny."
              last
            >
              <div className="flex items-center gap-3">
                <Toggle
                  checked={tournament.registrationEnabled}
                  onChange={handleToggleRegistration}
                  disabled={loadingReg}
                />
                <span className="text-xs text-zinc-500">
                  {tournament.registrationEnabled ? "Otwarta" : "Zamknięta"}
                </span>
              </div>
            </SettingRow>
          </section>
        </div>
      </motion.div>
    </div>
  );
}

export const runtime = "edge";
