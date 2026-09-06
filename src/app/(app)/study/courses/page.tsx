import { db } from "@/server/db";
import { courses } from "@/server/db/schema";
import { eq, and, isNull, desc } from "drizzle-orm";
import { getCurrentUser } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createCourse } from "@/server/actions/study";
import {
  GraduationCap,
  BookOpen,
  Plus,
  Calendar,
  Award,
  ArrowRight,
  Sparkles,
} from "lucide-react";

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

      {/* Courses Grid */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Enrolled Courses</h2>

        {userCourses.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {userCourses.map((course) => (
              <Link
                key={course.id}
                href={`/study/courses/${course.id}`}
                className="group bg-white dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800/70 hover:border-zinc-300 dark:hover:border-zinc-700 rounded-2xl p-5 shadow-subtle hover:shadow-float transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200/60 dark:border-zinc-700/60 group-hover:bg-zinc-200 dark:group-hover:bg-zinc-700 transition-colors">
                      {course.code}
                    </span>

                    {course.targetGrade && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                        <Award className="w-3 h-3" />
                        Target: {course.targetGrade}
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-zinc-950 dark:group-hover:text-white transition-colors line-clamp-1">
                    {course.title}
                  </h3>

                  {course.instructor && (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                      Prof. {course.instructor}
                    </p>
                  )}
                </div>

                <div className="mt-5 pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-xs text-zinc-400 dark:text-zinc-500">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{course.term || "Active Term"}</span>
                  </div>

                  <span className="inline-flex items-center gap-1 font-medium text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 group-hover:translate-x-0.5 transition-all">
                    <span>View Syllabus</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="bg-zinc-50/50 dark:bg-zinc-900/40 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 sm:p-12 text-center flex flex-col items-center justify-center gap-6">
            <div className="w-16 h-16 rounded-3xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center shadow-subtle">
              <GraduationCap className="w-8 h-8" />
            </div>

            <div className="max-w-lg space-y-2">
              <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                Add your first course to unlock intelligent study
              </h3>
              <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Courses are the backbone of your academic workspace. Adding a course lets you paste syllabus topics, track confidence ratings, run FSRS spaced repetition flashcards, and set up exam countdown ramps.
              </p>
            </div>

            {/* 3 Step Academic Journey */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-xl text-left pt-2">
              <div className="p-3.5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800/70 shadow-2xs">
                <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">1. Structure</div>
                <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Add Course & Code</div>
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">Define term, credit weight, and target grade.</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800/70 shadow-2xs">
                <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">2. Syllabus</div>
                <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Map Topics & Weeks</div>
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">Track topic coverage from not started to revised.</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800/70 shadow-2xs">
                <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">3. Active Recall</div>
                <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">AI Quizzes & Cards</div>
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">Generate flashcards and retain knowledge with FSRS.</div>
              </div>
            </div>

            <div className="pt-2 text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-zinc-500" />
              <span>Use the form above to add your first course</span>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
