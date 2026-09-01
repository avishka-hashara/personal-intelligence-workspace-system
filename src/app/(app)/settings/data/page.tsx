import { getCurrentUser } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { courses } from "@/server/db/schema";
import { eq, and, isNull, asc } from "drizzle-orm";
import { DataImportManager } from "@/components/settings/DataImportManager";

export const metadata = {
  title: "Data Import | Settings | Personal Intelligence Workspace",
  description: "Import tasks from Todoist CSV and flashcards from Anki TSV.",
};

export default async function DataSettingsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  // Fetch active courses for Anki TSV target selection
  const userCourses = await db
    .select({
      id: courses.id,
      code: courses.code,
      title: courses.title,
    })
    .from(courses)
    .where(and(eq(courses.userId, user.id), eq(courses.active, true), isNull(courses.deletedAt)))
    .orderBy(asc(courses.code));

  return (
    <div className="p-4 sm:p-8 min-h-screen bg-slate-50/50">
      <DataImportManager coursesList={userCourses} />
    </div>
  );
}
