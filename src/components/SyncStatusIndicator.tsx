"use client";

import React, { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { syncAll, initSyncListeners } from "@/lib/sync";
import { RefreshCw, CloudOff, Cloud, Check } from "lucide-react";

export function SyncStatusIndicator() {
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedText, setLastSyncedText] = useState<string | null>(null);

  // Live reactive query tracking pending operations in Dexie outbox
  const pendingOps = useLiveQuery(() => db.outbox.count(), []) ?? 0;

  useEffect(() => {
    if (typeof window === "undefined") return;

    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initialize online auto-sync listeners
    const cleanup = initSyncListeners();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      cleanup();
    };
  }, []);

  const handleManualSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      await syncAll();
      setLastSyncedText("Just now");
    } catch (err) {
      console.error("[Sync] Manual sync failed:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  // 1. Pending offline operations state (Amber dot indicator)
  if (pendingOps > 0) {
    return (
      <button
        type="button"
        onClick={handleManualSync}
        disabled={isSyncing || !isOnline}
        className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/15 text-zinc-800 dark:text-zinc-200 border border-amber-500/20 text-xs font-medium transition-all cursor-pointer group"
        title={isOnline ? "Click to sync changes to server" : "Changes queued in local mirror"}
      >
        <span className="flex items-center gap-2">
          {isSyncing ? (
            <RefreshCw className="w-3 h-3 text-amber-500 animate-spin" />
          ) : (
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          )}
          <span className="text-[12px]">{isSyncing ? "Syncing..." : `${pendingOps} queued`}</span>
        </span>
        <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400 font-medium">
          {isOnline ? "Sync" : "Offline"}
        </span>
      </button>
    );
  }

  // 2. Offline with 0 pending ops
  if (!isOnline) {
    return (
      <div className="w-full flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-100/60 dark:bg-zinc-800/40 text-zinc-500 dark:text-zinc-400 text-xs border border-zinc-200/50 dark:border-zinc-800/50">
        <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
        <span className="text-[12px]">Offline mirror</span>
      </div>
    );
  }

  // 3. Fully synced state
  return (
    <button
      type="button"
      onClick={handleManualSync}
      disabled={isSyncing}
      className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100/60 dark:hover:bg-zinc-800/40 text-xs transition-colors group cursor-pointer"
      title="Click to refresh local mirror from server"
    >
      <span className="flex items-center gap-2">
        {isSyncing ? (
          <RefreshCw className="w-3 h-3 text-zinc-600 dark:text-zinc-300 animate-spin" />
        ) : (
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        )}
        <span className="text-[12px]">{isSyncing ? "Syncing..." : "Synced"}</span>
      </span>
      <span className="text-[11px] text-zinc-400 font-normal">
        {lastSyncedText || "Cloud"}
      </span>
    </button>
  );
}

export default SyncStatusIndicator;
