"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./theme-toggle";
import {
  GearSix,
  Users,
  ChartBar,
  CalendarBlank,
  Presentation,
  Trophy,
  ArrowLeft,
} from "@phosphor-icons/react";

interface ManageSidebarProps {
  tournamentId: string;
}

export function ManageSidebar({ tournamentId }: ManageSidebarProps) {
  const pathname = usePathname();

  const items = [
    { icon: GearSix, label: "Ogólne", href: `/t/${tournamentId}/manage/general` },
    { icon: Users, label: "Uczestnicy", href: `/t/${tournamentId}/manage/players` },
    { icon: ChartBar, label: "Podział", href: `/t/${tournamentId}/manage/structure` },
    { icon: CalendarBlank, label: "Harmonogram", href: `/t/${tournamentId}/manage/schedule` },
    { icon: Trophy, label: "Wyniki", href: `/t/${tournamentId}/manage/results` },
    { icon: Presentation, label: "Prezentacja", href: `/t/${tournamentId}/manage/presentation` },
  ];

  return (
    <div className="flex flex-col w-[64px] lg:w-[240px] shrink-0 h-screen sticky top-0 bg-zinc-950 border-r border-zinc-800/50 z-20">
      
      {/* Premium Logo & Back button */}
      <div className="p-5 flex flex-col gap-6 border-b border-zinc-800/50">
        <Link href="/" className="flex items-center gap-3 transition-opacity hover:opacity-80 group">
          <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-zinc-800 to-zinc-900 border border-zinc-700/50 shadow-inner group-hover:shadow-[0_0_15px_rgba(59,130,246,0.3)] transition-all">
            <span className="text-transparent bg-clip-text bg-gradient-to-b from-zinc-100 to-zinc-400 font-bold text-lg tracking-tighter">V</span>
          </div>
          <span className="font-semibold tracking-widest text-sm hidden lg:block text-zinc-100">VERSO</span>
        </Link>
        <Link
          href="/"
          className="flex items-center gap-2 text-xs font-medium text-zinc-500 hover:text-zinc-300 transition-colors h-6"
        >
          <ArrowLeft weight="bold" className="w-4 h-4 shrink-0" />
          <span className="hidden lg:block">Panel główny</span>
        </Link>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-6 flex flex-col gap-1 px-3">
        {items.map((item, index) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <motion.div
              key={item.href}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2, delay: index * 0.04 }}
            >
              <Link
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group relative overflow-hidden",
                  isActive
                    ? "bg-blue-500/10 text-blue-400 font-medium border border-blue-500/20 shadow-[inset_0_1px_0_rgba(59,130,246,0.1)]"
                    : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/40 border border-transparent"
                )}
                title={item.label}
              >
                <Icon
                  weight={isActive ? "fill" : "regular"}
                  className={cn("w-5 h-5 shrink-0 transition-transform duration-300", isActive ? "scale-110" : "group-hover:scale-110")}
                />
                <span className="text-sm hidden lg:block">{item.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active-indicator"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-1/2 bg-blue-500 rounded-r-full shadow-[0_0_10px_rgba(59,130,246,0.8)]"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
              </Link>
            </motion.div>
          );
        })}
      </div>

      {/* Footer / Theme toggle & QR Code */}
      <div className="p-4 border-t border-zinc-800/50 flex flex-col lg:flex-row items-center justify-between gap-4">
        <ThemeToggle />
        <Link href={`/t/${tournamentId}/public`} target="_blank" className="hidden lg:flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300 transition-colors px-2 py-1.5 rounded bg-blue-500/10 border border-blue-500/20">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
          </span>
          Live
        </Link>
      </div>
    </div>
  );
}
