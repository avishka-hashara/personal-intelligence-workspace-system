"use server";

import { db } from "@/server/db";
import { courses, syllabusItems } from "@/server/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getCurrentUser } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

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
