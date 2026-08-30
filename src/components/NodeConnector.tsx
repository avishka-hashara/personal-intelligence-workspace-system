"use client";

import { useState, useEffect, useTransition, useMemo } from "react";
import { searchNodes, addNodeLink, type NodeSearchResult } from "@/server/actions/nodes";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandItem,
  CommandEmpty,
  CommandGroup,
} from "@/components/ui/command";
import {
  Link2,
  Plus,
  CheckSquare,
  FileText,
  Target,
  GraduationCap,
  Sparkles,
  Loader2,
  FolderTree,
} from "lucide-react";

interface NodeConnectorProps {
  currentNodeId: string;
  onLinkAdded?: (node: NodeSearchResult) => void;
}

export function getEntityBadge(entityType: string) {
  const type = (entityType || "").toLowerCase();
  if (type === "tasks") {
    return {
      label: "Task",
      group: "Tasks & Todos",
      icon: CheckSquare,
      color: "bg-blue-50 text-blue-700 border-blue-200",
      iconColor: "text-blue-600",
      hint: "Actionable item",
    };
  }
  if (type === "notes") {
    return {
      label: "Note",
      group: "Notes & Docs",
      icon: FileText,
      color: "bg-indigo-50 text-indigo-700 border-indigo-200",
      iconColor: "text-indigo-600",
      hint: "Knowledge note",
    };
  }
  if (type === "goals") {
    return {
      label: "Goal",
      group: "Goals & Intent",
      icon: Target,
      color: "bg-emerald-50 text-emerald-700 border-emerald-200",
      iconColor: "text-emerald-600",
      hint: "Long-term goal",
    };
  }
  if (type === "courses") {
    return {
      label: "Course",
      group: "Study Courses",
      icon: GraduationCap,
      color: "bg-amber-50 text-amber-700 border-amber-200",
      iconColor: "text-amber-600",
      hint: "Academic course",
    };
  }
  return {
    label: entityType,
    group: "Other Entities",
    icon: Link2,
    color: "bg-slate-50 text-slate-700 border-slate-200",
    iconColor: "text-slate-500",
    hint: "Connected entity",
  };
}

export function NodeConnector({ currentNodeId, onLinkAdded }: NodeConnectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<NodeSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Search nodes on query change with debouncing
  useEffect(() => {
    if (!open) {
      setSearch("");
      setResults([]);
      return;
    }

    let isCancelled = false;
    setIsLoading(true);

    const timer = setTimeout(async () => {
      const res = await searchNodes(search, currentNodeId);
      if (!isCancelled) {
        if (res && res.nodes) {
          setResults(res.nodes);
        } else {
          setResults([]);
        }
        setIsLoading(false);
      }
    }, 150);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [search, open, currentNodeId]);

  // Group results by entity type for clear identification
  const groupedResults = useMemo(() => {
    const groups: { [key: string]: { label: string; items: NodeSearchResult[] } } = {};

    results.forEach((node) => {
      const badge = getEntityBadge(node.entityType);
      const groupKey = node.entityType.toLowerCase();
      if (!groups[groupKey]) {
        groups[groupKey] = {
          label: badge.group,
          items: [],
        };
      }
      groups[groupKey].items.push(node);
    });

    return Object.values(groups);
  }, [results]);

  const handleSelectNode = (selectedNode: NodeSearchResult) => {
    startTransition(async () => {
      if (onLinkAdded) {
        onLinkAdded(selectedNode);
      }
      await addNodeLink(currentNodeId, selectedNode.id);
      setOpen(false);
    });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={isPending}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 text-xs font-semibold rounded-xl border border-slate-200 transition-all cursor-pointer disabled:opacity-50"
      >
        {isPending ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Plus className="w-3.5 h-3.5" />
        )}
        <span>Link Entity</span>
      </PopoverTrigger>

      <PopoverContent
        className="w-80 sm:w-96 p-0 bg-white shadow-xl border border-slate-200 rounded-2xl overflow-hidden"
        align="end"
      >
        <Command className="rounded-none border-none">
          <CommandInput
            value={search}
            onValueChange={setSearch}
            placeholder="Search tasks, goals, courses, notes..."
            className="text-xs font-normal"
          />

          <CommandList className="max-h-72 p-1.5 overflow-y-auto">
            {isLoading && (
              <div className="flex items-center justify-center p-6 text-xs text-slate-400 gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                <span>Searching knowledge graph...</span>
              </div>
            )}

            {!isLoading && results.length === 0 && (
              <CommandEmpty className="p-6 text-xs text-center text-slate-400">
                No matching entities found.
              </CommandEmpty>
            )}

            {!isLoading &&
              groupedResults.map((group) => (
                <CommandGroup
                  key={group.label}
                  heading={group.label}
                  className="px-1 py-1 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:text-slate-400 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1"
                >
                  {group.items.map((node) => {
                    const badge = getEntityBadge(node.entityType);
                    const Icon = badge.icon;

                    return (
                      <CommandItem
                        key={node.id}
                        onSelect={() => handleSelectNode(node)}
                        className="flex items-center justify-between p-2.5 rounded-xl cursor-pointer hover:bg-slate-100/80 transition-colors my-0.5 normal-case"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className="p-1 rounded-lg bg-slate-100 text-slate-600 shrink-0">
                            <Icon className={`w-3.5 h-3.5 ${badge.iconColor}`} />
                          </div>
                          
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-slate-800 truncate normal-case">
                              {node.title || "Untitled"}
                            </p>
                            <p className="text-[10px] text-slate-400 normal-case">
                              {badge.hint}
                            </p>
                          </div>
                        </div>

                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md border shrink-0 ml-2 ${badge.color}`}
                        >
                          {badge.label}
                        </span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default NodeConnector;
