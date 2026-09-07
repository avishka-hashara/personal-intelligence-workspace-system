import { db } from "@/server/db";
import { courses } from "@/server/db/schema";
import { eq, and, isNull, desc } from "drizzle-orm";
import { getCurrentUser } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createCourse } from "@/server/actions/study";
import { Plus } from "lucide-react";
import { CoursesView } from "@/components/study/CoursesView";

export default async function CoursesPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const userCourses = await db
    .select()
    .from(courses)
    .where(
      and(
        eq(courses.userId, user.id),
        eq(courses.active, true),
        isNull(courses.deletedAt)
      )
    )
    .orderBy(desc(courses.createdAt));

  async function handleCreateCourse(formData: FormData) {
    "use server";
    await createCourse(formData);
  }

  return (
    <div className="flex flex-col gap-8 pb-12">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Study & Academics
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200/60 dark:border-zinc-700/60 font-medium font-mono">
              {userCourses.length} {userCourses.length === 1 ? "Course" : "Courses"}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mt-1">
            Courses & Syllabus
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Track course syllabus coverage, exam ramp schedules, and active recall mastery.
          </p>
        </div>
      </header>

      {/* Quick Add Course Form */}
      <section className="bg-white dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800/70 rounded-2xl p-5 sm:p-6 shadow-subtle">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200/60 dark:border-zinc-700/60">
            <Plus className="w-4 h-4" />
          </div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Add New Course</h2>
        </div>

        <form action={handleCreateCourse} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label htmlFor="code" className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
              Course Code *
            </label>
            <input
              id="code"
              name="code"
              type="text"
              required
              placeholder="e.g. CS 61A, MATH 101"
              className="w-full px-3 py-2 text-xs bg-zinc-50/70 dark:bg-zinc-800/50 border border-zinc-200/80 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:bg-white dark:focus:bg-zinc-800 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 transition-all font-mono"
            />
          </div>

          <div>
            <label htmlFor="title" className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
              Course Title *
            </label>
            <input
              id="title"
              name="title"
              type="text"
              required
              placeholder="e.g. Structure & Interpretation"
              className="w-full px-3 py-2 text-xs bg-zinc-50/70 dark:bg-zinc-800/50 border border-zinc-200/80 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:bg-white dark:focus:bg-zinc-800 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 transition-all"
            />
          </div>

          <div>
            <label htmlFor="term" className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
              Term / Semester
            </label>
            <input
              id="term"
              name="term"
              type="text"
              placeholder="e.g. Fall 2026, Semester 1"
              className="w-full px-3 py-2 text-xs bg-zinc-50/70 dark:bg-zinc-800/50 border border-zinc-200/80 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:bg-white dark:focus:bg-zinc-800 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 transition-all"
            />
          </div>

          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label htmlFor="targetGrade" className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
                Target Grade
              </label>
              <input
                id="targetGrade"
                name="targetGrade"
                type="text"
                placeholder="e.g. A+, 90%"
                className="w-full px-3 py-2 text-xs bg-zinc-50/70 dark:bg-zinc-800/50 border border-zinc-200/80 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:bg-white dark:focus:bg-zinc-800 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 transition-all"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 text-xs font-semibold rounded-xl shadow-subtle transition-all cursor-pointer shrink-0 h-[38px] flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </div>
        </form>
      </section>

      {/* Enrolled Courses Section (Grid & List View) */}
      <CoursesView courses={userCourses} />
    </div>
  );
}
