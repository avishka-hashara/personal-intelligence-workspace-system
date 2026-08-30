"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUIStore } from "@/store/uiStore";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
} from "@/components/ui/command";
import {
  Home,
  Map,
  CheckSquare,
  BookOpen,
  Calendar,
  FileText,
  Book,
  Settings,
  Zap,
} from "lucide-react";

export function CommandPalette() {
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const { isCommandOpen, setCommandOpen, toggleCommand, isCaptureOpen, setTimerOpen } = useUIStore();

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleNavigate = (path: string) => {
    setCommandOpen(false);
    router.push(path);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Toggle Command Palette on Cmd+K or Ctrl+K
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        toggleCommand();
        return;
      }

      // 2. Check if activeElement is an INPUT or TEXTAREA
      const activeElement = document.activeElement as HTMLElement | null;
      if (
        activeElement &&
        (activeElement.tagName === "INPUT" ||
          activeElement.tagName === "TEXTAREA" ||
          activeElement.isContentEditable)
      ) {
        return;
      }

      // 3. Single-key navigation (only when palette & capture are closed and no modifiers pressed)
      if (isCommandOpen || isCaptureOpen || e.metaKey || e.ctrlKey || e.altKey) {
        return;
      }

      const singleKeyMap: Record<string, string> = {
        t: "/",
        k: "/tasks",
        s: "/study/courses",
        n: "/notes",
        j: "/journal",
      };

      const path = singleKeyMap[e.key.toLowerCase()];
      if (path) {
        e.preventDefault();
        router.push(path);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isCommandOpen, toggleCommand, router]);

  if (!mounted) {
    return null;
  }

  return (
    <CommandDialog open={isCommandOpen} onOpenChange={setCommandOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => handleNavigate("/")}>
            <Home className="mr-2 h-4 w-4" />
            <span>Today</span>
            <CommandShortcut>T</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleNavigate("/plan/goals")}>
            <Map className="mr-2 h-4 w-4" />
            <span>Plan</span>
          </CommandItem>
          <CommandItem onSelect={() => handleNavigate("/tasks")}>
            <CheckSquare className="mr-2 h-4 w-4" />
            <span>Tasks</span>
            <CommandShortcut>K</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleNavigate("/study/courses")}>
            <BookOpen className="mr-2 h-4 w-4" />
            <span>Study</span>
            <CommandShortcut>S</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleNavigate("/calendar")}>
            <Calendar className="mr-2 h-4 w-4" />
            <span>Calendar</span>
          </CommandItem>
          <CommandItem onSelect={() => handleNavigate("/notes")}>
            <FileText className="mr-2 h-4 w-4" />
            <span>Notes</span>
            <CommandShortcut>N</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleNavigate("/journal")}>
            <Book className="mr-2 h-4 w-4" />
            <span>Journal</span>
            <CommandShortcut>J</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleNavigate("/settings")}>
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </CommandItem>
          <CommandItem
            onSelect={() => {
              setCommandOpen(false);
              setTimerOpen(true);
            }}
          >
            <Zap className="mr-2 h-4 w-4 text-amber-500" />
            <span>Focus Mode</span>
            <CommandShortcut>F</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
