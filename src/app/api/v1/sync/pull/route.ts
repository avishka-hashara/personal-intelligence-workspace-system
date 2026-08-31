import { NextResponse } from "next/server";
import { getCurrentUser } from "@/utils/supabase/server";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";
import { eq, and, isNull, isNotNull, gt } from "drizzle-orm";
import { parseHlc, generateHlc } from "@/server/sync/merge";

export interface PullSyncRequest {
  since?: string;
  entities?: string[];
  limit?: number;
}

export interface Tombstone {
  entity: string;
  id: string;
  deleted_at: string | Date | null;
}

export interface PullSyncResponse {
  changes: Record<string, any[]>;
  tombstones: Tombstone[];
  cursor: string;
  has_more: boolean;
}

const TABLE_MAP: Record<string, any> = {
  tasks: schema.tasks,
  task: schema.tasks,
  notes: schema.notes,
  note: schema.notes,
  habits: schema.habits,
  habit: schema.habits,
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
};

const DEFAULT_ENTITIES = [
  "tasks",
  "notes",
  "goals",
  "courses",
  "habits",
  "milestones",
  "flashcards",
];

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: PullSyncRequest = await req.json().catch(() => ({}));
    const sinceRaw = body.since || "";
    const requestedEntities = Array.isArray(body.entities) && body.entities.length > 0
      ? body.entities
      : DEFAULT_ENTITIES;
    const limit = Math.min(Math.max(Number(body.limit) || 500, 1), 1000);

    // Calculate delta cutoff date from 'since'
    let sinceDate: Date = new Date(0);
    if (sinceRaw) {
      const parsedHlc = parseHlc(sinceRaw);
      if (parsedHlc.wallMs > 0) {
        sinceDate = new Date(parsedHlc.wallMs);
      } else {
        const parsedDate = new Date(sinceRaw);
        if (!isNaN(parsedDate.getTime())) {
          sinceDate = parsedDate;
        }
      }
    }

    const changes: Record<string, any[]> = {};
    const tombstones: Tombstone[] = [];
    let hasMore = false;

    for (const entityKey of requestedEntities) {
      const normalizedKey = entityKey.toLowerCase();
      const targetTable = TABLE_MAP[normalizedKey];

      if (!targetTable) {
        continue;
      }

      // 1. Fetch active rows updated since cutoff date
      const activeRows = await db
        .select()
        .from(targetTable)
        .where(
          and(
            eq(targetTable.userId, user.id),
            isNull(targetTable.deletedAt),
            gt(targetTable.updatedAt, sinceDate)
          )
        )
        .limit(limit);

      if (activeRows.length >= limit) {
        hasMore = true;
      }

      changes[entityKey] = activeRows;

      // 2. Fetch tombstones (rows soft-deleted since cutoff date)
      const deletedRows = await db
        .select({
          id: targetTable.id,
          deletedAt: targetTable.deletedAt,
        })
        .from(targetTable)
        .where(
          and(
            eq(targetTable.userId, user.id),
            isNotNull(targetTable.deletedAt),
            gt(targetTable.deletedAt, sinceDate)
          )
        )
        .limit(limit);

      for (const del of deletedRows) {
        tombstones.push({
          entity: entityKey,
          id: del.id,
          deleted_at: del.deletedAt,
        });
      }
    }

    const cursor = generateHlc("server");

    const responsePayload: PullSyncResponse = {
      changes,
      tombstones,
      cursor,
      has_more: hasMore,
    };

    return NextResponse.json(responsePayload, { status: 200 });
  } catch (error: any) {
    console.error("[Sync Pull Error]:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error?.message || String(error) },
      { status: 500 }
    );
  }
}
