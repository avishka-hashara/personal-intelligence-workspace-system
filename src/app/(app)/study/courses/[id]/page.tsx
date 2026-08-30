import { db } from "@/server/db";
import { courses, syllabusItems } from "@/server/db/schema";
import { eq, and, isNull, asc } from "drizzle-orm";
import { getCurrentUser } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  GraduationCap,
  Calendar,
  Award,
  BookOpen,
  FileText,
  Layers,
  Sparkles,
  UserCheck,
  CheckCircle2,
  FolderArchive,
  CreditCard,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { SyllabusManager } from "@/components/SyllabusManager";

interface CourseDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function CourseDetailPage({ params }: CourseDetailPageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { id } = await params;

  // 1. Fetch Course
  const [course] = await db
    .select()
    .from(courses)
    .where(
      and(
        eq(courses.id, id),
        eq(courses.userId, user.id),
        isNull(courses.deletedAt)
      )
    )
    .limit(1);

  if (!course) {
    redirect("/study/courses");
  }

  // 2. Fetch Syllabus Items
  const courseSyllabus = await db
    .select()
    .from(syllabusItems)
    .where(
      and(
        eq(syllabusItems.courseId, id),
        eq(syllabusItems.userId, user.id),
        isNull(syllabusItems.deletedAt)
      )
    )
    .orderBy(asc(syllabusItems.ordinal), asc(syllabusItems.createdAt));

  // Calculate syllabus coverage progress
  const totalItems = courseSyllabus.length;
  const coveredItems = courseSyllabus.filter(
    (item) => item.coverage === "covered" || item.coverage === "revised"
  ).length;
  const coveragePercentage = totalItems > 0 ? Math.round((coveredItems / totalItems) * 100) : 0;

  return (
    <div className="flex flex-col gap-8 pb-12">
      {/* Back to Courses Link */}
      <div>
        <Link
          href="/study/courses"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span>Back to Courses</span>
        </Link>
      </div>

      {/* Course Header */}
      <header className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100">
            {course.code}
          </span>

          {course.targetGrade && (
            <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Award className="w-3.5 h-3.5" />
              Target Grade: {course.targetGrade}
            </span>
          )}

          <span className="text-xs uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
            {course.active ? "Active" : "Archived"}
          </span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
          {course.title}
        </h1>

        <div className="flex flex-wrap items-center gap-4 mt-4 text-xs text-slate-500">
          {course.term && (
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-indigo-500" />
              <span>{course.term}</span>
            </span>
          )}

          {course.instructor && (
            <span className="flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-slate-400" />
              <span>Instructor: Prof. {course.instructor}</span>
            </span>
          )}

          {course.credits && (
            <span className="flex items-center gap-1.5">
              <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
              <span>{course.credits} Credits</span>
            </span>
          )}
        </div>

        {/* Syllabus Progress Bar */}
        <div className="mt-6 pt-6 border-t border-slate-100 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-700 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Syllabus Coverage
            </span>
            <span className="font-bold text-slate-900 font-mono text-sm">
              {coveragePercentage}%
            </span>
          </div>

          <Progress value={coveragePercentage} className="h-2.5 bg-slate-100" />

          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>
              {coveredItems} of {totalItems} topics covered/revised
            </span>
            <span>
              {totalItems - coveredItems} topics remaining
            </span>
          </div>
        </div>
      </header>

      {/* Tabs Container */}
      <Tabs defaultValue="syllabus" className="w-full space-y-6">
        <TabsList className="bg-slate-100/80 p-1 rounded-xl border border-slate-200/80 inline-flex">
          <TabsTrigger
            value="syllabus"
            className="text-xs font-semibold px-4 py-2 rounded-lg data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-xs transition-all"
          >
            <BookOpen className="w-3.5 h-3.5 mr-1.5 inline" />
            Syllabus ({totalItems})
          </TabsTrigger>
          <TabsTrigger
            value="resources"
            className="text-xs font-semibold px-4 py-2 rounded-lg data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-xs transition-all"
          >
            <FolderArchive className="w-3.5 h-3.5 mr-1.5 inline" />
            Resources
          </TabsTrigger>
          <TabsTrigger
            value="cards"
            className="text-xs font-semibold px-4 py-2 rounded-lg data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-xs transition-all"
          >
            <CreditCard className="w-3.5 h-3.5 mr-1.5 inline" />
            Cards
          </TabsTrigger>
          <TabsTrigger
            value="exams"
            className="text-xs font-semibold px-4 py-2 rounded-lg data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-xs transition-all"
          >
            <Calendar className="w-3.5 h-3.5 mr-1.5 inline" />
            Exams
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Syllabus */}
        <TabsContent value="syllabus" className="focus-visible:outline-none">
          <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Course Syllabus & Mastery</h2>
                <p className="text-xs text-slate-500">
                  Update coverage status and rate your confidence (1-5) for each topic.
                </p>
              </div>
            </div>

            <SyllabusManager
              courseId={course.id}
              initialItems={courseSyllabus}
            />
          </section>
        </TabsContent>

        {/* Tab 2: Resources Placeholder */}
        <TabsContent value="resources" className="focus-visible:outline-none">
          <section className="bg-white border border-slate-200 rounded-2xl p-8 shadow-xs text-center">
            <div className="border border-dashed border-slate-200 rounded-xl p-10 flex flex-col items-center justify-center gap-2 bg-slate-50/50">
              <FolderArchive className="w-8 h-8 text-slate-300" />
              <h3 className="text-sm font-bold text-slate-700">Course Resources & Materials</h3>
              <p className="text-xs text-slate-400 max-w-md">
                Upload lecture slides, problem sets, textbook chapters, and past notes attached to this course.
              </p>
            </div>
          </section>
        </TabsContent>

        {/* Tab 3: Flashcards Placeholder */}
        <TabsContent value="cards" className="focus-visible:outline-none">
          <section className="bg-white border border-slate-200 rounded-2xl p-8 shadow-xs text-center">
            <div className="border border-dashed border-slate-200 rounded-xl p-10 flex flex-col items-center justify-center gap-2 bg-slate-50/50">
              <CreditCard className="w-8 h-8 text-slate-300" />
              <h3 className="text-sm font-bold text-slate-700">Active Recall & Flashcards</h3>
              <p className="text-xs text-slate-400 max-w-md">
                Generate and review spaced-repetition flashcards mapped to your syllabus topics.
              </p>
            </div>
          </section>
        </TabsContent>

        {/* Tab 4: Exams Placeholder */}
        <TabsContent value="exams" className="focus-visible:outline-none">
          <section className="bg-white border border-slate-200 rounded-2xl p-8 shadow-xs text-center">
            <div className="border border-dashed border-slate-200 rounded-xl p-10 flex flex-col items-center justify-center gap-2 bg-slate-50/50">
              <Calendar className="w-8 h-8 text-slate-300" />
              <h3 className="text-sm font-bold text-slate-700">Exam Ramp Schedules</h3>
              <p className="text-xs text-slate-400 max-w-md">
                Set midterms and final dates with automatic ramp-up review schedules and grade weighting.
              </p>
            </div>
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}
