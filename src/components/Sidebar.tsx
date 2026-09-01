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
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-slate-50/95 border-b border-slate-200 backdrop-blur-md z-40 px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsMobileOpen((prev) => !prev)}
            className="p-2 rounded-lg text-slate-600 hover:bg-slate-200/70 transition-colors cursor-pointer"
            aria-label="Toggle navigation menu"
          >
            {isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <span className="font-bold text-base tracking-tight text-slate-900">PIW</span>
        </div>

        <button
          type="button"
          onClick={() => toggleCopilot()}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 font-semibold text-xs border border-indigo-200 cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Copilot</span>
        </button>
      </div>

      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          onClick={() => setIsMobileOpen(false)}
          className="lg:hidden fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 transition-opacity"
        />
      )}

      {/* Main Sidebar Rail */}
      <aside
        className={`w-[240px] border-r border-slate-200 bg-slate-50 flex flex-col h-screen fixed left-0 top-0 z-40 transition-transform duration-300 ease-in-out ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="p-6 flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight text-slate-900">PIW</h2>
          {isMobileOpen && (
            <button
              onClick={() => setIsMobileOpen(false)}
              className="lg:hidden p-1 text-slate-400 hover:text-slate-700"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
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
                onClick={() => setIsMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-md font-medium text-sm transition-colors cursor-pointer ${
                  isActive
                    ? "bg-slate-200 text-slate-900 font-semibold"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
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
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 hover:from-indigo-100 hover:to-purple-100 text-indigo-900 border border-indigo-200/80 font-semibold text-xs transition-all shadow-2xs cursor-pointer group"
            >
              <span className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600 group-hover:rotate-12 transition-transform" />
                <span>AI Copilot</span>
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white text-indigo-700 border border-indigo-200 font-bold">
                C
              </span>
            </button>
          </div>
        </nav>

        <div className="p-4 border-t border-slate-200 space-y-2">
          <SyncStatusIndicator />
          <Link
            href="/settings/data"
            onClick={() => setIsMobileOpen(false)}
            className={`flex items-center gap-3 px-3 py-2 rounded-md font-medium text-sm transition-colors cursor-pointer ${
              isSettingsActive
                ? "bg-slate-200 text-slate-900 font-semibold"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <Settings className="h-4 w-4 shrink-0" />
            <span>Settings</span>
          </Link>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;