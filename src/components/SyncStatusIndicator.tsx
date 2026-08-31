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

  // 1. Pending offline operations state (Amber chip)
  if (pendingOps > 0) {
    return (
      <button
        type="button"
        onClick={handleManualSync}
        disabled={isSyncing || !isOnline}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-amber-50 hover:bg-amber-100/80 text-amber-900 border border-amber-200/90 text-xs font-medium transition-all shadow-2xs cursor-pointer group"
        title={isOnline ? "Click to sync changes to server" : "Changes queued in local mirror"}
      >
        <span className="flex items-center gap-2">
          {isOnline ? (
            <RefreshCw
              className={`w-3.5 h-3.5 text-amber-600 ${
                isSyncing ? "animate-spin text-amber-700" : "group-hover:rotate-45 transition-transform"
              }`}
            />
          ) : (
            <CloudOff className="w-3.5 h-3.5 text-amber-600" />
          )}
          <span>{isSyncing ? "Syncing..." : `${pendingOps} queued`}</span>
        </span>
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white text-amber-800 border border-amber-300 font-bold">
          {isOnline ? "Sync" : "Offline"}
        </span>
      </button>
    );
  }

  // 2. Offline with 0 pending ops
  if (!isOnline) {
    return (
      <div className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 border border-slate-200 text-xs">
        <CloudOff className="w-3.5 h-3.5 text-slate-500" />
        <span>Offline mirror active</span>
      </div>
    );
  }

  // 3. Fully synced state
  return (
    <button
      type="button"
      onClick={handleManualSync}
      disabled={isSyncing}
      className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100/70 text-xs transition-colors group cursor-pointer"
      title="Click to refresh local mirror from server"
    >
      <span className="flex items-center gap-2">
        {isSyncing ? (
          <RefreshCw className="w-3.5 h-3.5 text-indigo-500 animate-spin" />
        ) : (
          <Cloud className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600" />
        )}
        <span>{isSyncing ? "Syncing..." : "Synced"}</span>
      </span>
      <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
        <Check className="w-3 h-3 text-emerald-500" />
        <span>{lastSyncedText || "Cloud"}</span>
      </span>
    </button>
  );
}

export default SyncStatusIndicator;
