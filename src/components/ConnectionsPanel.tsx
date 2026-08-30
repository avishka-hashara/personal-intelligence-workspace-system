"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import {
  removeNodeLink,
  type ConnectedNode,
  type NodeSearchResult,
} from "@/server/actions/nodes";
import { NodeConnector, getEntityBadge } from "@/components/NodeConnector";
import {
  Link2,
  ArrowUpRight,
  ArrowDownLeft,
  X,
  ExternalLink,
} from "lucide-react";

interface ConnectionsPanelProps {
  nodeId: string;
  connections: {
    forwardLinks: ConnectedNode[];
    backlinks: ConnectedNode[];
  };
}

function getNodeHref(id: string, entityType: string): string {
  const type = entityType.toLowerCase();
  if (type === "notes") return `/notes/${id}`;
  if (type === "courses") return `/study/courses/${id}`;
  if (type === "goals") return `/plan/goals/${id}`;
  if (type === "tasks") return `/tasks`;
  return `/notes/${id}`;
}

export function ConnectionsPanel({ nodeId, connections }: ConnectionsPanelProps) {
  const [forwardLinks, setForwardLinks] = useState<ConnectedNode[]>(
    connections.forwardLinks || []
  );
  const [backlinks, setBacklinks] = useState<ConnectedNode[]>(
    connections.backlinks || []
  );
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setForwardLinks(connections.forwardLinks || []);
    setBacklinks(connections.backlinks || []);
  }, [connections]);

  const handleLinkAdded = (node: NodeSearchResult) => {
    setForwardLinks((prev) => {
      if (prev.some((l) => l.id === node.id)) return prev;
      return [
        ...prev,
        {
          id: node.id,
          title: node.title,
          entityType: node.entityType,
          kind: "reference",
          createdAt: new Date(),
        },
      ];
    });
  };

  const handleRemoveLink = (targetId: string) => {
    setForwardLinks((prev) => prev.filter((l) => l.id !== targetId));
    setBacklinks((prev) => prev.filter((l) => l.id !== targetId));

    startTransition(async () => {
      await removeNodeLink(nodeId, targetId);
    });
  };

  const totalConnections = forwardLinks.length + backlinks.length;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col gap-4">
      {/* Header & Link Action */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
            <Link2 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <span>Connected Entities & Knowledge Graph</span>
              <span className="text-[11px] font-mono font-semibold px-2 py-0.2 rounded-full bg-slate-100 text-slate-600">
                {totalConnections}
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Bi-directional links connecting this note to related tasks, goals, courses, or notes.
            </p>
          </div>
        </div>

        <NodeConnector currentNodeId={nodeId} onLinkAdded={handleLinkAdded} />
      </div>

      {/* Outgoing Forward Links */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
          <ArrowUpRight className="w-3.5 h-3.5 text-indigo-500" />
          <span>Outgoing Links ({forwardLinks.length})</span>
        </div>

        {forwardLinks.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {forwardLinks.map((link) => {
              const badge = getEntityBadge(link.entityType);
              const Icon = badge.icon;
              const href = getNodeHref(link.id, link.entityType);

              return (
                <div
                  key={link.id}
                  className="group inline-flex items-center gap-2 pl-3 pr-1.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50/80 hover:bg-white hover:border-slate-300 shadow-2xs hover:shadow-xs transition-all text-xs"
                >
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${badge.iconColor}`} />
                  
                  <Link
                    href={href}
                    className="font-semibold text-slate-800 hover:text-indigo-600 hover:underline max-w-[280px] truncate"
                    title={link.title || "Untitled"}
                  >
                    {link.title || "Untitled"}
                  </Link>

                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${badge.color}`}>
                    {badge.label}
                  </span>

                  <button
                    type="button"
                    onClick={() => handleRemoveLink(link.id)}
                    disabled={isPending}
                    className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                    title="Remove connection"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic">
            No outgoing links attached. Click &quot;Link Entity&quot; above to connect this note to a task, goal, course, or note.
          </p>
        )}
      </div>

      {/* Incoming Backlinks */}
      {backlinks.length > 0 && (
        <div className="space-y-2 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
            <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-500" />
            <span>Referenced By / Backlinks ({backlinks.length})</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {backlinks.map((link) => {
              const badge = getEntityBadge(link.entityType);
              const Icon = badge.icon;
              const href = getNodeHref(link.id, link.entityType);

              return (
                <div
                  key={link.id}
                  className="group inline-flex items-center gap-2 pl-3 pr-1.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50/80 hover:bg-white hover:border-slate-300 shadow-2xs hover:shadow-xs transition-all text-xs"
                >
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${badge.iconColor}`} />
                  
                  <Link
                    href={href}
                    className="font-semibold text-slate-800 hover:text-indigo-600 hover:underline max-w-[280px] truncate"
                    title={link.title || "Untitled"}
                  >
                    {link.title || "Untitled"}
                  </Link>

                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${badge.color}`}>
                    {badge.label}
                  </span>

                  <button
                    type="button"
                    onClick={() => handleRemoveLink(link.id)}
                    disabled={isPending}
                    className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                    title="Remove connection"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default ConnectionsPanel;
