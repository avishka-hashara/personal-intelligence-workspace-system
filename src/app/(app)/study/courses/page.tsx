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
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Study & Academics
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-medium">
              {userCourses.length} {userCourses.length === 1 ? "Course" : "Courses"}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mt-1">
            Courses & Syllabus
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Track course syllabus coverage, exam ramp schedules, and active recall mastery.
          </p>
        </div>
      </header>

      {/* Quick Add Course Form */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
            <Plus className="w-4 h-4" />
          </div>
          <h2 className="text-sm font-bold text-slate-900">Add New Course</h2>
        </div>

        <form action={handleCreateCourse} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label htmlFor="code" className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
              Course Code *
            </label>
            <input
              id="code"
              name="code"
              type="text"
              required
              placeholder="e.g. CS 61A, MATH 101"
              className="w-full px-3 py-2 text-xs bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all font-mono"
            />
          </div>

          <div>
            <label htmlFor="title" className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
              Course Title *
            </label>
            <input
              id="title"
              name="title"
              type="text"
              required
              placeholder="e.g. Structure & Interpretation"
              className="w-full px-3 py-2 text-xs bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all"
            />
          </div>

          <div>
            <label htmlFor="term" className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
              Term / Semester
            </label>
            <input
              id="term"
              name="term"
              type="text"
              placeholder="e.g. Fall 2026, Semester 1"
              className="w-full px-3 py-2 text-xs bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all"
            />
          </div>

          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label htmlFor="targetGrade" className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                Target Grade
              </label>
              <input
                id="targetGrade"
                name="targetGrade"
                type="text"
                placeholder="e.g. A+, 90%"
                className="w-full px-3 py-2 text-xs bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer shrink-0 h-[38px] flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </div>
        </form>
      </section>

      {/* Courses Grid */}
      <section className="space-y-4">
        <h2 className="text-base font-bold text-slate-900">Enrolled Courses</h2>

        {userCourses.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {userCourses.map((course) => (
              <Link
                key={course.id}
                href={`/study/courses/${course.id}`}
                className="group bg-white border border-slate-200 hover:border-slate-300 rounded-2xl p-5 shadow-xs hover:shadow transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100 group-hover:bg-indigo-100/80 transition-colors">
                      {course.code}
                    </span>

                    {course.targetGrade && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <Award className="w-3 h-3" />
                        Target: {course.targetGrade}
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1">
                    {course.title}
                  </h3>

                  {course.instructor && (
                    <p className="text-xs text-slate-500 mt-1">
                      Prof. {course.instructor}
                    </p>
                  )}
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{course.term || "Active Term"}</span>
                  </div>

                  <span className="inline-flex items-center gap-1 font-medium text-slate-500 group-hover:text-slate-900 group-hover:translate-x-0.5 transition-all">
                    <span>View Syllabus</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="bg-gradient-to-b from-indigo-50/40 via-white to-slate-50/50 border-2 border-dashed border-indigo-200/80 rounded-3xl p-8 sm:p-12 text-center flex flex-col items-center justify-center gap-6">
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <GraduationCap className="w-8 h-8" />
            </div>

            <div className="max-w-lg space-y-2">
              <h3 className="text-xl font-bold text-slate-900 tracking-tight">
                Add your first course to unlock intelligent study
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Courses are the backbone of your academic workspace. Adding a course lets you paste syllabus topics, track confidence ratings, run FSRS spaced repetition flashcards, and set up exam countdown ramps.
              </p>
            </div>

            {/* 3 Step Academic Journey */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-xl text-left pt-2">
              <div className="p-3.5 rounded-2xl bg-white border border-indigo-100 shadow-2xs">
                <div className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider mb-1">1. Structure</div>
                <div className="text-xs font-semibold text-slate-900">Add Course & Code</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Define term, credit weight, and target grade.</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-white border border-indigo-100 shadow-2xs">
                <div className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider mb-1">2. Syllabus</div>
                <div className="text-xs font-semibold text-slate-900">Map Topics & Weeks</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Track topic coverage from not started to revised.</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-white border border-indigo-100 shadow-2xs">
                <div className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider mb-1">3. Active Recall</div>
                <div className="text-xs font-semibold text-slate-900">AI Quizzes & Cards</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Generate flashcards and retain knowledge with FSRS.</div>
              </div>
            </div>

            <div className="pt-2 text-xs text-slate-500 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>Use the form above to add your first course</span>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
