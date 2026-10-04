import * as SQLite from 'expo-sqlite';
import { useCallback, useSyncExternalStore } from 'react';

/**
 * Local-first mirror of the server entities, mirroring the web app's Dexie store (src/lib/db.ts).
 * Rows are stored as JSON blobs keyed by (entity, id); personal data volumes are small enough
 * that filtering in JS is simpler and fast enough.
 */

export type EntityName = 'tasks' | 'notes' | 'habits' | 'habit_logs' | 'habit_pauses' | 'time_blocks';

export const SYNCED_ENTITIES: EntityName[] = [
  'tasks',
  'notes',
  'habits',
  'habit_logs',
  'habit_pauses',
  'time_blocks',
];

interface BaseRow {
  id: string;
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
  hlc?: string | null;
  version?: number | null;
}

export type TaskStatus = 'inbox' | 'next' | 'in_progress' | 'blocked' | 'done' | 'cancelled';

export interface Task extends BaseRow {
  title: string;
  notes?: string | null;
  status: TaskStatus;
  priority?: number | null;
  dueAt?: string | null;
  deferUntil?: string | null;
  estimateMinutes?: number | null;
  actualMinutes?: number | null;
  rrule?: string | null;
  recurrenceParentId?: string | null;
  isContainer?: boolean | null;
  sortKey?: string | null;
  energy?: string | null;
  milestoneId?: string | null;
  parentTaskId?: string | null;
}

export interface Note extends BaseRow {
  title: string;
  content?: string | null;
}

export interface Habit extends BaseRow {
  title: string;
  cadence: string;
  rrule?: string | null;
  targetCount?: number | null;
  unit?: string | null;
  gracePerWeek?: number | null;
  active: boolean;
  colour?: string | null;
}

export interface HabitLog extends BaseRow {
  habitId: string;
  loggedOn: string; // YYYY-MM-DD
  value?: string | null;
  backfilled?: boolean;
  note?: string | null;
}

export interface HabitPause extends BaseRow {
  habitId: string;
  startOn: string;
  endOn?: string | null;
  reason?: string | null;
}

export interface TimeBlock extends BaseRow {
  title?: string | null;
  startAt: string;
  endAt: string;
  taskId?: string | null;
  studySessionId?: string | null;
  kind: string;
  locked: boolean;
}

export interface EntityTypes {
  tasks: Task;
  notes: Note;
  habits: Habit;
  habit_logs: HabitLog;
  habit_pauses: HabitPause;
  time_blocks: TimeBlock;
}

export interface OutboxOp {
  op_id: string;
  entity_type: EntityName;
  entity_id: string;
  type: 'insert' | 'update' | 'delete';
  fields: Record<string, unknown>;
  hlc: string;
  created_at: string;
}

export const sqlite = SQLite.openDatabaseSync('piw.db');

sqlite.execSync(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS entities (
    entity TEXT NOT NULL,
    id TEXT NOT NULL,
    data TEXT NOT NULL,
    PRIMARY KEY (entity, id)
  );
  CREATE TABLE IF NOT EXISTS outbox (
    op_id TEXT PRIMARY KEY NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    type TEXT NOT NULL,
    fields TEXT NOT NULL,
    hlc TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

// ---------------------------------------------------------------------------
// In-memory cache + change notifications so screens re-render on writes
// ---------------------------------------------------------------------------

const cache = new Map<EntityName, unknown[]>();
const listeners = new Map<string, Set<() => void>>();

function emit(key: string) {
  listeners.get(key)?.forEach((fn) => fn());
}

export function notifyChange(entity: EntityName | 'outbox') {
  if (entity !== 'outbox') cache.delete(entity);
  emit(entity);
}

function subscribe(key: string, fn: () => void) {
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key)!.add(fn);
  return () => {
    listeners.get(key)?.delete(fn);
  };
}

export function getAll<E extends EntityName>(entity: E): EntityTypes[E][] {
  const hit = cache.get(entity);
  if (hit) return hit as EntityTypes[E][];
  const rows = sqlite.getAllSync<{ data: string }>('SELECT data FROM entities WHERE entity = ?', entity);
  const parsed = rows.map((r) => JSON.parse(r.data) as EntityTypes[E]).filter((r) => !r.deletedAt);
  cache.set(entity, parsed);
  return parsed;
}

export function getOne<E extends EntityName>(entity: E, id: string): EntityTypes[E] | undefined {
  return getAll(entity).find((r) => r.id === id);
}

export function putRows(entity: EntityName, rows: BaseRow[]) {
  if (rows.length === 0) return;
  sqlite.withTransactionSync(() => {
    for (const row of rows) {
      sqlite.runSync(
        'INSERT OR REPLACE INTO entities (entity, id, data) VALUES (?, ?, ?)',
        entity,
        row.id,
        JSON.stringify(row)
      );
    }
  });
  notifyChange(entity);
}

export function deleteRows(entity: EntityName, ids: string[]) {
  if (ids.length === 0) return;
  sqlite.withTransactionSync(() => {
    for (const id of ids) {
      sqlite.runSync('DELETE FROM entities WHERE entity = ? AND id = ?', entity, id);
    }
  });
  notifyChange(entity);
}

export function allIds(entity: EntityName): string[] {
  return sqlite
    .getAllSync<{ id: string }>('SELECT id FROM entities WHERE entity = ?', entity)
    .map((r) => r.id);
}

export function clearLocalData() {
  sqlite.execSync('DELETE FROM entities; DELETE FROM outbox;');
  SYNCED_ENTITIES.forEach(notifyChange);
  notifyChange('outbox');
}

// ---------------------------------------------------------------------------
// Outbox
// ---------------------------------------------------------------------------

export function getOutbox(): OutboxOp[] {
  return sqlite
    .getAllSync<Omit<OutboxOp, 'fields'> & { fields: string }>('SELECT * FROM outbox ORDER BY created_at, hlc')
    .map((r) => ({ ...r, fields: JSON.parse(r.fields) }));
}

export function addOutbox(op: OutboxOp) {
  sqlite.runSync(
    'INSERT INTO outbox (op_id, entity_type, entity_id, type, fields, hlc, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    op.op_id,
    op.entity_type,
    op.entity_id,
    op.type,
    JSON.stringify(op.fields),
    op.hlc,
    op.created_at
  );
  notifyChange('outbox');
}

export function removeOutbox(opIds: string[]) {
  if (opIds.length === 0) return;
  sqlite.withTransactionSync(() => {
    for (const id of opIds) sqlite.runSync('DELETE FROM outbox WHERE op_id = ?', id);
  });
  notifyChange('outbox');
}

export function pendingEntityIds(): Set<string> {
  return new Set(
    sqlite.getAllSync<{ entity_id: string }>('SELECT DISTINCT entity_id FROM outbox').map((r) => r.entity_id)
  );
}

export function outboxCount(): number {
  return sqlite.getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM outbox')?.n ?? 0;
}

// ---------------------------------------------------------------------------
// React hooks
// ---------------------------------------------------------------------------

export function useEntities<E extends EntityName>(entity: E): EntityTypes[E][] {
  // getAll() returns the cached array, so the snapshot is stable until the entity changes
  const sub = useCallback((fn: () => void) => subscribe(entity, fn), [entity]);
  return useSyncExternalStore(sub, () => getAll(entity));
}

export function useEntity<E extends EntityName>(entity: E, id: string | undefined): EntityTypes[E] | undefined {
  const rows = useEntities(entity);
  return id ? rows.find((r) => r.id === id) : undefined;
}

const subscribeOutbox = (fn: () => void) => subscribe('outbox', fn);

export function useOutboxCount(): number {
  return useSyncExternalStore(subscribeOutbox, outboxCount);
}
