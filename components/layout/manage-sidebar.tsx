"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import {
  GearSix,
  Users,
  ChartBar,
  CalendarBlank,
  Presentation,
  Trophy,
  ArrowLeft,
  ArrowSquareOut,
} from "@phosphor-icons/react";

interface ManageSidebarProps {
  tournamentId: string;
}

const NAV_ITEMS = [
  { icon: GearSix,        label: "Ogólne",       segment: "general"      },
  { icon: Users,          label: "Uczestnicy",   segment: "players"      },
  { icon: ChartBar,       label: "Podział",      segment: "structure"    },
  { icon: CalendarBlank,  label: "Harmonogram",  segment: "schedule"     },
  { icon: Trophy,         label: "Wyniki",        segment: "results"      },
  { icon: Presentation,   label: "Prezentacja",  segment: "presentation" },
] as const;

export function ManageSidebar({ tournamentId }: ManageSidebarProps) {
  const pathname  = usePathname();
  const tournament = useQuery(api.tournaments.get, {
    id: tournamentId as Id<"tournaments">,
  });

  const items = NAV_ITEMS.map((item) => ({
    ...item,
    href: `/t/${tournamentId}/manage/${item.segment}`,
  }));

  /* ─── Desktop sidebar ─────────────────────────────────────── */
  return (
    <>
      {/* ── LEFT SIDEBAR (lg+) ────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-[240px] shrink-0 h-screen sticky top-0 bg-zinc-950 border-r border-zinc-800/60 z-20">

        {/* Top: logo + tournament name */}
        <div className="px-5 pt-6 pb-5 border-b border-zinc-800/60 flex flex-col gap-3">
          {/* Brand mark */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-7 h-7 rounded-md bg-blue-600 shadow-[0_0_14px_rgba(59,130,246,0.45)]">
              <span className="text-white font-black text-sm tracking-tighter leading-none select-none">
                V
              </span>
            </div>
            <span className="font-bold tracking-[0.18em] text-xs text-zinc-100 uppercase">
              Verso
            </span>
          </div>

          {/* Tournament name */}
          <div className="flex flex-col gap-0.5 pl-0.5">
            <span className="text-[10px] font-medium tracking-widest uppercase text-zinc-600">
              Turniej
            </span>
            <AnimatePresence mode="wait">
              {tournament ? (
                <motion.p
                  key="name"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2 }}
                  className="text-sm font-semibold text-zinc-100 leading-tight line-clamp-2"
                >
                  {tournament.name}
                </motion.p>
              ) : (
                <motion.div
                  key="skeleton"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="h-4 w-28 rounded bg-zinc-800 animate-pulse"
                />
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 flex flex-col gap-0.5">
          {items.map((item, index) => {
            const isActive = pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <motion.div
                key={item.href}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.22, delay: index * 0.04, ease: "easeOut" }}
              >
                <Link
                  href={item.href}
                  title={item.label}
                  className={cn(
                    "group relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors duration-150",
                    isActive
                      ? "text-blue-400"
                      : "text-zinc-500 hover:text-zinc-200"
                  )}
                >
                  {/* Pill background */}
                  {isActive && (
                    <motion.div
                      layoutId="sidebar-pill"
                      className="absolute inset-0 rounded-lg bg-blue-500/10 border border-blue-500/20"
                      transition={{ type: "spring", stiffness: 380, damping: 34 }}
                    />
                  )}

                  {/* Left accent bar */}
                  {isActive && (
                    <motion.div
                      layoutId="sidebar-accent"
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-blue-500"
                      transition={{ type: "spring", stiffness: 380, damping: 34 }}
                    />
                  )}

                  {/* Hover bg (non-active) */}
                  {!isActive && (
                    <div className="absolute inset-0 rounded-lg bg-zinc-800/0 group-hover:bg-zinc-800/50 transition-colors duration-150" />
                  )}

                  <Icon
                    weight={isActive ? "fill" : "regular"}
                    className="relative z-10 w-[18px] h-[18px] shrink-0 transition-transform duration-200 group-hover:scale-105"
                  />
                  <span className="relative z-10 text-sm font-medium">
                    {item.label}
                  </span>
                </Link>
              </motion.div>
            );
          })}
        </nav>

        {/* Bottom actions */}
        <div className="px-3 py-4 border-t border-zinc-800/60 flex flex-col gap-2">
          {/* Live page */}
          <Link
            href={`/t/${tournamentId}/public`}
            target="_blank"
            className="group flex items-center gap-2.5 px-3 py-2 rounded-lg bg-emerald-500/8 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/15 hover:border-emerald-500/35 transition-all duration-150"
          >
            {/* Pulsing dot */}
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-xs font-semibold tracking-wide flex-1">Strona Live</span>
            <ArrowSquareOut
              weight="bold"
              className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 transition-opacity"
            />
          </Link>

          {/* Back to home */}
          <Link
            href="/"
            className="group flex items-center gap-2.5 px-3 py-2 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800/50 transition-all duration-150"
          >
            <ArrowLeft
              weight="bold"
              className="w-4 h-4 shrink-0 transition-transform duration-200 group-hover:-translate-x-0.5"
            />
            <span className="text-xs font-medium">Panel główny</span>
          </Link>
        </div>
      </aside>

      {/* ── BOTTOM TAB BAR (mobile, < lg) ────────────────────── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 flex items-stretch bg-zinc-950/95 backdrop-blur-md border-t border-zinc-800/70">
        {items.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex flex-1 flex-col items-center justify-center gap-1 py-2.5 transition-colors duration-150",
                isActive ? "text-blue-400" : "text-zinc-600 active:text-zinc-300"
              )}
            >
              {/* Active top bar */}
              {isActive && (
                <motion.div
                  layoutId="mobile-tab-bar"
                  className="absolute top-0 left-1/2 -translate-x-1/2 h-[2px] w-8 rounded-full bg-blue-500"
                  transition={{ type: "spring", stiffness: 400, damping: 36 }}
                />
              )}

              {/* Tap ripple bg */}
              {isActive && (
                <motion.div
                  layoutId="mobile-tab-pill"
                  className="absolute inset-x-1 inset-y-1 rounded-xl bg-blue-500/10"
                  transition={{ type: "spring", stiffness: 400, damping: 36 }}
                />
              )}

              <Icon
                weight={isActive ? "fill" : "regular"}
                className="relative z-10 w-5 h-5"
              />
              <span
                className={cn(
                  "relative z-10 text-[10px] font-medium leading-none transition-opacity",
                  isActive ? "opacity-100" : "opacity-70"
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
