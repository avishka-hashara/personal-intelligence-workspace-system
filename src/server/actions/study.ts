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
import { eq, and, desc, asc, isNull } from "drizzle-orm";
import { getCurrentUser, createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { generateNodeEmbedding } from "@/lib/embeddings";
import {
    fsrs,
    generatorParameters,
    Rating,
    State,
    createEmptyCard,
    dateDiffInDays,
    type Card as FSRSCard,
    type Grade,
} from "ts-fsrs";
import { differenceInCalendarDays } from "date-fns";

const fsrsScheduler = fsrs(
    generatorParameters({
        request_retention: 0.9,
        maximum_interval: 36500,
    })
);

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
                stability: "0",
                difficulty: "0",
                reps: 0,
                lapses: 0,
                state: State.New,
                lastReview: null,
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

export interface DueFlashcardItem {
    id: string;
    userId: string;
    courseId: string;
    front: string;
    back: string;
    nextReviewAt: Date | null;
    intervalDays: number | null;
    stability: string | null;
    difficulty: string | null;
    reps: number | null;
    lapses: number | null;
    state: number | null;
    lastReview: Date | null;
    createdAt: Date;
    updatedAt: Date;
    isDue: boolean;
    dueReason: "standard" | "exam_ramp" | "not_due";
    retrievabilityAtExam: number | null;
}

export interface GetDueFlashcardsResponse {
    success: boolean;
    error?: string;
    examMode: boolean;
    targetExam: {
        id: string;
        title: string;
        startsAt: Date | null;
        rampDays: number;
        daysUntilExam: number;
    } | null;
    totalCards: number;
    dueCount: number;
    dueCards: DueFlashcardItem[];
    allCards: DueFlashcardItem[];
}

export async function getDueFlashcards(courseId: string): Promise<GetDueFlashcardsResponse> {
    const user = await getCurrentUser();
    if (!user) {
        return {
            success: false,
            error: "Unauthorized",
            examMode: false,
            targetExam: null,
            totalCards: 0,
            dueCount: 0,
            dueCards: [],
            allCards: [],
        };
    }

    try {
        const now = new Date();

        // 1. Fetch all flashcards for this course
        const allCardRows = await db
            .select()
            .from(flashcards)
            .where(
                and(
                    eq(flashcards.courseId, courseId),
                    eq(flashcards.userId, user.id),
                    isNull(flashcards.deletedAt)
                )
            )
            .orderBy(asc(flashcards.nextReviewAt), desc(flashcards.createdAt));

        // 2. Query exams for this course to evaluate Exam Mode
        const examRows = await db
            .select()
            .from(exams)
            .where(
                and(
                    eq(exams.courseId, courseId),
                    eq(exams.userId, user.id),
                    isNull(exams.deletedAt)
                )
            )
            .orderBy(asc(exams.startsAt));

        // Find nearest upcoming exam
        const upcomingExams = examRows.filter(
            (e) => e.startsAt && (new Date(e.startsAt).getTime() >= now.getTime() || differenceInCalendarDays(new Date(e.startsAt), now) >= 0)
        );

        const nearestExam = upcomingExams.length > 0 ? upcomingExams[0] : null;
        let examMode = false;
        let targetExamInfo: GetDueFlashcardsResponse["targetExam"] = null;

        if (nearestExam && nearestExam.startsAt) {
            const examDate = new Date(nearestExam.startsAt);
            const daysUntil = differenceInCalendarDays(examDate, now);
            const rampDays = nearestExam.rampDays ?? 14;

            if (daysUntil >= 0 && daysUntil <= rampDays) {
                examMode = true;
                targetExamInfo = {
                    id: nearestExam.id,
                    title: nearestExam.title,
                    startsAt: examDate,
                    rampDays,
                    daysUntilExam: daysUntil,
                };
            }
        }

        // 3. Process each card with FSRS
        const processedCards: DueFlashcardItem[] = allCardRows.map((card) => {
            const isStandardDue =
                !card.nextReviewAt ||
                new Date(card.nextReviewAt).getTime() <= now.getTime() ||
                card.state === State.New ||
                !card.stability ||
                card.stability === "0";

            let isDue = isStandardDue;
            let dueReason: "standard" | "exam_ramp" | "not_due" = isStandardDue
                ? "standard"
                : "not_due";
            let retrievabilityAtExam: number | null = null;

            if (examMode && targetExamInfo?.startsAt) {
                const examDate = new Date(targetExamInfo.startsAt);

                if (
                    card.state === State.New ||
                    !card.lastReview ||
                    !card.stability ||
                    Number(card.stability) <= 0
                ) {
                    // Unreviewed or new card has 0% predicted retention at exam date
                    retrievabilityAtExam = 0;
                    isDue = true;
                    dueReason = isStandardDue ? "standard" : "exam_ramp";
                } else {
                    const fsrsCard: FSRSCard = {
                        due: card.nextReviewAt ? new Date(card.nextReviewAt) : new Date(card.createdAt),
                        stability: Number(card.stability),
                        difficulty: Number(card.difficulty) || 4.0,
                        elapsed_days: 0,
                        scheduled_days: card.intervalDays || 0,
                        reps: card.reps || 0,
                        lapses: card.lapses || 0,
                        learning_steps: 0,
                        state: card.state ?? State.Review,
                        last_review: card.lastReview ? new Date(card.lastReview) : new Date(card.createdAt),
                    };

                    const rRaw = fsrsScheduler.get_retrievability(fsrsCard, examDate, false);
                    const r = typeof rRaw === "number" && !isNaN(rRaw) ? rRaw : 0;
                    retrievabilityAtExam = Math.round(r * 1000) / 1000;

                    // If retrievability is below 0.85 (85%), pull forward into due queue
                    if (r < 0.85) {
                        isDue = true;
                        dueReason = isStandardDue ? "standard" : "exam_ramp";
                    } else if (isStandardDue) {
                        isDue = true;
                        dueReason = "standard";
                    } else {
                        isDue = false;
                        dueReason = "not_due";
                    }
                }
            }

            return {
                id: card.id,
                userId: card.userId,
                courseId: card.courseId,
                front: card.front,
                back: card.back,
                nextReviewAt: card.nextReviewAt,
                intervalDays: card.intervalDays,
                stability: card.stability,
                difficulty: card.difficulty,
                reps: card.reps,
                lapses: card.lapses,
                state: card.state,
                lastReview: card.lastReview,
                createdAt: card.createdAt,
                updatedAt: card.updatedAt,
                isDue,
                dueReason,
                retrievabilityAtExam,
            };
        });

        const dueCards = processedCards.filter((c) => c.isDue);

        return {
            success: true,
            examMode,
            targetExam: targetExamInfo,
            totalCards: processedCards.length,
            dueCount: dueCards.length,
            dueCards,
            allCards: processedCards,
        };
    } catch (error) {
        console.error("Failed to get due flashcards:", error);
        return {
            success: false,
            error: "Failed to get due flashcards",
            examMode: false,
            targetExam: null,
            totalCards: 0,
            dueCount: 0,
            dueCards: [],
            allCards: [],
        };
    }
}

export async function reviewFlashcard(cardId: string, rating: number) {
    const user = await getCurrentUser();
    if (!user) {
        return { error: "Unauthorized" };
    }

    if (![Rating.Again, Rating.Hard, Rating.Good, Rating.Easy].includes(rating as any)) {
        return { error: "Invalid rating. Must be 1 (Again), 2 (Hard), 3 (Good), or 4 (Easy)." };
    }

    try {
        const [card] = await db
            .select()
            .from(flashcards)
            .where(
                and(
                    eq(flashcards.id, cardId),
                    eq(flashcards.userId, user.id),
                    isNull(flashcards.deletedAt)
                )
            )
            .limit(1);

        if (!card) {
            return { error: "Flashcard not found" };
        }

        const now = new Date();
        const fsrsCard: FSRSCard = {
            due: card.nextReviewAt ? new Date(card.nextReviewAt) : now,
            stability: card.stability ? Number(card.stability) : 0,
            difficulty: card.difficulty ? Number(card.difficulty) : 0,
            elapsed_days: card.lastReview
                ? Math.max(0, differenceInCalendarDays(now, new Date(card.lastReview)))
                : 0,
            scheduled_days: card.intervalDays || 0,
            reps: card.reps || 0,
            lapses: card.lapses || 0,
            learning_steps: 0,
            state: card.state !== null && card.state !== undefined ? card.state : State.New,
            last_review: card.lastReview ? new Date(card.lastReview) : undefined,
        };

        const record = fsrsScheduler.repeat(fsrsCard, now);
        const updatedFSRS = record[rating as Grade].card;

        const nextIntervalDays = Math.max(
            0,
            Math.round(dateDiffInDays(updatedFSRS.due, now))
        );

        const [updatedCard] = await db
            .update(flashcards)
            .set({
                stability: updatedFSRS.stability.toFixed(4),
                difficulty: updatedFSRS.difficulty.toFixed(4),
                reps: updatedFSRS.reps,
                lapses: updatedFSRS.lapses,
                state: updatedFSRS.state,
                lastReview: now,
                nextReviewAt: updatedFSRS.due,
                intervalDays: nextIntervalDays,
                updatedAt: now,
            })
            .where(and(eq(flashcards.id, cardId), eq(flashcards.userId, user.id)))
            .returning();

        revalidatePath(`/study/courses/${card.courseId}`);
        revalidatePath("/study/courses");
        return { success: true, card: updatedCard };
    } catch (error: any) {
        console.error("Failed to review flashcard:", error);
        return { error: error?.message || "Failed to review flashcard" };
    }
}

