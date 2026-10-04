import * as Crypto from 'expo-crypto';
import Storage from 'expo-sqlite/kv-store';
import { useSyncExternalStore } from 'react';
import { getApiUrl } from './config';
import {
  addOutbox,
  allIds,
  deleteRows,
  getAll,
  getOne,
  getOutbox,
  pendingEntityIds,
  putRows,
  removeOutbox,
  SYNCED_ENTITIES,
  type EntityName,
  type EntityTypes,
  type HabitLog,
  type OutboxOp,
} from './db';
import { supabase } from './supabase';

/**
 * Sync engine for the native client. Speaks the same protocol as the web app's
 * src/lib/sync.ts against /api/v1/sync/push and /api/v1/sync/pull, authenticating
 * with the Supabase access token as a Bearer header.
 */

const CLIENT_ID_KEY = 'piw_client_id';
const CURSOR_KEY = 'piw_sync_cursor';
const LAST_SYNC_KEY = 'piw_last_sync';
const PUSH_BATCH = 200;
// Pull cursor is rewound by this much to cover writes that raced the server's cursor stamp
const CURSOR_OVERLAP_MS = 10_000;

// ---------------------------------------------------------------------------
// Identity + Hybrid Logical Clock
// ---------------------------------------------------------------------------

let clientId = Storage.getItemSync(CLIENT_ID_KEY);
if (!clientId) {
  clientId = 'android-' + Crypto.randomUUID();
  Storage.setItemSync(CLIENT_ID_KEY, clientId);
}

let lastWallMs = 0;
let hlcCounter = 0;

function nextHlc(): string {
  const now = Date.now();
  if (now > lastWallMs) {
    lastWallMs = now;
    hlcCounter = 0;
  } else {
    hlcCounter += 1;
  }
  return `${lastWallMs}:${hlcCounter}:${clientId}`;
}

export function newId(): string {
  return Crypto.randomUUID();
}

// ---------------------------------------------------------------------------
// Sync status store
// ---------------------------------------------------------------------------

export interface SyncState {
  status: 'idle' | 'syncing' | 'error' | 'offline';
  error?: string;
  lastSyncedAt: string | null;
}

let state: SyncState = { status: 'idle', lastSyncedAt: Storage.getItemSync(LAST_SYNC_KEY) };
const stateListeners = new Set<() => void>();

function setState(patch: Partial<SyncState>) {
  state = { ...state, ...patch };
  stateListeners.forEach((fn) => fn());
}

export function useSyncState(): SyncState {
  return useSyncExternalStore(
    (fn) => {
      stateListeners.add(fn);
      return () => stateListeners.delete(fn);
    },
    () => state
  );
}

// ---------------------------------------------------------------------------
// Local mutations (optimistic write + outbox)
// ---------------------------------------------------------------------------

type Fields<E extends EntityName> = Partial<Omit<EntityTypes[E], 'id'>>;

function enqueue(entity: EntityName, id: string, type: OutboxOp['type'], fields: Record<string, unknown>) {
  const hlc = nextHlc();
  addOutbox({
    op_id: Crypto.randomUUID(),
    entity_type: entity,
    entity_id: id,
    type,
    fields,
    hlc,
    created_at: new Date().toISOString(),
  });
  schedulePush();
  return hlc;
}

export function createEntity<E extends EntityName>(entity: E, fields: Fields<E>, id = newId()): EntityTypes[E] {
  const now = new Date().toISOString();
  const payload = { ...fields, createdAt: now } as Record<string, unknown>;
  const hlc = enqueue(entity, id, 'insert', payload);
  const row = { ...payload, id, updatedAt: now, deletedAt: null, hlc } as unknown as EntityTypes[E];
  putRows(entity, [row]);
  return row;
}

export function updateEntity<E extends EntityName>(entity: E, id: string, patch: Fields<E>) {
  const existing = getOne(entity, id);
  const hlc = enqueue(entity, id, 'update', patch as Record<string, unknown>);
  putRows(entity, [{ ...(existing ?? {}), ...patch, id, hlc, updatedAt: new Date().toISOString() } as EntityTypes[E]]);
}

/** `fields` lets the server locate the row when ids differ (habit logs are keyed by habit + day). */
export function deleteEntity(entity: EntityName, id: string, fields: Record<string, unknown> = {}) {
  enqueue(entity, id, 'delete', fields);
  deleteRows(entity, [id]);
}

// ---------------------------------------------------------------------------
// Network
// ---------------------------------------------------------------------------

class SyncHttpError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
  }
}

async function api<T>(path: string, body: unknown): Promise<T> {
  const base = getApiUrl();
  if (!base) throw new SyncHttpError('Server URL not set (Settings → Server)');
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new SyncHttpError('Not signed in', 401);

  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}) as Record<string, string>);
    throw new SyncHttpError(err.details || err.error || `HTTP ${res.status}`, res.status);
  }
  return res.json() as Promise<T>;
}

async function pushOutbox(): Promise<number> {
  let pushed = 0;
  // Drain in batches; ops are ordered so inserts precede their updates
  for (;;) {
    const ops = getOutbox().slice(0, PUSH_BATCH);
    if (ops.length === 0) return pushed;
    const res = await api<{ applied: string[]; rejected?: { op_id: string; error: string }[] }>('/api/v1/sync/push', {
      client_id: clientId,
      ops: ops.map((op) => ({
        op_id: op.op_id,
        entity_type: op.entity_type,
        entity_id: op.entity_id,
        type: op.type,
        hlc: op.hlc,
        fields: op.fields,
      })),
    });
    const applied = res.applied ?? [];
    // Rejected ops can never succeed (e.g. constraint violations); drop them so they don't block the queue
    const rejected = (res.rejected ?? []).map((r) => r.op_id);
    if (rejected.length > 0) console.warn('[Sync] Server rejected ops', res.rejected);
    removeOutbox([...applied, ...rejected]);
    pushed += applied.length;
    // Server skipped something without a verdict; stop instead of looping forever
    if (applied.length + rejected.length < ops.length) return pushed;
  }
}

interface PullResponse {
  changes: Record<string, Record<string, unknown>[]>;
  tombstones: { entity: string; id: string }[];
  cursor: string;
  has_more: boolean;
}

async function pull(full: boolean) {
  const since = full ? '' : Storage.getItemSync(CURSOR_KEY) || '';
  const res = await api<PullResponse>('/api/v1/sync/pull', {
    since,
    entities: SYNCED_ENTITIES,
    limit: 1000,
  });

  // Never clobber rows that still have local edits waiting to be pushed
  const pending = pendingEntityIds();

  for (const entity of SYNCED_ENTITIES) {
    const rows = (res.changes?.[entity] ?? []) as unknown as EntityTypes[typeof entity][];
    putRows(entity, rows.filter((r) => !pending.has(r.id)));

    // The web app hard-deletes some rows (tasks, habit logs), which never produce tombstones.
    // A full pull is authoritative, so drop anything the server no longer has.
    if (full && !res.has_more) {
      const serverIds = new Set(rows.map((r) => r.id));
      deleteRows(
        entity,
        allIds(entity).filter((id) => !serverIds.has(id) && !pending.has(id))
      );
    }
  }

  const byEntity = new Map<EntityName, string[]>();
  for (const t of res.tombstones ?? []) {
    const entity = t.entity as EntityName;
    if (!SYNCED_ENTITIES.includes(entity) || pending.has(t.id)) continue;
    byEntity.set(entity, [...(byEntity.get(entity) ?? []), t.id]);
  }
  byEntity.forEach((ids, entity) => deleteRows(entity, ids));

  dedupeHabitLogs(pending);

  const wallMs = parseInt(res.cursor?.split(':')[0] ?? '', 10);
  if (!isNaN(wallMs)) {
    Storage.setItemSync(CURSOR_KEY, `${wallMs - CURSOR_OVERLAP_MS}:0:server`);
  }
}

/** The server folds client habit-log ids onto the existing (habit, day) row; drop our local copy. */
function dedupeHabitLogs(pending: Set<string>) {
  const logs = getAll('habit_logs');
  const seen = new Map<string, HabitLog>();
  const drop: string[] = [];
  for (const log of logs) {
    const key = `${log.habitId}|${log.loggedOn}`;
    const other = seen.get(key);
    if (!other) {
      seen.set(key, log);
      continue;
    }
    // Keep whichever came from the server (no pending op), drop the local duplicate
    const loser = pending.has(log.id) ? other : log;
    if (pending.has(loser.id)) continue;
    drop.push(loser.id);
    if (loser === other) seen.set(key, log);
  }
  deleteRows('habit_logs', drop);
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

let inFlight: Promise<void> | null = null;
let pushTimer: ReturnType<typeof setTimeout> | null = null;

export function syncNow({ full = false }: { full?: boolean } = {}): Promise<void> {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    setState({ status: 'syncing', error: undefined });
    try {
      await pushOutbox();
      await pull(full);
      const now = new Date().toISOString();
      Storage.setItemSync(LAST_SYNC_KEY, now);
      setState({ status: 'idle', lastSyncedAt: now });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const offline = err instanceof TypeError; // fetch() network failure
      setState({ status: offline ? 'offline' : 'error', error: offline ? 'Offline — changes saved locally' : message });
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

function schedulePush() {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    syncNow().catch(() => {});
  }, 1500);
}

export function resetSyncCursor() {
  Storage.removeItemSync(CURSOR_KEY);
  Storage.removeItemSync(LAST_SYNC_KEY);
  setState({ status: 'idle', lastSyncedAt: null, error: undefined });
}
