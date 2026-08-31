import { db, type OutboxOp } from "./db";

let clientHlcCounter = 0;

/**
 * Retrieves or initializes a persistent client UUID for this browser
 */
export function getClientId(): string {
  if (typeof window === "undefined") {
    return "server_client_id";
  }

  let clientId = localStorage.getItem("piw_client_id");
  if (!clientId) {
    clientId = "client-" + crypto.randomUUID();
    localStorage.setItem("piw_client_id", clientId);
  }
  return clientId;
}

/**
 * Generates a Hybrid Logical Clock timestamp on the client
 */
export function generateClientHlc(): string {
  const now = Date.now();
  clientHlcCounter += 1;
  return `${now}:${clientHlcCounter}:${getClientId()}`;
}

/**
 * Pushes all pending operations from the local Dexie outbox to the server
 */
export async function pushOutbox(): Promise<{
  pushed: number;
  applied: string[];
  conflicts: any[];
  error?: string;
}> {
  if (typeof window === "undefined") {
    return { pushed: 0, applied: [], conflicts: [] };
  }

  try {
    const pendingOps = await db.outbox.toArray();
    if (pendingOps.length === 0) {
      return { pushed: 0, applied: [], conflicts: [] };
    }

    const payload = {
      client_id: getClientId(),
      ops: pendingOps.map((op) => ({
        op_id: op.op_id,
        entity_type: op.entity_type,
        entity_id: op.entity_id,
        type: op.type,
        hlc: op.hlc,
        fields: op.fields,
        base_version: op.base_version,
      })),
    };

    const res = await fetch("/api/v1/sync/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      console.warn("[Sync] Push failed with status:", res.status, errData);
      return { pushed: 0, applied: [], conflicts: [], error: errData.error || `HTTP ${res.status}` };
    }

    const data = await res.json();
    const appliedIds = data.applied || [];

    // Delete successfully applied operations from IndexedDB outbox
    if (appliedIds.length > 0) {
      await db.outbox.bulkDelete(appliedIds);
    }

    return {
      pushed: pendingOps.length,
      applied: appliedIds,
      conflicts: data.conflicts || [],
    };
  } catch (err: any) {
    console.warn("[Sync] Push network error (client is likely offline):", err?.message || err);
    return { pushed: 0, applied: [], conflicts: [], error: err?.message || "Network error" };
  }
}

/**
 * Pulls changes from the server since the last known cursor and reconciles local IndexedDB
 */
export async function pullChanges(
  entities: string[] = ["tasks", "notes", "goals", "courses", "habits"]
): Promise<{
  synced: boolean;
  cursor?: string;
  error?: string;
}> {
  if (typeof window === "undefined") {
    return { synced: false };
  }

  try {
    const since = localStorage.getItem("piw_sync_cursor") || "";

    const res = await fetch("/api/v1/sync/pull", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        since,
        entities,
        limit: 500,
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { synced: false, error: errData.error || `HTTP ${res.status}` };
    }

    const data = await res.json();

    // 1. Upsert updated rows into respective Dexie stores
    if (data.changes) {
      for (const [entityKey, rows] of Object.entries(data.changes)) {
        const table = (db as any)[entityKey];
        if (table && Array.isArray(rows) && rows.length > 0) {
          await table.bulkPut(rows);
        }
      }
    }

    // 2. Delete tombstoned rows from local Dexie mirror
    if (Array.isArray(data.tombstones) && data.tombstones.length > 0) {
      for (const tombstone of data.tombstones) {
        const table = (db as any)[tombstone.entity];
        if (table && tombstone.id) {
          await table.delete(tombstone.id);
        }
      }
    }

    // 3. Update sync cursor
    if (data.cursor) {
      localStorage.setItem("piw_sync_cursor", data.cursor);
    }

    return { synced: true, cursor: data.cursor };
  } catch (err: any) {
    console.warn("[Sync] Pull network error:", err?.message || err);
    return { synced: false, error: err?.message || "Network error" };
  }
}

/**
 * Combined sync: pushes outbox then pulls latest changes
 */
export async function syncAll(): Promise<{
  pushResult: { pushed: number; applied: string[]; conflicts: any[]; error?: string };
  pullResult: { synced: boolean; cursor?: string; error?: string };
}> {
  const pushResult = await pushOutbox();
  const pullResult = await pullChanges();
  return { pushResult, pullResult };
}

/**
 * Queues an operation in the local outbox and applies it immediately to local Dexie mirror
 */
export async function enqueueOfflineOp(
  entityType: "tasks" | "notes" | "goals" | "courses" | "habits",
  entityId: string,
  type: "insert" | "update" | "delete" | "upsert",
  fields: Record<string, any>
): Promise<OutboxOp> {
  const opId = crypto.randomUUID();
  const hlc = generateClientHlc();

  const op: OutboxOp = {
    op_id: opId,
    client_id: getClientId(),
    entity_type: entityType,
    entity_id: entityId,
    type,
    fields,
    hlc,
    status: "pending",
    created_at: new Date().toISOString(),
  };

  // 1. Save in outbox
  await db.outbox.put(op);

  // 2. Optimistically update local mirror table
  const table = (db as any)[entityType];
  if (table) {
    if (type === "delete") {
      await table.delete(entityId);
    } else {
      const existing = await table.get(entityId);
      const updated = {
        ...(existing || {}),
        ...fields,
        id: entityId,
        hlc,
        updatedAt: new Date().toISOString(),
      };
      await table.put(updated);
    }
  }

  // 3. If online, attempt background drain
  if (typeof navigator !== "undefined" && navigator.onLine) {
    pushOutbox().catch((err) => console.error("[Sync] Auto-push error:", err));
  }

  return op;
}

/**
 * Initializes automatic sync listeners for online reconnects and visibility changes
 */
export function initSyncListeners(): () => void {
  if (typeof window === "undefined") return () => {};

  const handleOnline = () => {
    console.log("[Sync] Device back online, draining outbox...");
    syncAll();
  };

  window.addEventListener("online", handleOnline);

  // Periodic background sync every 60 seconds
  const intervalId = setInterval(() => {
    if (navigator.onLine) {
      syncAll();
    }
  }, 60_000);

  return () => {
    window.removeEventListener("online", handleOnline);
    clearInterval(intervalId);
  };
}
