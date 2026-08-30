"use client";

import { useState, useTransition } from "react";
import { createSyllabusItem, updateSyllabusCoverage } from "@/server/actions/study";
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
  Plus,
  CheckCircle2,
  Clock,
  BookOpen,
  Sparkles,
  Star,
  Layers,
} from "lucide-react";

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

export function SyllabusManager({ courseId, initialItems }: SyllabusManagerProps) {
  const [items, setItems] = useState<SyllabusItem[]>(initialItems);
  const [newItemTitle, setNewItemTitle] = useState("");
  const [isPending, startTransition] = useTransition();

  // Handle updating coverage or confidence
  const handleUpdate = (itemId: string, newCoverage: string, newConfidence: number) => {
    // Optimistic state update
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
                <TableHead className="w-48 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Coverage Status
                </TableHead>
                <TableHead className="w-44 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Confidence (1-5)
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, index) => {
                const currentOpt = COVERAGE_OPTIONS.find((c) => c.value === item.coverage) || COVERAGE_OPTIONS[0];

                return (
                  <TableRow key={item.id} className="border-slate-100 hover:bg-slate-50/60 transition-colors">
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
                        onChange={(e) => handleUpdate(item.id, e.target.value, item.confidence ?? 1)}
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
                              onClick={() => handleUpdate(item.id, item.coverage, score)}
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
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="border border-dashed border-slate-200 rounded-xl p-8 text-center bg-slate-50/50 flex flex-col items-center justify-center gap-2">
          <Layers className="w-8 h-8 text-slate-300" />
          <p className="text-sm font-semibold text-slate-700">No syllabus items added yet</p>
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
    </div>
  );
}

export default SyllabusManager;
