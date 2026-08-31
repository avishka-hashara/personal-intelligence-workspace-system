/**
 * Hybrid Logical Clock (HLC) and Conflict Resolution Engine
 * Section 12.3 & 12.4 of Personal Intelligence Workspace Specification
 */

export interface ParsedHLC {
  wallMs: number;
  counter: number;
  clientId: string;
}

export interface SyncOp {
  op_id?: string;
  opId?: string;
  client_id?: string;
  clientId?: string;
  entity_type?: string;
  entityType?: string;
  entity?: string;
  entity_id?: string;
  entityId?: string;
  type?: "insert" | "update" | "delete" | "upsert";
  hlc: string;
  base_version?: number;
  baseVersion?: number;
  fields?: Record<string, any>;
  [key: string]: any;
}

export type ConflictResolutionStatus = "applied" | "server_wins" | "merged" | "needs_review";

export interface FieldMergeResult {
  mergedFields: Record<string, any>;
  resolution: ConflictResolutionStatus;
  fieldWinners: Record<string, "client" | "server">;
  serverState: Record<string, any>;
  isResurrected: boolean;
  isDeleted: boolean;
}

/**
 * Parses an HLC string in the format "{wall_ms}:{counter}:{client_id}"
 */
export function parseHlc(hlc: string | null | undefined): ParsedHLC {
  if (!hlc || typeof hlc !== "string") {
    return { wallMs: 0, counter: 0, clientId: "" };
  }

  const parts = hlc.trim().split(":");
  if (parts.length >= 3) {
    const wallMs = parseInt(parts[0], 10);
    const counter = parseInt(parts[1], 10);
    const clientId = parts.slice(2).join(":");
    return {
      wallMs: isNaN(wallMs) ? 0 : wallMs,
      counter: isNaN(counter) ? 0 : counter,
      clientId: clientId || "",
    };
  }

  // Fallback for timestamps or ISO strings
  const parsedDate = Date.parse(hlc);
  if (!isNaN(parsedDate)) {
    return { wallMs: parsedDate, counter: 0, clientId: "" };
  }

  const numericVal = parseInt(hlc, 10);
  if (!isNaN(numericVal)) {
    return { wallMs: numericVal, counter: 0, clientId: "" };
  }

  return { wallMs: 0, counter: 0, clientId: hlc };
}

/**
 * Compares two HLC timestamps to determine total ordering.
 * Returns > 0 if hlcA is newer than hlcB.
 * Returns < 0 if hlcA is older than hlcB.
 * Returns 0 if identical.
 */
export function compareHlc(
  hlcA: string | null | undefined,
  hlcB: string | null | undefined
): number {
  if (!hlcA && !hlcB) return 0;
  if (hlcA && !hlcB) return 1;
  if (!hlcA && hlcB) return -1;

  const a = parseHlc(hlcA);
  const b = parseHlc(hlcB);

  // 1. Compare wall clock milliseconds
  if (a.wallMs !== b.wallMs) {
    return a.wallMs - b.wallMs;
  }

  // 2. Compare logical counter
  if (a.counter !== b.counter) {
    return a.counter - b.counter;
  }

  // 3. Compare client ID lexicographically (tie-breaker)
  return a.clientId.localeCompare(b.clientId);
}

/**
 * Returns true if hlcA is strictly newer than hlcB
 */
export function isHlcNewer(
  hlcA: string | null | undefined,
  hlcB: string | null | undefined
): boolean {
  return compareHlc(hlcA, hlcB) > 0;
}

/**
 * Generates an HLC timestamp given the client ID and optional previous HLC
 */
export function generateHlc(clientId: string, prevHlc?: string): string {
  const now = Date.now();
  if (!prevHlc) {
    return `${now}:0:${clientId}`;
  }

  const prev = parseHlc(prevHlc);
  if (prev.wallMs === now) {
    return `${now}:${prev.counter + 1}:${clientId}`;
  } else if (prev.wallMs > now) {
    return `${prev.wallMs}:${prev.counter + 1}:${clientId}`;
  }

  return `${now}:0:${clientId}`;
}

/**
 * Fields that behave monotonically where max value wins (e.g. counters, latest dates).
 */
const MONOTONIC_MAX_FIELDS = new Set([
  "reps",
  "lapses",
  "actualMinutes",
  "actual_minutes",
  "targetCount",
  "target_count",
  "completedTasks",
  "completed_tasks",
  "streak",
  "currentStreak",
  "current_streak",
]);

/**
 * Monotonic timestamp fields where the later date wins.
 */
const MONOTONIC_LATEST_DATE_FIELDS = new Set([
  "completedAt",
  "completed_at",
  "lastReview",
  "last_review",
]);

/**
 * Normalizes field key to camelCase for standardized matching
 */
function toCamelCase(key: string): string {
  return key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Field-level conflict resolution engine
 * Implements Table 12.2: Field-class conflict resolution policy
 */
export function mergeEntityFields(
  serverEntity: Record<string, any> | null | undefined,
  clientOp: SyncOp
): FieldMergeResult {
  const clientHlc = clientOp.hlc;
  const opType = clientOp.type || (clientOp.fields ? "update" : "insert");
  const rawFields = clientOp.fields || {};

  // Normalize client fields into object
  const clientFields: Record<string, any> = { ...rawFields };

  // If server entity does not exist yet (creation / insert)
  if (!serverEntity) {
    const isDeleteOp = opType === "delete";
    const merged = {
      ...clientFields,
      hlc: clientHlc,
      deletedAt: isDeleteOp ? new Date() : (clientFields.deletedAt || clientFields.deleted_at || null),
      createdAt: clientFields.createdAt || clientFields.created_at || new Date(),
      updatedAt: new Date(),
    };

    const fieldWinners: Record<string, "client" | "server"> = {};
    for (const key of Object.keys(clientFields)) {
      fieldWinners[key] = "client";
    }

    return {
      mergedFields: merged,
      resolution: "applied",
      fieldWinners,
      serverState: {},
      isResurrected: false,
      isDeleted: isDeleteOp,
    };
  }

  const serverHlc = serverEntity.hlc as string | null | undefined;
  const serverDeletedAt = serverEntity.deletedAt || serverEntity.deleted_at;
  const isServerDeleted = !!serverDeletedAt;
  const isClientNewer = isHlcNewer(clientHlc, serverHlc);
  const isClientDelete = opType === "delete";

  const fieldWinners: Record<string, "client" | "server"> = {};
  const mergedFields: Record<string, any> = { ...serverEntity };

  let hasClientWins = false;
  let hasServerWins = false;
  let isResurrected = false;
  let isDeleted = isServerDeleted;

  // Handle Deletion vs Edit (Table 12.2)
  if (isClientDelete) {
    if (isClientNewer) {
      // Delete wins if client HLC is newer
      mergedFields.deletedAt = new Date();
      mergedFields.hlc = clientHlc;
      isDeleted = true;
      hasClientWins = true;
    } else {
      // Server edit was newer than delete
      hasServerWins = true;
    }
  } else if (isServerDeleted && isClientNewer) {
    // Client edit is newer than server deletion -> resurrect the row
    mergedFields.deletedAt = null;
    isResurrected = true;
    isDeleted = false;
    hasClientWins = true;
  }

  // Iterate through client fields and resolve per field-class
  for (const [key, clientVal] of Object.entries(clientFields)) {
    if (key === "id" || key === "userId" || key === "user_id" || key === "createdAt" || key === "created_at") {
      continue;
    }

    const camelKey = toCamelCase(key);
    const serverVal = serverEntity[key] !== undefined ? serverEntity[key] : serverEntity[camelKey];

    // Check if field is identical
    if (JSON.stringify(serverVal) === JSON.stringify(clientVal)) {
      fieldWinners[key] = "client";
      continue;
    }

    // 1. Monotonic Max Fields (e.g. reps, lapses, counts)
    if (MONOTONIC_MAX_FIELDS.has(key) || MONOTONIC_MAX_FIELDS.has(camelKey)) {
      const serverNum = Number(serverVal) || 0;
      const clientNum = Number(clientVal) || 0;
      if (clientNum >= serverNum) {
        mergedFields[key] = clientVal;
        fieldWinners[key] = "client";
        hasClientWins = true;
      } else {
        mergedFields[key] = serverVal;
        fieldWinners[key] = "server";
        hasServerWins = true;
      }
      continue;
    }

    // 2. Monotonic Latest Date Fields (e.g. completedAt)
    if (MONOTONIC_LATEST_DATE_FIELDS.has(key) || MONOTONIC_LATEST_DATE_FIELDS.has(camelKey)) {
      if (clientVal && serverVal) {
        const clientTime = new Date(clientVal).getTime();
        const serverTime = new Date(serverVal).getTime();
        if (clientTime >= serverTime) {
          mergedFields[key] = clientVal;
          fieldWinners[key] = "client";
          hasClientWins = true;
        } else {
          mergedFields[key] = serverVal;
          fieldWinners[key] = "server";
          hasServerWins = true;
        }
      } else if (clientVal && !serverVal) {
        mergedFields[key] = clientVal;
        fieldWinners[key] = "client";
        hasClientWins = true;
      } else {
        mergedFields[key] = serverVal;
        fieldWinners[key] = "server";
        hasServerWins = true;
      }
      continue;
    }

    // 3. Scalar State (status, priority, due_at, title, notes, etc.): Last-write-wins by HLC
    if (isClientNewer) {
      mergedFields[key] = clientVal;
      fieldWinners[key] = "client";
      hasClientWins = true;
    } else {
      mergedFields[key] = serverVal;
      fieldWinners[key] = "server";
      hasServerWins = true;
    }
  }

  // Update HLC and timestamp if any client fields won or client was newer
  if (isClientNewer || hasClientWins) {
    mergedFields.hlc = clientHlc;
    mergedFields.updatedAt = new Date();
  }

  // Determine overall resolution status
  let resolution: ConflictResolutionStatus = "applied";
  if (!hasClientWins && hasServerWins) {
    resolution = "server_wins";
  } else if (hasClientWins && hasServerWins) {
    resolution = "merged";
  } else {
    resolution = "applied";
  }

  return {
    mergedFields,
    resolution,
    fieldWinners,
    serverState: serverEntity,
    isResurrected,
    isDeleted,
  };
}
