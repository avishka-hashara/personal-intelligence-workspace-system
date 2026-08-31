"use client";

import { useState, useTransition } from "react";
import { createSyllabusItem, updateSyllabusCoverage, logStudySession } from "@/server/actions/study";
import type { syllabusItems } from "@/server/db/schema";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Plus,
  Layers,
  History,
  Timer,
  Sparkles,
  CheckCircle2,
  BookOpen,
  BrainCircuit,
} from "lucide-react";
import { QuizView } from "@/components/QuizView";

export type SyllabusItem = typeof syllabusItems.$inferSelect;

interface SyllabusManagerProps {
  courseId: string;
  initialItems: SyllabusItem[];
}

const COVERAGE_OPTIONS = [
  { value: "not_started", label: "Not Started", color: "bg-slate-100 text-slate-600 border-slate-200" },
  { value: "in_progress", label: "In Progress", color: "bg-amber-50 text-amber-700 border-amber-200" },
  { value: "covered", label: "Covered", color: "bg-blue-50 text-blue-700 border-blue-200" },
  { value: "revised", label: "Revised", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
];

const STUDY_TECHNIQUES = [
  "Pomodoro",
  "Feynman Technique",
  "Active Recall",
  "Practice Paper",
  "Reading & Notes",
  "Spaced Repetition",
];

export function SyllabusManager({ courseId, initialItems }: SyllabusManagerProps) {
  const [items, setItems] = useState<SyllabusItem[]>(initialItems);
  const [newItemTitle, setNewItemTitle] = useState("");
  const [isPending, startTransition] = useTransition();

  // Quiz Dialog State
  const [quizItem, setQuizItem] = useState<SyllabusItem | null>(null);

  // Session Logging Dialog State
  const [sessionItem, setSessionItem] = useState<SyllabusItem | null>(null);
  const [minutes, setMinutes] = useState(25);
  const [technique, setTechnique] = useState("Pomodoro");
  const [confidenceBefore, setConfidenceBefore] = useState(1);
  const [confidenceAfter, setConfidenceAfter] = useState(3);
  const [notes, setNotes] = useState("");

  // Handle updating coverage or confidence directly from table
  const handleUpdate = (itemId: string, newCoverage: string, newConfidence: number) => {
    setItems((prev) =>
      prev.map((it) =>
        it.id === itemId
          ? { ...it, coverage: newCoverage, confidence: newConfidence }
          : it
      )
    );

    startTransition(async () => {
      await updateSyllabusCoverage(itemId, newCoverage, newConfidence, courseId);
    });
  };

  // Handle adding new syllabus item
  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    const title = newItemTitle.trim();
    if (!title || isPending) return;

    setNewItemTitle("");

    startTransition(async () => {
      const res = await createSyllabusItem(courseId, title);
      if (res && res.success && res.item) {
        setItems((prev) => [...prev, res.item as SyllabusItem]);
      }
    });
  };

  // Open Log Session Dialog
  const openLogDialog = (item: SyllabusItem) => {
    setSessionItem(item);
    setMinutes(25);
    setTechnique("Pomodoro");
    const currentConf = item.confidence ?? 1;
    setConfidenceBefore(currentConf);
    setConfidenceAfter(Math.min(5, currentConf + 1));
    setNotes("");
  };

  // Handle Submitting Log Session
  const handleSubmitSession = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionItem || isPending) return;

    const targetItemId = sessionItem.id;
    const targetConfidenceAfter = confidenceAfter;

    // Optimistically update confidence score on the syllabus item
    setItems((prev) =>
      prev.map((it) =>
        it.id === targetItemId ? { ...it, confidence: targetConfidenceAfter } : it
      )
    );

    startTransition(async () => {
      await logStudySession(courseId, targetItemId, {
        actualMinutes: minutes,
        technique,
        confidenceBefore,
        confidenceAfter: targetConfidenceAfter,
        notes: notes.trim() || null,
      });
      setSessionItem(null);
    });
  };

  return (
    <div className="space-y-6">
      {/* Syllabus Table */}
      {items.length > 0 ? (
        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
          <Table>
            <TableHeader className="bg-slate-50/80">
              <TableRow className="hover:bg-transparent border-slate-200">
                <TableHead className="w-12 text-center text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  #
                </TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Topic / Concept
                </TableHead>
                <TableHead className="w-40 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Coverage Status
                </TableHead>
                <TableHead className="w-36 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Confidence (1-5)
                </TableHead>
                <TableHead className="w-48 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, index) => {
                const currentOpt =
                  COVERAGE_OPTIONS.find((c) => c.value === item.coverage) ||
                  COVERAGE_OPTIONS[0];

                return (
                  <TableRow
                    key={item.id}
                    className="border-slate-100 hover:bg-slate-50/60 transition-colors"
                  >
                    {/* Index */}
                    <TableCell className="text-center font-mono text-xs font-semibold text-slate-400">
                      {index + 1}
                    </TableCell>

                    {/* Title */}
                    <TableCell>
                      <span className="text-xs font-semibold text-slate-800">
                        {item.title}
                      </span>
                    </TableCell>

                    {/* Coverage Select */}
                    <TableCell>
                      <select
                        value={item.coverage}
                        onChange={(e) =>
                          handleUpdate(item.id, e.target.value, item.confidence ?? 1)
                        }
                        className={`text-xs font-medium px-2.5 py-1 rounded-lg border focus:outline-none focus:ring-2 focus:ring-slate-900 cursor-pointer ${currentOpt.color}`}
                      >
                        {COVERAGE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </TableCell>

                    {/* Confidence Rating (1-5 Pills) */}
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((score) => {
                          const isFilled = (item.confidence ?? 1) >= score;
                          return (
                            <button
                              key={score}
                              type="button"
                              onClick={() =>
                                handleUpdate(item.id, item.coverage, score)
                              }
                              className={`w-6 h-6 rounded-md text-[11px] font-bold flex items-center justify-center transition-all cursor-pointer ${
                                isFilled
                                  ? "bg-amber-400 text-amber-950 shadow-2xs"
                                  : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                              }`}
                              title={`Confidence: ${score}/5`}
                            >
                              {score}
                            </button>
                          );
                        })}
                      </div>
                    </TableCell>

                    {/* Actions: Practice Quiz & Log Session */}
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setQuizItem(item)}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-colors cursor-pointer shadow-2xs"
                          title="Generate AI Active Recall Quiz for this topic"
                        >
                          <Sparkles className="w-3 h-3 text-indigo-500" />
                          <span>Practice Quiz</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => openLogDialog(item)}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 border border-slate-200 transition-colors cursor-pointer"
                          title="Log study session"
                        >
                          <Timer className="w-3 h-3 text-slate-400" />
                          <span>Log</span>
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="border border-dashed border-slate-200 rounded-xl p-8 text-center bg-slate-50/50 flex flex-col items-center justify-center gap-2">
          <Layers className="w-8 h-8 text-slate-300" />
          <p className="text-sm font-semibold text-slate-700">
            No syllabus items added yet
          </p>
          <p className="text-xs text-slate-400 max-w-md">
            Break this course down into weekly lectures, chapters, or exam topics below.
          </p>
        </div>
      )}

      {/* Quick Add Form */}
      <form onSubmit={handleAddItem} className="flex gap-2">
        <input
          type="text"
          value={newItemTitle}
          onChange={(e) => setNewItemTitle(e.target.value)}
          placeholder="Add a syllabus topic (e.g. 'Week 3: Dynamic Programming & Memoization')..."
          className="flex-1 px-3.5 py-2 text-xs bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all"
        />
        <button
          type="submit"
          disabled={!newItemTitle.trim() || isPending}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer disabled:cursor-not-allowed"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Topic</span>
        </button>
      </form>

      {/* Log Study Session Dialog */}
      <Dialog
        open={!!sessionItem}
        onOpenChange={(open) => {
          if (!open) setSessionItem(null);
        }}
      >
        <DialogContent className="sm:max-w-md bg-white p-6 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Timer className="w-5 h-5 text-indigo-600" />
              Log Study Session
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Record active study time and update topic confidence for{" "}
              <strong className="text-slate-800 font-semibold">
                {sessionItem?.title}
              </strong>
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitSession} className="space-y-4 pt-2">
            {/* Minutes & Technique */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Minutes Spent *
                </label>
                <input
                  type="number"
                  min={1}
                  max={480}
                  value={minutes}
                  onChange={(e) => setMinutes(parseInt(e.target.value, 10) || 25)}
                  required
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Technique
                </label>
                <select
                  value={technique}
                  onChange={(e) => setTechnique(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  {STUDY_TECHNIQUES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Confidence Ratings (Before & After) */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Confidence Before
                </label>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setConfidenceBefore(s)}
                      className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
                        confidenceBefore >= s
                          ? "bg-slate-800 text-white"
                          : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Confidence After
                </label>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setConfidenceAfter(s)}
                      className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
                        confidenceAfter >= s
                          ? "bg-amber-400 text-amber-950 shadow-2xs"
                          : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Session Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Key insights, difficult concepts, or recall notes..."
                rows={2}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSessionItem(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer"
              >
                {isPending ? "Logging..." : "Save Session"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Practice Quiz Dialog */}
      <Dialog
        open={!!quizItem}
        onOpenChange={(open) => {
          if (!open) setQuizItem(null);
        }}
      >
        <DialogContent className="sm:max-w-2xl bg-white p-6 rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="sr-only">
            <DialogTitle>Practice Quiz: {quizItem?.title}</DialogTitle>
            <DialogDescription>Interactive active recall practice</DialogDescription>
          </DialogHeader>
          {quizItem && (
            <QuizView
              syllabusItemId={quizItem.id}
              topicTitle={quizItem.title}
              onClose={() => setQuizItem(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default SyllabusManager;
