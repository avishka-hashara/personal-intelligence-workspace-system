"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  LayoutGrid,
  List,
  ChevronDown,
  ChevronRight,
  BookOpen,
  Calendar,
  Award,
  ArrowRight,
  GraduationCap,
  Sparkles,
} from "lucide-react";

export interface CourseItem {
  id: string;
  userId: string;
  code: string;
  title: string;
  term?: string | null;
  credits?: string | null;
  instructor?: string | null;
  colour?: string | null;
  targetGrade?: string | null;
  active: boolean;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
  deletedAt?: Date | string | null;
}

interface CoursesViewProps {
  courses: CourseItem[];
}

export function CoursesView({ courses }: CoursesViewProps) {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  // Load persisted view mode preference from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("piw_courses_view_mode");
      if (saved === "grid" || saved === "list") {
        setViewMode(saved);
      }
    } catch {}
  }, []);

  const handleViewChange = (mode: "grid" | "list") => {
    setViewMode(mode);
    try {
      localStorage.setItem("piw_courses_view_mode", mode);
    } catch {}
  };

  const toggleGroup = (code: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [code]: !prev[code],
    }));
  };

  // Group courses by Course Code, preserving order within each group
  const groupedCourses = useMemo(() => {
    const groups: { code: string; items: CourseItem[] }[] = [];
    const groupMap = new Map<string, CourseItem[]>();

    for (const course of courses) {
      const rawCode = (course.code || "").trim();
      const codeKey = rawCode.length > 0 ? rawCode : "Other";
      if (!groupMap.has(codeKey)) {
        const list: CourseItem[] = [];
        groupMap.set(codeKey, list);
        groups.push({ code: codeKey, items: list });
      }
      groupMap.get(codeKey)!.push(course);
    }

    return groups;
  }, [courses]);

  return (
    <section className="space-y-4">
      {/* Section Header with View Toggle */}
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Enrolled Courses
        </h2>

        {courses.length > 0 && (
          <div className="flex items-center gap-1 bg-zinc-100/80 dark:bg-zinc-800/80 p-1 rounded-xl border border-zinc-200/70 dark:border-zinc-700/70 text-xs font-medium">
            <button
              type="button"
              onClick={() => handleViewChange("grid")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                viewMode === "grid"
                  ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-2xs font-semibold"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Grid</span>
            </button>
            <button
              type="button"
              onClick={() => handleViewChange("list")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                viewMode === "list"
                  ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-2xs font-semibold"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
              }`}
              title="List View"
            >
              <List className="w-3.5 h-3.5" />
              <span>List</span>
            </button>
          </div>
        )}
      </div>

      {courses.length === 0 ? (
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
      ) : viewMode === "grid" ? (
        /* ---------------- Grid View (Original behavior) ---------------- */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map((course) => (
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
        /* ---------------- List View (Grouped by Course Code) ---------------- */
        <div className="space-y-3">
          {groupedCourses.map((group) => {
            const isCollapsed = Boolean(collapsedGroups[group.code]);

            return (
              <div
                key={group.code}
                className="bg-white dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800/70 rounded-2xl shadow-subtle overflow-hidden transition-all"
              >
                {/* Expandable Group Header */}
                <button
                  type="button"
                  onClick={() => toggleGroup(group.code)}
                  className="w-full flex items-center justify-between p-4 hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40 transition-colors text-left cursor-pointer select-none"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-1 rounded-lg text-zinc-400 dark:text-zinc-500 transition-colors">
                      {isCollapsed ? (
                        <ChevronRight className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </div>

                    <div className="flex items-center gap-2.5">
                      <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200/60 dark:border-zinc-700/60">
                        {group.code}
                      </span>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                        {group.items.length}{" "}
                        {group.items.length === 1 ? "course" : "courses"}
                      </span>
                    </div>
                  </div>

                  <span className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500">
                    {isCollapsed ? "Expand" : "Collapse"}
                  </span>
                </button>

                {/* Expanded Group Items */}
                {!isCollapsed && (
                  <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80 border-t border-zinc-100 dark:border-zinc-800/80">
                    {group.items.map((course) => (
                      <Link
                        key={course.id}
                        href={`/study/courses/${course.id}`}
                        className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200/60 dark:border-zinc-700/60 shrink-0 group-hover:bg-zinc-200 dark:group-hover:bg-zinc-700 transition-colors">
                            <BookOpen className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-zinc-950 dark:group-hover:text-white transition-colors truncate">
                                {course.title}
                              </h4>
                              {course.targetGrade && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                                  <Award className="w-3 h-3" />
                                  Target: {course.targetGrade}
                                </span>
                              )}
                            </div>
                            {course.instructor && (
                              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
                                Prof. {course.instructor}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 text-xs text-zinc-400 dark:text-zinc-500 pl-11 sm:pl-0">
                          <div className="flex items-center gap-1.5 font-medium">
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
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
