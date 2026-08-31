import Dexie, { type Table } from "dexie";

export interface OutboxOp {
  op_id: string;
  client_id: string;
  entity_type: string;
  entity_id: string;
  type: "insert" | "update" | "delete" | "upsert";
  fields: Record<string, any>;
  hlc: string;
  base_version?: number;
  status: "pending" | "sending" | "failed";
  created_at: string;
}

export interface LocalTask {
  id: string;
  userId?: string;
  title: string;
  notes?: string | null;
  status: string;
  priority?: number | null;
  dueAt?: Date | string | null;
  deferUntil?: Date | string | null;
  estimateMinutes?: number | null;
  actualMinutes?: number | null;
  rrule?: string | null;
  recurrenceParentId?: string | null;
  isContainer?: boolean | null;
  sortKey?: string | null;
  energy?: string | null;
  milestoneId?: string | null;
  parentTaskId?: string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  deletedAt?: Date | string | null;
  hlc?: string | null;
  version?: number | null;
}

export interface LocalNote {
  id: string;
  userId?: string;
  title: string;
  content?: string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  deletedAt?: Date | string | null;
  hlc?: string | null;
  version?: number | null;
}

export interface LocalGoal {
  id: string;
  userId?: string;
  directionId?: string | null;
  title: string;
  description?: string | null;
  lifeArea?: string | null;
  targetDate?: Date | string | null;
  metricName?: string | null;
  targetValue?: string | number | null;
  currentValue?: string | number | null;
  unit?: string | null;
  status?: string | null;
  confidence?: number | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  deletedAt?: Date | string | null;
  hlc?: string | null;
  version?: number | null;
}

export interface LocalCourse {
  id: string;
  userId?: string;
  code: string;
  title: string;
  term?: string | null;
  credits?: string | number | null;
  instructor?: string | null;
  colour?: string | null;
  targetGrade?: string | null;
  active: boolean;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  deletedAt?: Date | string | null;
  hlc?: string | null;
  version?: number | null;
}

export interface LocalHabit {
  id: string;
  userId?: string;
  title: string;
  cadence: string;
  rrule?: string | null;
  targetCount?: number | null;
  unit?: string | null;
  gracePerWeek?: number | null;
  active: boolean;
  colour?: string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  deletedAt?: Date | string | null;
  hlc?: string | null;
  version?: number | null;
}

export class PIWDatabase extends Dexie {
  tasks!: Table<LocalTask, string>;
  notes!: Table<LocalNote, string>;
  goals!: Table<LocalGoal, string>;
  courses!: Table<LocalCourse, string>;
  habits!: Table<LocalHabit, string>;
  outbox!: Table<OutboxOp, string>;

  constructor() {
    super("PIWLocalMirror");

    this.version(1).stores({
      tasks: "id, userId, status, priority, dueAt, sortKey, milestoneId, updatedAt, hlc",
      notes: "id, userId, title, updatedAt, hlc",
      goals: "id, userId, status, targetDate, updatedAt, hlc",
      courses: "id, userId, code, active, updatedAt, hlc",
      habits: "id, userId, cadence, active, updatedAt, hlc",
      outbox: "op_id, entity_type, entity_id, status, hlc, created_at",
    });
  }
}

// Client-side singleton instance
export const db = new PIWDatabase();
