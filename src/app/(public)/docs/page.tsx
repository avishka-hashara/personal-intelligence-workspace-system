import Link from "next/link";
import {
  BookOpen,
  Map,
  CheckSquare,
  Sparkles,
  Zap,
  Calendar,
  Layers,
  ArrowRight,
  Flame,
  Clock,
  Keyboard,
  Target,
} from "lucide-react";

export const metadata = {
  title: "Documentation & User Guide | Personal Intelligence Workspace",
  description: "Comprehensive onboarding guide to PIW concepts: Goals vs Tasks, Today View, FSRS Study, and Shortcuts.",
};

export default function DocsPage() {
  return (
    <div className="space-y-12 pb-20">
      {/* Hero Header */}
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-800 text-xs font-semibold uppercase tracking-wider border border-indigo-200">
          <BookOpen className="w-4 h-4 text-indigo-600" />
          User Guide & Mental Model
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          PIW Documentation & Core Concepts
        </h1>
        <p className="text-slate-600 text-base sm:text-lg max-w-3xl leading-relaxed">
          Welcome to the Personal Intelligence Workspace. This guide outlines how to bridge long-term aspirations
          with daily execution, organize academic courses, and leverage AI coaching without sacrificing data ownership.
        </p>
      </div>

      {/* Quick Jump Table of Contents */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">On this page</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-semibold text-indigo-600">
          <a href="#goals-vs-tasks" className="hover:underline flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5" /> 1. Goals vs. Tasks
          </a>
          <a href="#today-screen" className="hover:underline flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" /> 2. The Today View
          </a>
          <a href="#study-fsrs" className="hover:underline flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5" /> 3. FSRS Study Engine
          </a>
          <a href="#shortcuts" className="hover:underline flex items-center gap-1.5">
            <Keyboard className="w-3.5 h-3.5" /> 4. Power Shortcuts
          </a>
        </div>
      </div>

      {/* Section 1: Goals vs Tasks */}
      <section id="goals-vs-tasks" className="space-y-4 pt-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
            <Map className="w-5 h-5" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">1. Goals vs. Tasks: Intent vs. Execution</h2>
        </div>

        <div className="prose prose-sm text-slate-700 leading-relaxed max-w-none bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <p>
            Most productivity systems fail because they treat high-level dreams and daily chores as the same type of object.
            In PIW, we enforce a clean hierarchical distinction:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 not-prose my-4">
            <div className="p-4 rounded-xl bg-indigo-50/50 border border-indigo-200/70 space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-800">Long-Term Intent</span>
              <h3 className="font-bold text-sm text-slate-900">Goals & Roadmaps</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Strategic outcomes with target dates, confidence ratings (1–100%), stages, and critical-path milestones.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Atomic Execution</span>
              <h3 className="font-bold text-sm text-slate-900">Tasks & Habits</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Concrete, time-bounded physical actions with fractional order keys, estimated minutes, and recurrence rules.
              </p>
            </div>
          </div>

          <p className="text-xs text-slate-600">
            Every task can link to a milestone. When tasks complete, milestone progress automatically advances and updates
            goal confidence trajectory.
          </p>
        </div>
      </section>

      {/* Section 2: Today View */}
      <section id="today-screen" className="space-y-4 pt-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
            <Calendar className="w-5 h-5" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">2. The Today View & Next Action Triage</h2>
        </div>

        <div className="prose prose-sm text-slate-700 leading-relaxed max-w-none bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <p>
            The <strong>Today View</strong> is your daily command center. Rather than a flat chronological checklist, tasks
            are scored and prioritized dynamically based on three core dimensions:
          </p>

          <ul className="list-disc pl-5 space-y-1.5 text-xs text-slate-600">
            <li><strong>Due Date & Ramp-up Proximity:</strong> High urgency as deadlines or exam ramp periods approach.</li>
            <li><strong>Goal Critical Path:</strong> Tasks that unblock upcoming roadmap milestones are elevated.</li>
            <li><strong>Energy Matching:</strong> Categorized by focus level (High Focus, Low Energy, Quick Win).</li>
          </ul>

          <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-200/80 text-xs text-emerald-950 flex items-start gap-3 not-prose">
            <Zap className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <strong>Focus Mode Timer:</strong> Press <kbd className="px-1.5 py-0.5 rounded bg-white border border-emerald-200 font-mono text-[10px] font-bold">F</kbd> anywhere
              to start an distraction-free focus block linked to your active task. Focus intervals and interruption counts are automatically logged.
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: FSRS Study Engine */}
      <section id="study-fsrs" className="space-y-4 pt-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
            <BookOpen className="w-5 h-5" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">3. Spaced Repetition (FSRS Engine)</h2>
        </div>

        <div className="prose prose-sm text-slate-700 leading-relaxed max-w-none bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <p>
            PIW integrates the <strong>Free Spaced Repetition Scheduler (FSRS)</strong>—a modern memory retention algorithm
            that replaces legacy SM-2.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 not-prose text-xs">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-center">
              <span className="font-bold text-slate-900 block text-sm mb-1">State 0 (New)</span>
              <p className="text-slate-500 text-[11px]">Unreviewed cards queued for first learning.</p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-center">
              <span className="font-bold text-slate-900 block text-sm mb-1">Stability (S)</span>
              <p className="text-slate-500 text-[11px]">Memory trace longevity before decay.</p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-center">
              <span className="font-bold text-slate-900 block text-sm mb-1">Exam Ramp-Up</span>
              <p className="text-slate-500 text-[11px]">Target 90%+ predicted retention before exams.</p>
            </div>
          </div>

          <p className="text-xs text-slate-600">
            You can import existing decks anytime via the{" "}
            <Link href="/settings/data" className="font-bold text-indigo-600 hover:underline">
              Anki TSV Importer
            </Link>{" "}
            or auto-generate active recall cards from syllabi using AI-07.
          </p>
        </div>
      </section>

      {/* Section 4: Power Shortcuts */}
      <section id="shortcuts" className="space-y-4 pt-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-purple-50 text-purple-600 border border-purple-100">
            <Keyboard className="w-5 h-5" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">4. Keyboard Shortcuts & Power Gestures</h2>
        </div>

        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <p className="text-xs text-slate-600">
            PIW is designed for lightning-fast keyboard-first navigation. All single-key shortcuts are active when
            not typing in an input field.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            {[
              { key: "Q", label: "Quick Capture", desc: "Instantly capture an idea or task from any screen" },
              { key: "C", label: "Ask Copilot", desc: "Open conversational AI assistant slide-over panel" },
              { key: "Cmd+K / Ctrl+K", label: "Command Palette", desc: "Search notes, tasks, courses, and navigate anywhere" },
              { key: "F", label: "Focus Timer", desc: "Launch or toggle active focus block" },
              { key: "Ctrl+\\", label: "Toggle Day Strip", desc: "Expand or collapse right sidebar to maximize screen width" },
              { key: "T / K / S / J", label: "Rapid Navigation", desc: "T = Today, K = Tasks, S = Study, J = Journal" },
            ].map((sc) => (
              <div
                key={sc.key}
                className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-4"
              >
                <div className="space-y-0.5">
                  <span className="font-semibold text-xs text-slate-900">{sc.label}</span>
                  <p className="text-[11px] text-slate-500">{sc.desc}</p>
                </div>
                <kbd className="px-2 py-1 rounded-md bg-white border border-slate-300 font-mono text-xs font-bold text-slate-800 shadow-2xs shrink-0">
                  {sc.key}
                </kbd>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Footer */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
        <div className="space-y-1">
          <h3 className="font-bold text-base text-white">Ready to explore?</h3>
          <p className="text-xs text-slate-300">Open your today view or import your existing tasks to get started.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/settings/data"
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold border border-white/20 transition-colors"
          >
            Import Data
          </Link>
          <Link
            href="/"
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs transition-colors"
          >
            Go to Today
          </Link>
        </div>
      </div>
    </div>
  );
}
