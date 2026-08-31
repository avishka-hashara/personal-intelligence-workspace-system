"use client";

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
} from "lucide-react";

import { SyncStatusIndicator } from "@/components/SyncStatusIndicator";

export function Sidebar() {
  const pathname = usePathname();
  const { toggleCopilot } = useUIStore();

  const links = [
    { href: "/", label: "Today", icon: Home },
    { href: "/plan/goals", label: "Plan", icon: Map },
    { href: "/tasks", label: "Tasks", icon: CheckSquare },
    { href: "/study/courses", label: "Study", icon: BookOpen },
    { href: "/calendar", label: "Calendar", icon: Calendar },
    { href: "/notes", label: "Notes", icon: FileText },
    { href: "/journal", label: "Journal", icon: Book },
  ];

  return (
    <aside className="w-[240px] border-r border-slate-200 bg-slate-50 hidden lg:flex flex-col h-screen fixed left-0 top-0">
      <div className="p-6">
        <h2 className="text-lg font-bold tracking-tight text-slate-900">PIW</h2>
      </div>

      <nav className="flex-1 px-4 space-y-1">
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
              className={`flex items-center gap-3 px-3 py-2 rounded-md font-medium text-sm transition-colors ${
                isActive
                  ? "bg-slate-200 text-slate-900 font-semibold"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{link.label}</span>
            </Link>
          );
        })}

        {/* AI Copilot Quick Launcher Button */}
        <div className="pt-3">
          <button
            type="button"
            onClick={() => toggleCopilot()}
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
          href="/settings"
          className="flex items-center gap-3 px-3 py-2 rounded-md text-slate-600 hover:bg-slate-100 font-medium text-sm transition-colors"
        >
          <Settings className="h-4 w-4" />
          <span>Settings</span>
        </Link>
      </div>
    </aside>
  );
}

export default Sidebar;