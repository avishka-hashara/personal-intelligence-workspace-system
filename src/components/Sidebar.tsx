"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUIStore } from "@/store/uiStore";
import {
  Calendar,
  CheckSquare,
  Settings,
  BookOpen,
  Map,
  Home,
  FileText,
  Book,
  Sparkles,
  Wallet,
  Heart,
  Menu,
  X,
} from "lucide-react";

import { SyncStatusIndicator } from "@/components/SyncStatusIndicator";
import { ThemeToggle } from "@/components/ThemeToggle";

export function Sidebar() {
  const pathname = usePathname();
  const { toggleCopilot } = useUIStore();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const links = [
    { href: "/", label: "Today", icon: Home },
    { href: "/plan/goals", label: "Plan", icon: Map },
    { href: "/tasks", label: "Tasks", icon: CheckSquare },
    { href: "/study/courses", label: "Study", icon: BookOpen },
    { href: "/finance", label: "Finance", icon: Wallet },
    { href: "/health", label: "Health", icon: Heart },
    { href: "/calendar", label: "Calendar", icon: Calendar },
    { href: "/notes", label: "Notes", icon: FileText },
    { href: "/journal", label: "Journal", icon: Book },
  ];

  const isSettingsActive = pathname.startsWith("/settings");

  return (
    <>
      {/* Mobile Hamburger Header (Visible < lg) */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-white/80 dark:bg-sidebar border-b border-zinc-200/70 dark:border-sidebar-border backdrop-blur-xl z-40 px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsMobileOpen((prev) => !prev)}
            className="p-2 rounded-lg text-zinc-600 dark:text-sidebar-foreground/70 hover:bg-zinc-100 dark:hover:bg-sidebar-accent transition-colors cursor-pointer"
            aria-label="Toggle navigation menu"
          >
            {isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <span className="font-semibold text-sm tracking-tight text-zinc-900 dark:text-sidebar-foreground">PIW</span>
        </div>

        <button
          type="button"
          onClick={() => toggleCopilot()}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-900 text-white dark:bg-sidebar-primary dark:text-sidebar-primary-foreground font-medium text-xs shadow-subtle cursor-pointer active:scale-[0.985] transition-all"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Copilot</span>
        </button>
      </div>

      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          onClick={() => setIsMobileOpen(false)}
          className="lg:hidden fixed inset-0 bg-black/20 dark:bg-black/50 backdrop-blur-xs z-40 transition-opacity"
        />
      )}

      {/* Main Sidebar Rail */}
      <aside
        className={`w-[240px] border-r border-zinc-200/70 dark:border-sidebar-border bg-white/70 dark:bg-sidebar backdrop-blur-xl flex flex-col h-screen fixed left-0 top-0 z-40 transition-transform duration-300 ease-in-out ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="px-5 py-6 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-zinc-900 dark:bg-sidebar-primary text-white dark:text-sidebar-primary-foreground flex items-center justify-center font-bold text-xs tracking-wider shadow-subtle">
              P
            </div>
            <h2 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-sidebar-foreground">
              Workspace
            </h2>
          </div>
          {isMobileOpen && (
            <button
              onClick={() => setIsMobileOpen(false)}
              className="lg:hidden p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-sidebar-foreground"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
          {links.map((link) => {
            const Icon = link.icon;
            const isActive =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href);

            return (
              <Link
                key={link.href}
                href={link.href}
                prefetch={true}
                onClick={() => setIsMobileOpen(false)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-150 cursor-pointer ${
                  isActive
                    ? "bg-zinc-100 dark:bg-sidebar-accent text-zinc-900 dark:text-sidebar-accent-foreground font-semibold shadow-subtle"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-sidebar-foreground hover:bg-zinc-100/60 dark:hover:bg-sidebar-accent/60"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0 stroke-[1.8]" />
                <span>{link.label}</span>
              </Link>
            );
          })}

          {/* AI Copilot Quick Launcher Button */}
          <div className="pt-3">
            <button
              type="button"
              onClick={() => {
                setIsMobileOpen(false);
                toggleCopilot();
              }}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-zinc-900/5 dark:bg-sidebar-accent/50 hover:bg-zinc-900/10 dark:hover:bg-sidebar-accent text-zinc-900 dark:text-sidebar-foreground border border-zinc-200/80 dark:border-sidebar-border font-medium text-xs transition-all duration-150 shadow-subtle cursor-pointer active:scale-[0.985] group"
            >
              <span className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-zinc-700 dark:text-sidebar-foreground group-hover:rotate-12 transition-transform" />
                <span>AI Copilot</span>
              </span>
              <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-sidebar-border shadow-2xs font-semibold">
                C
              </kbd>
            </button>
          </div>
        </nav>

        <div className="p-3 border-t border-zinc-200/60 dark:border-sidebar-border space-y-2">
          <ThemeToggle />
          <SyncStatusIndicator />
          <Link
            href="/settings/data"
            prefetch={true}
            onClick={() => setIsMobileOpen(false)}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-150 cursor-pointer ${
              isSettingsActive
                ? "bg-zinc-100 dark:bg-sidebar-accent text-zinc-900 dark:text-sidebar-accent-foreground font-semibold shadow-subtle"
                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-sidebar-foreground hover:bg-zinc-100/60 dark:hover:bg-sidebar-accent/60"
            }`}
          >
            <Settings className="h-4 w-4 shrink-0 stroke-[1.8]" />
            <span>Settings</span>
          </Link>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;