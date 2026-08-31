import { NextResponse } from "next/server";
import { getCurrentUser } from "@/utils/supabase/server";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";
import { syncOps } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import {
  mergeEntityFields,
  generateHlc,
  type SyncOp,
  type ConflictResolutionStatus,
} from "@/server/sync/merge";

export interface PushSyncRequest {
  client_id?: string;
  clientId?: string;
  ops: SyncOp[];
}

export interface ConflictRecord {
  op_id: string;
  resolution: ConflictResolutionStatus;
  server_state: Record<string, any>;
  field_winners: Record<string, "client" | "server">;
}

export interface PushSyncResponse {
  applied: string[];
  conflicts: ConflictRecord[];
  server_hlc: string;
}

const TABLE_MAP: Record<string, any> = {
  tasks: schema.tasks,
  task: schema.tasks,
  notes: schema.notes,
  note: schema.notes,
  habits: schema.habits,
  habit: schema.habits,
  habit_logs: schema.habitLogs,
  habitlogs: schema.habitLogs,
  habit_log: schema.habitLogs,
  goals: schema.goals,
  goal: schema.goals,
  objectives: schema.objectives,
  objective: schema.objectives,
  roadmaps: schema.roadmaps,
  roadmap: schema.roadmaps,
  stages: schema.stages,
  stage: schema.stages,
  milestones: schema.milestones,
  milestone: schema.milestones,
  courses: schema.courses,
  course: schema.courses,
  syllabus_items: schema.syllabusItems,
  syllabusitems: schema.syllabusItems,
  syllabus_item: schema.syllabusItems,
  exams: schema.exams,
  exam: schema.exams,
  study_sessions: schema.studySessions,
  studysessions: schema.studySessions,
  study_session: schema.studySessions,
  course_resources: schema.courseResources,
  courseresources: schema.courseResources,
  course_resource: schema.courseResources,
  flashcards: schema.flashcards,
  flashcard: schema.flashcards,
  tags: schema.tags,
  tag: schema.tags,
  focus_sessions: schema.focusSessions,
  focussessions: schema.focusSessions,
  focus_session: schema.focusSessions,
  directions: schema.directions,
  direction: schema.directions,
  user_settings: schema.userSettings,
  usersettings: schema.userSettings,
};

function sanitizeEntityData(table: any, data: Record<string, any>, userId: string): Record<string, any> {
  const result: Record<string, any> = { userId };
  const colKeys = Object.keys(table).filter((k) => typeof table[k] === "object" && table[k]?.name);

  for (const [key, val] of Object.entries(data)) {
    if (val === undefined) continue;

    const camelKey = key.replace(/_([a-z])/g, (_, l) => l.toUpperCase());
    const matchedKey = colKeys.find(
      (c) => c === key || c === camelKey || table[c]?.name === key
    );

    if (matchedKey) {
      if (
        val !== null &&
        typeof val === "string" &&
        (matchedKey.endsWith("At") ||
          matchedKey.endsWith("On") ||
          matchedKey === "dueDate" ||
          matchedKey === "targetDate" ||
          matchedKey === "startsAt" ||
          matchedKey === "windowStart" ||
          matchedKey === "windowEnd" ||
          matchedKey === "targetStart" ||
          matchedKey === "targetEnd" ||
          matchedKey === "deferUntil" ||
          matchedKey === "dueAt" ||
          matchedKey === "lastReview" ||
          matchedKey === "nextReviewAt" ||
          matchedKey === "loggedOn" ||
          matchedKey === "startOn" ||
          matchedKey === "endOn")
      ) {
        result[matchedKey] = new Date(val);
      } else {
        result[matchedKey] = val;
      }
    }
  }

  return result;
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: PushSyncRequest = await req.json();
    const clientId = body.client_id || body.clientId || "unknown_client";
    const ops = body.ops || [];

    if (!Array.isArray(ops)) {
      return NextResponse.json({ error: "Invalid operations payload" }, { status: 400 });
    }

    const applied: string[] = [];
    const conflicts: ConflictRecord[] = [];
    let latestHlc: string | undefined = undefined;

    for (const op of ops) {
      const opId = op.op_id || op.opId;
      const entityType = (op.entity_type || op.entityType || op.entity || "").toLowerCase();
      const entityId = op.entity_id || op.entityId;
      const opHlc = op.hlc;

      if (!opId || !entityType || !entityId || !opHlc) {
        continue;
      }

      latestHlc = opHlc;

      // 1. Idempotency check: Skip if op_id already exists in sync_ops
      const existingOp = await db
        .select({ opId: syncOps.opId })
        .from(syncOps)
        .where(eq(syncOps.opId, opId))
        .limit(1);

      if (existingOp.length > 0) {
        applied.push(opId);
        continue;
      }

      // 2. Resolve target entity table
      const targetTable = TABLE_MAP[entityType];
      if (!targetTable) {
        console.warn(`[Sync Push] Unknown entity type: ${entityType}`);
        continue;
      }

      // 3. Fetch current server state
      const existingRows = await db
        .select()
        .from(targetTable)
        .where(and(eq(targetTable.id, entityId), eq(targetTable.userId, user.id)))
        .limit(1);

      const serverState = existingRows.length > 0 ? existingRows[0] : null;

      // 4. Merge incoming fields with server state using HLC & field-level LWW
      const mergeResult = mergeEntityFields(serverState, op);

      // 5. Update or insert target entity in database
      const sanitized = sanitizeEntityData(targetTable, mergeResult.mergedFields, user.id);
      sanitized.id = entityId;

      if (serverState) {
        await db
          .update(targetTable)
          .set(sanitized)
          .where(and(eq(targetTable.id, entityId), eq(targetTable.userId, user.id)));
      } else {
        await db.insert(targetTable).values(sanitized);
      }

      // 6. Record operation in sync_ops for idempotency and audit replay
      await db.insert(syncOps).values({
        opId: opId,
        clientId: clientId,
        entityType: entityType,
        entityId: entityId,
        op: op,
        hlc: opHlc,
        appliedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // 7. Track conflicts if any
      if (mergeResult.resolution !== "applied") {
        conflicts.push({
          op_id: opId,
          resolution: mergeResult.resolution,
          server_state: mergeResult.serverState,
          field_winners: mergeResult.fieldWinners,
        });
      }

      applied.push(opId);
    }

    const serverHlc = generateHlc("server", latestHlc);

    const responsePayload: PushSyncResponse = {
      applied,
      conflicts,
      server_hlc: serverHlc,
    };

    return NextResponse.json(responsePayload, { status: 200 });
  } catch (error: any) {
    console.error("[Sync Push Error]:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error?.message || String(error) },
      { status: 500 }
    );
  }
}
