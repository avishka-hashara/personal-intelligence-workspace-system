import { db } from "@/server/db";
import { courses, syllabusItems, exams } from "@/server/db/schema";
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
  Plus,
  Clock,
  Zap,
  MapPin,
  Percent,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { SyllabusManager } from "@/components/SyllabusManager";
import { createExam } from "@/server/actions/study";
import { format, differenceInCalendarDays } from "date-fns";

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

  // 3. Fetch Exams
  const courseExams = await db
    .select()
    .from(exams)
    .where(
      and(
        eq(exams.courseId, id),
        eq(exams.userId, user.id),
        isNull(exams.deletedAt)
      )
    )
    .orderBy(asc(exams.startsAt));

  // Calculate syllabus coverage progress
  const totalItems = courseSyllabus.length;
  const coveredItems = courseSyllabus.filter(
    (item) => item.coverage === "covered" || item.coverage === "revised"
  ).length;
  const coveragePercentage = totalItems > 0 ? Math.round((coveredItems / totalItems) * 100) : 0;

  async function handleCreateExam(formData: FormData) {
    "use server";
    await createExam(id, formData);
  }

  const now = new Date();

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
            Exams ({courseExams.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Syllabus */}
        <TabsContent value="syllabus" className="focus-visible:outline-none">
          <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Course Syllabus & Mastery</h2>
                <p className="text-xs text-slate-500">
                  Update coverage status, rate confidence, and log study sessions for each topic.
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

        {/* Tab 4: Exams */}
        <TabsContent value="exams" className="focus-visible:outline-none space-y-6">
          {/* Add Exam Form */}
          <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
                <Plus className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-bold text-slate-900">Add Exam / Assessment</h2>
            </div>

            <form action={handleCreateExam} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="lg:col-span-2">
                <label htmlFor="examTitle" className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  Exam Title *
                </label>
                <input
                  id="examTitle"
                  name="title"
                  type="text"
                  required
                  placeholder="e.g. Midterm 1, Final Exam"
                  className="w-full px-3 py-2 text-xs bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all"
                />
              </div>

              <div>
                <label htmlFor="startsAt" className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  Date & Time *
                </label>
                <input
                  id="startsAt"
                  name="startsAt"
                  type="datetime-local"
                  required
                  className="w-full px-3 py-2 text-xs bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all"
                />
              </div>

              <div>
                <label htmlFor="weight" className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  Weight (% of Grade)
                </label>
                <input
                  id="weight"
                  name="weight"
                  type="number"
                  min="1"
                  max="100"
                  placeholder="e.g. 30"
                  className="w-full px-3 py-2 text-xs bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all"
                />
              </div>

              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label htmlFor="rampDays" className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    Ramp-up (Days)
                  </label>
                  <input
                    id="rampDays"
                    name="rampDays"
                    type="number"
                    min="1"
                    defaultValue={14}
                    className="w-full px-3 py-2 text-xs bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all"
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

          {/* Exams List */}
          <section className="space-y-4">
            <h2 className="text-base font-bold text-slate-900">Scheduled Exams & Ramp-ups</h2>

            {courseExams.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {courseExams.map((exam) => {
                  const examDate = exam.startsAt ? new Date(exam.startsAt) : null;
                  const daysRemaining = examDate ? differenceInCalendarDays(examDate, now) : 0;
                  const isPast = daysRemaining < 0;
                  const isRampActive = !isPast && daysRemaining <= (exam.rampDays || 14);

                  return (
                    <div
                      key={exam.id}
                      className={`border rounded-2xl p-5 shadow-xs transition-all flex flex-col justify-between ${
                        isRampActive
                          ? "bg-amber-50/40 border-amber-200/80 shadow-amber-50"
                          : "bg-white border-slate-200"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <h3 className="text-sm font-bold text-slate-900">
                            {exam.title}
                          </h3>

                          {/* Status / Ramp Badge */}
                          {isPast ? (
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                              Past Exam
                            </span>
                          ) : isRampActive ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                              <Zap className="w-3 h-3 text-amber-600 fill-amber-600" />
                              Ramp-up Active ({daysRemaining}d left)
                            </span>
                          ) : (
                            <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                              {daysRemaining} days away
                            </span>
                          )}
                        </div>

                        {examDate && (
                          <p className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                            <span>{format(examDate, "EEEE, MMMM d, yyyy 'at' p")}</span>
                          </p>
                        )}
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100/80 flex items-center justify-between text-xs text-slate-500">
                        <div className="flex items-center gap-3">
                          {exam.weight && (
                            <span className="inline-flex items-center gap-1 font-mono font-medium text-slate-700">
                              <Percent className="w-3 h-3 text-slate-400" />
                              {exam.weight}% weight
                            </span>
                          )}
                          <span className="text-slate-400">
                            {exam.rampDays || 14}d ramp schedule
                          </span>
                        </div>

                        {exam.venue && (
                          <span className="inline-flex items-center gap-1 text-slate-600">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            {exam.venue}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="border border-dashed border-slate-200 rounded-2xl p-10 text-center bg-slate-50/50 flex flex-col items-center justify-center gap-2">
                <Calendar className="w-8 h-8 text-slate-300" />
                <h3 className="text-sm font-bold text-slate-700">No exams scheduled</h3>
                <p className="text-xs text-slate-400 max-w-md">
                  Add midterms, finals, or assessments above to enable automated ramp-up review alerts.
                </p>
              </div>
            )}
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}
