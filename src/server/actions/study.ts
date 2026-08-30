"use server";

import { db } from "@/server/db";
import {
    courses,
    syllabusItems,
    exams,
    studySessions,
    courseResources,
    flashcards,
} from "@/server/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getCurrentUser, createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { generateNodeEmbedding } from "@/lib/embeddings";

export interface CreateCourseInput {
    code: string;
    title: string;
    term?: string | null;
    credits?: string | null;
    instructor?: string | null;
    colour?: string | null;
    targetGrade?: string | null;
}

export async function createCourse(input: FormData | CreateCourseInput) {
    const user = await getCurrentUser();
    if (!user) {
        return { error: "Unauthorized" };
    }

    let code = "";
    let title = "";
    let term: string | null = null;
    let credits: string | null = null;
    let instructor: string | null = null;
    let colour: string | null = null;
    let targetGrade: string | null = null;

    if (input instanceof FormData) {
        code = (input.get("code") as string) || "";
        title = (input.get("title") as string) || "";
        term = (input.get("term") as string) || null;
        credits = (input.get("credits") as string) || null;
        instructor = (input.get("instructor") as string) || null;
        colour = (input.get("colour") as string) || null;
        targetGrade = (input.get("targetGrade") as string) || null;
    } else {
        code = input.code;
        title = input.title;
        term = input.term ?? null;
        credits = input.credits ?? null;
        instructor = input.instructor ?? null;
        colour = input.colour ?? null;
        targetGrade = input.targetGrade ?? null;
    }

    const cleanCode = code.trim();
    const cleanTitle = title.trim();

    if (!cleanCode || !cleanTitle) {
        return { error: "Course code and title are required" };
    }

    try {
        const [insertedCourse] = await db
            .insert(courses)
            .values({
                userId: user.id,
                code: cleanCode,
                title: cleanTitle,
                term,
                credits,
                instructor,
                colour,
                targetGrade,
                active: true,
            })
            .returning();

        // Generate embedding for new course
        if (insertedCourse) {
            const courseText = [cleanCode, cleanTitle, instructor, term].filter(Boolean).join(" - ");
            await generateNodeEmbedding(insertedCourse.id, courseText);
        }

        revalidatePath("/study/courses");
        revalidatePath("/");
        return { success: true, course: insertedCourse };
    } catch (error) {
        console.error("Failed to create course:", error);
        return { error: "Failed to create course" };
    }
}

export async function createSyllabusItem(courseId: string, title: string) {
    const user = await getCurrentUser();
    if (!user) {
        return { error: "Unauthorized" };
    }

    const cleanTitle = title.trim();
    if (!cleanTitle) {
        return { error: "Syllabus item title is required" };
    }

    try {
        // Find current max ordinal in this course
        const [latestItem] = await db
            .select({ ordinal: syllabusItems.ordinal })
            .from(syllabusItems)
            .where(and(eq(syllabusItems.courseId, courseId), eq(syllabusItems.userId, user.id)))
            .orderBy(desc(syllabusItems.ordinal))
            .limit(1);

        const nextOrdinal = (latestItem?.ordinal ?? -1) + 1;

        const [insertedItem] = await db
            .insert(syllabusItems)
            .values({
                userId: user.id,
                courseId,
                title: cleanTitle,
                ordinal: nextOrdinal,
                coverage: "not_started",
                confidence: 1,
            })
            .returning();

        revalidatePath(`/study/courses/${courseId}`);
        revalidatePath("/study/courses");
        return { success: true, item: insertedItem };
    } catch (error) {
        console.error("Failed to create syllabus item:", error);
        return { error: "Failed to create syllabus item" };
    }
}

export async function updateSyllabusCoverage(
    itemId: string,
    coverage: string,
    confidence: number,
    courseId?: string
) {
    const user = await getCurrentUser();
    if (!user) {
        return { error: "Unauthorized" };
    }

    try {
        const [updatedItem] = await db
            .update(syllabusItems)
            .set({
                coverage,
                confidence,
                updatedAt: new Date(),
            })
            .where(and(eq(syllabusItems.id, itemId), eq(syllabusItems.userId, user.id)))
            .returning();

        const targetCourseId = courseId || updatedItem?.courseId;
        if (targetCourseId) {
            revalidatePath(`/study/courses/${targetCourseId}`);
        }
        revalidatePath("/study/courses");

        return { success: true, item: updatedItem };
    } catch (error) {
        console.error("Failed to update syllabus coverage:", error);
        return { error: "Failed to update syllabus coverage" };
    }
}

export async function createExam(courseId: string, formData: FormData) {
    const user = await getCurrentUser();
    if (!user) {
        return { error: "Unauthorized" };
    }

    const title = ((formData.get("title") as string) || "").trim();
    const startsAtRaw = formData.get("startsAt") as string | null;
    const venue = (formData.get("venue") as string) || null;
    const weightRaw = formData.get("weight") as string | null;
    const rampDaysRaw = formData.get("rampDays") as string | null;

    if (!title) {
        return { error: "Exam title is required" };
    }

    const startsAt = startsAtRaw ? new Date(startsAtRaw) : new Date();
    const weight = weightRaw ? weightRaw.trim() : null;
    const rampDays = rampDaysRaw ? parseInt(rampDaysRaw, 10) || 14 : 14;

    try {
        const [insertedExam] = await db
            .insert(exams)
            .values({
                userId: user.id,
                courseId,
                title,
                startsAt,
                venue,
                weight,
                rampDays,
            })
            .returning();

        revalidatePath(`/study/courses/${courseId}`);
        revalidatePath("/study/courses");
        revalidatePath("/");
        return { success: true, exam: insertedExam };
    } catch (error) {
        console.error("Failed to create exam:", error);
        return { error: "Failed to create exam" };
    }
}

export interface LogStudySessionInput {
    actualMinutes: number;
    plannedMinutes?: number | null;
    technique?: string | null;
    confidenceBefore?: number | null;
    confidenceAfter?: number | null;
    notes?: string | null;
}

export async function logStudySession(
    courseId: string,
    syllabusItemId: string,
    input: FormData | LogStudySessionInput
) {
    const user = await getCurrentUser();
    if (!user) {
        return { error: "Unauthorized" };
    }

    let actualMinutes = 25;
    let plannedMinutes: number | null = null;
    let technique = "Pomodoro";
    let confidenceBefore: number = 1;
    let confidenceAfter: number = 1;
    let notes: string | null = null;

    if (input instanceof FormData) {
        const actualMinRaw = input.get("actualMinutes") as string | null;
        if (actualMinRaw) actualMinutes = parseInt(actualMinRaw, 10) || 25;

        const plannedMinRaw = input.get("plannedMinutes") as string | null;
        if (plannedMinRaw) plannedMinutes = parseInt(plannedMinRaw, 10) || null;

        const techRaw = input.get("technique") as string | null;
        if (techRaw) technique = techRaw;

        const confBeforeRaw = input.get("confidenceBefore") as string | null;
        if (confBeforeRaw) confidenceBefore = parseInt(confBeforeRaw, 10) || 1;

        const confAfterRaw = input.get("confidenceAfter") as string | null;
        if (confAfterRaw) confidenceAfter = parseInt(confAfterRaw, 10) || 1;

        notes = (input.get("notes") as string) || null;
    } else {
        actualMinutes = input.actualMinutes;
        plannedMinutes = input.plannedMinutes ?? null;
        technique = input.technique ?? "Pomodoro";
        confidenceBefore = input.confidenceBefore ?? 1;
        confidenceAfter = input.confidenceAfter ?? 1;
        notes = input.notes ?? null;
    }

    try {
        // 1. Insert session record
        const [insertedSession] = await db
            .insert(studySessions)
            .values({
                userId: user.id,
                courseId,
                syllabusItemId: syllabusItemId || null,
                actualMinutes,
                plannedMinutes,
                technique,
                confidenceBefore,
                confidenceAfter,
                notes,
            })
            .returning();

        // 2. Automatically update syllabus item confidence
        if (syllabusItemId) {
            await db
                .update(syllabusItems)
                .set({
                    confidence: confidenceAfter,
                    updatedAt: new Date(),
                })
                .where(and(eq(syllabusItems.id, syllabusItemId), eq(syllabusItems.userId, user.id)));
        }

        revalidatePath(`/study/courses/${courseId}`);
        revalidatePath("/study/courses");
        return { success: true, session: insertedSession };
    } catch (error) {
        console.error("Failed to log study session:", error);
        return { error: "Failed to log study session" };
    }
}

export async function addResource(courseId: string, formData: FormData) {
    const user = await getCurrentUser();
    if (!user) {
        return { error: "Unauthorized" };
    }

    const title = ((formData.get("title") as string) || "").trim();
    const url = ((formData.get("url") as string) || "").trim();
    const resourceType = ((formData.get("resourceType") as string) || "link").trim();

    if (!title || !url) {
        return { error: "Title and URL are required" };
    }

    try {
        const [insertedResource] = await db
            .insert(courseResources)
            .values({
                userId: user.id,
                courseId,
                title,
                url,
                resourceType,
            })
            .returning();

        revalidatePath(`/study/courses/${courseId}`);
        revalidatePath("/study/courses");
        return { success: true, resource: insertedResource };
    } catch (error) {
        console.error("Failed to add course resource:", error);
        return { error: "Failed to add course resource" };
    }
}

export async function uploadResourceFile(courseId: string, formData: FormData) {
    const user = await getCurrentUser();
    if (!user) {
        return { error: "Unauthorized" };
    }

    const file = formData.get("file") as File | null;
    let title = ((formData.get("title") as string) || "").trim();

    if (!file || file.size === 0) {
        return { error: "Please select a valid file to upload" };
    }

    if (!title) {
        title = file.name;
    }

    // Determine type from file extension
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    let resourceType = "file";
    if (ext === "pdf") resourceType = "pdf";
    else if (["doc", "docx"].includes(ext)) resourceType = "doc";
    else if (["ppt", "pptx", "key"].includes(ext)) resourceType = "slides";
    else if (["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(ext)) resourceType = "image";
    else if (["mp4", "mov", "webm", "mkv"].includes(ext)) resourceType = "video";
    else if (["zip", "rar", "tar", "gz"].includes(ext)) resourceType = "archive";

    try {
        const supabase = await createClient();
        const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
        const filePath = `${user.id}/${courseId}/${Date.now()}-${safeName}`;

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const { error: uploadError } = await supabase.storage
            .from("course-resources")
            .upload(filePath, buffer, {
                contentType: file.type || "application/octet-stream",
                upsert: true,
            });

        if (uploadError) {
            console.error("Supabase storage upload error:", uploadError);
            return { error: `Upload failed: ${uploadError.message}` };
        }

        const { data: { publicUrl } } = supabase.storage
            .from("course-resources")
            .getPublicUrl(filePath);

        const [insertedResource] = await db
            .insert(courseResources)
            .values({
                userId: user.id,
                courseId,
                title,
                url: publicUrl,
                resourceType,
            })
            .returning();

        revalidatePath(`/study/courses/${courseId}`);
        revalidatePath("/study/courses");
        return { success: true, resource: insertedResource };
    } catch (error: any) {
        console.error("Failed to upload resource file:", error);
        return { error: error?.message || "Failed to upload file" };
    }
}

export async function addFlashcard(courseId: string, formData: FormData) {
    const user = await getCurrentUser();
    if (!user) {
        return { error: "Unauthorized" };
    }

    const front = ((formData.get("front") as string) || "").trim();
    const back = ((formData.get("back") as string) || "").trim();

    if (!front || !back) {
        return { error: "Front and Back are required for flashcards" };
    }

    try {
        const [insertedFlashcard] = await db
            .insert(flashcards)
            .values({
                userId: user.id,
                courseId,
                front,
                back,
                nextReviewAt: new Date(),
                intervalDays: 0,
            })
            .returning();

        revalidatePath(`/study/courses/${courseId}`);
        revalidatePath("/study/courses");
        return { success: true, flashcard: insertedFlashcard };
    } catch (error) {
        console.error("Failed to add flashcard:", error);
        return { error: "Failed to add flashcard" };
    }
}
