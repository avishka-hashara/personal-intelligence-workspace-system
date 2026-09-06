import { db } from "@/server/db";
import {
  courses,
  syllabusItems,
  exams,
  courseResources,
  flashcards,
  chunks,
} from "@/server/db/schema";
import { eq, and, isNull, asc, desc, inArray, sql } from "drizzle-orm";
import { getCurrentUser } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ResourceCard } from "@/components/study/ResourceCard";
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
  ExternalLink,
  Video,
  Link2,
  FileCode,
  File,
  Download,
  Loader2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { SyllabusManager } from "@/components/SyllabusManager";
import { FlashcardList } from "@/components/FlashcardList";
import { ResourceUploader } from "@/components/ResourceUploader";
import { createExam, addFlashcard, getDueFlashcards } from "@/server/actions/study";
import { reindexResource } from "@/server/actions/indexing";
import { format, differenceInCalendarDays, formatDistanceToNow } from "date-fns";
import { ContextSetter } from "@/components/ContextSetter";

function summarizeCourse(
  course: any,
  syllabus: any[],
  examsList: any[]
): string {
  const parts: string[] = [];
  if (course.code) parts.push(`Code: ${course.code}`);
  if (course.term) parts.push(`Term: ${course.term}`);
  if (course.targetGrade) parts.push(`Target Grade: ${course.targetGrade}`);
  if (course.description) parts.push(`Description: ${course.description}`);
  if (syllabus && syllabus.length > 0) {
    const items = syllabus
      .map((s) => `${s.title} (${s.coverage || "uncovered"})`)
      .slice(0, 15)
      .join(", ");
    parts.push(`Syllabus Modules (${syllabus.length} total): ${items}`);
  }
  if (examsList && examsList.length > 0) {
    const examSummary = examsList
      .map(
        (e) =>
          `${e.title} (Weight: ${e.weight ? `${e.weight}%` : "N/A"}, Date: ${
            e.startsAt ? format(new Date(e.startsAt), "yyyy-MM-dd") : "TBD"
          })`
      )
      .join(", ");
    parts.push(`Upcoming Exams: ${examSummary}`);
  }
  return parts.join("\n");
}

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

  // 4. Fetch Course Resources
  const resources = await db
    .select()
    .from(courseResources)
    .where(
      and(
        eq(courseResources.courseId, id),
        eq(courseResources.userId, user.id),
        isNull(courseResources.deletedAt)
      )
    )
    .orderBy(desc(courseResources.createdAt));

  // 4b. Fetch Knowledge Graph chunk counts for resources
  const resourceIds = resources.map((r) => r.id);
  const chunkCountMap: Record<string, number> = {};

  if (resourceIds.length > 0) {
    const chunkCounts = await db
      .select({
        entityId: chunks.entityId,
        chunkCount: sql<number>`count(*)::int`,
      })
      .from(chunks)
      .where(
        and(
          eq(chunks.userId, user.id),
          eq(chunks.entityType, "resource"),
          inArray(chunks.entityId, resourceIds)
        )
      )
      .groupBy(chunks.entityId);

    for (const c of chunkCounts) {
      chunkCountMap[c.entityId] = c.chunkCount;
    }
  }

  // 5. Fetch Flashcards & FSRS Schedule (including Exam Ramp calculation)
  const dueFlashcardData = await getDueFlashcards(id);
  const cards = dueFlashcardData.allCards;

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

  async function handleAddFlashcard(formData: FormData) {
    "use server";
    await addFlashcard(id, formData);
  }

  const now = new Date();

  return (
    <div className="flex flex-col gap-8 pb-12">
      <ContextSetter
        type="Course"
        id={course.id}
        title={course.title}
        data={summarizeCourse(course, courseSyllabus, courseExams)}
      />
      {/* Back to Courses Link */}
      <div>
        <Link
          href="/study/courses"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span>Back to Courses</span>
        </Link>
      </div>

      {/* Course Header */}
      <header className="bg-white dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800/70 rounded-2xl p-6 sm:p-8 shadow-subtle">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200/60 dark:border-zinc-700/60">
            {course.code}
          </span>

          {course.targetGrade && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
              <Award className="w-3.5 h-3.5" />
              Target Grade: {course.targetGrade}
            </span>
          )}

          <span className="text-xs uppercase font-semibold tracking-wider px-2.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200/60 dark:border-zinc-700/60">
            {course.active ? "Active" : "Archived"}
          </span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
          {course.title}
        </h1>

        <div className="flex flex-wrap items-center gap-4 mt-4 text-xs text-zinc-500 dark:text-zinc-400">
          {course.term && (
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-zinc-400" />
              <span>{course.term}</span>
            </span>
          )}

          {course.instructor && (
            <span className="flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-zinc-400" />
              <span>Instructor: Prof. {course.instructor}</span>
            </span>
          )}

          {course.credits && (
            <span className="flex items-center gap-1.5">
              <GraduationCap className="w-3.5 h-3.5 text-zinc-400" />
              <span>{course.credits} Credits</span>
            </span>
          )}
        </div>

        {/* Syllabus Progress Bar */}
        <div className="mt-6 pt-6 border-t border-zinc-100 dark:border-zinc-800/80 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              Syllabus Coverage
            </span>
            <span className="font-semibold text-zinc-900 dark:text-zinc-100 font-mono text-sm">
              {coveragePercentage}%
            </span>
          </div>

          <Progress value={coveragePercentage} className="h-1.5 bg-zinc-100 dark:bg-zinc-800" />

          <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 dark:text-zinc-500">
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
        <TabsList className="bg-zinc-100/80 dark:bg-zinc-800/80 p-1 rounded-xl border border-zinc-200/60 dark:border-zinc-700/60 inline-flex">
          <TabsTrigger
            value="syllabus"
            className="text-xs font-medium px-4 py-2 rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-900 data-[state=active]:text-zinc-900 dark:data-[state=active]:text-zinc-100 data-[state=active]:shadow-2xs transition-all cursor-pointer"
          >
            <BookOpen className="w-3.5 h-3.5 mr-1.5 inline" />
            Syllabus ({totalItems})
          </TabsTrigger>
          <TabsTrigger
            value="resources"
            className="text-xs font-medium px-4 py-2 rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-900 data-[state=active]:text-zinc-900 dark:data-[state=active]:text-zinc-100 data-[state=active]:shadow-2xs transition-all cursor-pointer"
          >
            <FolderArchive className="w-3.5 h-3.5 mr-1.5 inline" />
            Resources ({resources.length})
          </TabsTrigger>
          <TabsTrigger
            value="cards"
            className="text-xs font-medium px-4 py-2 rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-900 data-[state=active]:text-zinc-900 dark:data-[state=active]:text-zinc-100 data-[state=active]:shadow-2xs transition-all cursor-pointer flex items-center gap-1.5"
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Cards ({cards.length})</span>
            {dueFlashcardData.dueCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-white">
                {dueFlashcardData.dueCount} due
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="exams"
            className="text-xs font-medium px-4 py-2 rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-900 data-[state=active]:text-zinc-900 dark:data-[state=active]:text-zinc-100 data-[state=active]:shadow-2xs transition-all cursor-pointer"
          >
            <Calendar className="w-3.5 h-3.5 mr-1.5 inline" />
            Exams ({courseExams.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Syllabus */}
        <TabsContent value="syllabus" className="focus-visible:outline-none">
          <section className="bg-white dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800/70 rounded-2xl p-6 shadow-subtle space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Course Syllabus & Mastery</h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
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

        {/* Tab 2: Resources */}
        <TabsContent value="resources" className="focus-visible:outline-none space-y-6">
          {/* Add / Upload Resource Component */}
          <ResourceUploader courseId={course.id} />

          {/* Resources List */}
          <section className="space-y-4">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Attached Course Files & Links</h2>

            {resources.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {resources.map((res) => (
                  <ResourceCard
                    key={res.id}
                    resource={res}
                    courseId={course.id}
                    chunkCount={chunkCountMap[res.id] || 0}
                  />
                ))}
              </div>
            ) : (
              <div className="border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl p-10 text-center bg-zinc-50/50 dark:bg-zinc-900/40 flex flex-col items-center justify-center gap-2">
                <FolderArchive className="w-8 h-8 text-zinc-300 dark:text-zinc-600" />
                <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">No resources attached yet</h3>
                <p className="text-xs text-zinc-400 dark:text-zinc-500 max-w-md">
                  Upload lecture PDF slides, Word docs, past notes, or paste Google Drive links above.
                </p>
              </div>
            )}
          </section>
        </TabsContent>

        {/* Tab 3: Flashcards */}
        <TabsContent value="cards" className="focus-visible:outline-none space-y-6">
          {/* Add Flashcard Form */}
          <section className="bg-white dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800/70 rounded-2xl p-5 sm:p-6 shadow-subtle">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200/60 dark:border-zinc-700/60">
                <Plus className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Create Flashcard</h2>
            </div>

            <form action={handleAddFlashcard} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="cardFront" className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
                  Front (Question / Prompt) *
                </label>
                <textarea
                  id="cardFront"
                  name="front"
                  required
                  rows={2}
                  placeholder="e.g. What is the time complexity of searching a balanced BST?"
                  className="w-full px-3 py-2 text-xs bg-zinc-50/70 dark:bg-zinc-800/50 border border-zinc-200/80 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:bg-white dark:focus:bg-zinc-800 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 transition-all resize-none"
                />
              </div>

              <div>
                <label htmlFor="cardBack" className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
                  Back (Answer / Definition) *
                </label>
                <textarea
                  id="cardBack"
                  name="back"
                  required
                  rows={2}
                  placeholder="e.g. O(log n) average and worst-case for balanced BSTs."
                  className="w-full px-3 py-2 text-xs bg-zinc-50/70 dark:bg-zinc-800/50 border border-zinc-200/80 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:bg-white dark:focus:bg-zinc-800 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 transition-all resize-none"
                />
              </div>

              <div className="md:col-span-2 flex justify-end">
                <button
                  type="submit"
                  className="px-5 py-2 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 text-xs font-semibold rounded-xl shadow-subtle transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Flashcard</span>
                </button>
              </div>
            </form>
          </section>

          {/* Flashcards Grid */}
          <section className="space-y-4">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Spaced Repetition Flashcards</h2>
            <FlashcardList
              cards={dueFlashcardData.allCards}
              examMode={dueFlashcardData.examMode}
              targetExamTitle={dueFlashcardData.targetExam?.title}
              daysUntilExam={dueFlashcardData.targetExam?.daysUntilExam}
            />
          </section>
        </TabsContent>

        {/* Tab 4: Exams */}
        <TabsContent value="exams" className="focus-visible:outline-none space-y-6">
          {/* Add Exam Form */}
          <section className="bg-white dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800/70 rounded-2xl p-5 sm:p-6 shadow-subtle">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200/60 dark:border-zinc-700/60">
                <Plus className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Add Exam / Assessment</h2>
            </div>

            <form action={handleCreateExam} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="lg:col-span-2">
                <label htmlFor="examTitle" className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
                  Exam Title *
                </label>
                <input
                  id="examTitle"
                  name="title"
                  type="text"
                  required
                  placeholder="e.g. Midterm 1, Final Exam"
                  className="w-full px-3 py-2 text-xs bg-zinc-50/70 dark:bg-zinc-800/50 border border-zinc-200/80 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:bg-white dark:focus:bg-zinc-800 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 transition-all"
                />
              </div>

              <div>
                <label htmlFor="startsAt" className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
                  Date & Time *
                </label>
                <input
                  id="startsAt"
                  name="startsAt"
                  type="datetime-local"
                  required
                  className="w-full px-3 py-2 text-xs bg-zinc-50/70 dark:bg-zinc-800/50 border border-zinc-200/80 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 focus:bg-white dark:focus:bg-zinc-800 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 transition-all"
                />
              </div>

              <div>
                <label htmlFor="weight" className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
                  Weight (% of Grade)
                </label>
                <input
                  id="weight"
                  name="weight"
                  type="number"
                  min="1"
                  max="100"
                  placeholder="e.g. 30"
                  className="w-full px-3 py-2 text-xs bg-zinc-50/70 dark:bg-zinc-800/50 border border-zinc-200/80 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:bg-white dark:focus:bg-zinc-800 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 transition-all font-mono"
                />
              </div>

              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label htmlFor="rampDays" className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
                    Ramp-up (Days)
                  </label>
                  <input
                    id="rampDays"
                    name="rampDays"
                    type="number"
                    min="1"
                    defaultValue={14}
                    className="w-full px-3 py-2 text-xs bg-zinc-50/70 dark:bg-zinc-800/50 border border-zinc-200/80 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 focus:bg-white dark:focus:bg-zinc-800 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 transition-all font-mono"
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

          {/* Exams List */}
          <section className="space-y-4">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Scheduled Exams & Ramp-ups</h2>

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
                      className={`border rounded-2xl p-5 shadow-subtle hover:shadow-float transition-all flex flex-col justify-between ${
                        isRampActive
                          ? "bg-white dark:bg-zinc-900 border-amber-400/60 dark:border-amber-500/30 ring-1 ring-amber-400/20"
                          : "bg-white dark:bg-zinc-900 border-zinc-200/70 dark:border-zinc-800/70"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                            {exam.title}
                          </h3>

                          {/* Status / Ramp Badge */}
                          {isPast ? (
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200/60 dark:border-zinc-700/60">
                              Past Exam
                            </span>
                          ) : isRampActive ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                              <Zap className="w-3 h-3 text-amber-500 fill-amber-500" />
                              Ramp-up Active ({daysRemaining}d left)
                            </span>
                          ) : (
                            <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200/60 dark:border-zinc-700/60 font-mono">
                              {daysRemaining} days away
                            </span>
                          )}
                        </div>

                        {examDate && (
                          <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                            <span>{format(examDate, "EEEE, MMMM d, yyyy 'at' p")}</span>
                          </p>
                        )}
                      </div>

                      <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                        <div className="flex items-center gap-3">
                          {exam.weight && (
                            <span className="inline-flex items-center gap-1 font-mono font-medium text-zinc-700 dark:text-zinc-300">
                              <Percent className="w-3 h-3 text-zinc-400" />
                              {exam.weight}% weight
                            </span>
                          )}
                          <span className="text-zinc-400 dark:text-zinc-500 font-mono text-[11px]">
                            {exam.rampDays || 14}d ramp schedule
                          </span>
                        </div>

                        {exam.venue && (
                          <span className="inline-flex items-center gap-1 text-zinc-600 dark:text-zinc-400">
                            <MapPin className="w-3 h-3 text-zinc-400" />
                            {exam.venue}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl p-10 text-center bg-zinc-50/50 dark:bg-zinc-900/40 flex flex-col items-center justify-center gap-2">
                <Calendar className="w-8 h-8 text-zinc-300 dark:text-zinc-600" />
                <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">No exams scheduled</h3>
                <p className="text-xs text-zinc-400 dark:text-zinc-500 max-w-md">
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
