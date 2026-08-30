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
          <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-12 text-center flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div className="max-w-md">
              <h3 className="text-base font-bold text-slate-900">No courses added yet</h3>
              <p className="text-xs text-slate-500 mt-1">
                Add your current courses above to start tracking topic coverage, scheduled weeks, and exam preparation.
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
