"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  CheckSquare,
  BookOpen,
  ArrowRight,
  Database,
  RefreshCw,
  Info,
  Layers,
  Sparkles,
} from "lucide-react";
import { importTodoistCSV, importAnkiTSV, type ImportResult } from "@/server/actions/import";

interface CourseOption {
  id: string;
  code: string;
  title: string;
}

interface DataImportManagerProps {
  coursesList: CourseOption[];
}

export function DataImportManager({ coursesList }: DataImportManagerProps) {
  // Todoist Form State
  const [todoistFile, setTodoistFile] = useState<File | null>(null);
  const [todoistResult, setTodoistResult] = useState<ImportResult | null>(null);
  const [isTodoistPending, startTodoistTransition] = useTransition();

  // Anki Form State
  const [ankiFile, setAnkiFile] = useState<File | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string>(
    coursesList.length > 0 ? coursesList[0].id : ""
  );
  const [ankiResult, setAnkiResult] = useState<ImportResult | null>(null);
  const [isAnkiPending, startAnkiTransition] = useTransition();

  const handleTodoistSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!todoistFile) return;

    setTodoistResult(null);
    startTodoistTransition(async () => {
      const formData = new FormData();
      formData.append("file", todoistFile);
      const res = await importTodoistCSV(formData);
      setTodoistResult(res);
      if (res.success) {
        setTodoistFile(null);
      }
    });
  };

  const handleAnkiSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ankiFile || !selectedCourseId) return;

    setAnkiResult(null);
    startAnkiTransition(async () => {
      const formData = new FormData();
      formData.append("file", ankiFile);
      formData.append("courseId", selectedCourseId);
      const res = await importAnkiTSV(selectedCourseId, formData);
      setAnkiResult(res);
      if (res.success) {
        setAnkiFile(null);
      }
    });
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-16">
      {/* Settings Navigation Tabs */}
      <div className="border-b border-slate-200">
        <div className="flex items-center gap-6">
          <Link
            href="/settings/data"
            className="pb-3 text-sm font-bold text-indigo-600 border-b-2 border-indigo-600 flex items-center gap-2"
          >
            <Database className="w-4 h-4" />
            <span>Data & Imports</span>
          </Link>
          <Link
            href="/settings"
            className="pb-3 text-sm font-medium text-slate-500 hover:text-slate-900 flex items-center gap-2 transition-colors"
          >
            <span>General & AI Preferences</span>
          </Link>
        </div>
      </div>

      {/* Header Description */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Data Importers</h1>
        <p className="text-slate-600 text-sm mt-1">
          Import your existing workflows from Todoist and Anki into your Personal Intelligence Workspace to
          eliminate switching friction.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* =================================================================== */}
        {/* Section 1: Todoist CSV Task Importer */}
        {/* =================================================================== */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center border border-red-100">
                <CheckSquare className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Import Tasks (Todoist CSV)</h2>
                <span className="text-xs text-slate-500 font-medium">Standard Todoist Export</span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Upload your Todoist task export. We map the <code className="bg-slate-100 px-1 py-0.5 rounded text-[11px] font-semibold text-slate-800">CONTENT</code> column to task titles, <code className="bg-slate-100 px-1 py-0.5 rounded text-[11px] font-semibold text-slate-800">DUE DATE</code> to schedules, and maintain fractional sorting.
            </p>

            <form onSubmit={handleTodoistSubmit} className="space-y-4 pt-2">
              {/* File Dropzone / Picker */}
              <div className="relative border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-xl p-5 text-center transition-colors bg-slate-50/50">
                <input
                  type="file"
                  id="todoist-csv-input"
                  accept=".csv,text/csv"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setTodoistFile(e.target.files[0]);
                      setTodoistResult(null);
                    }
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="flex flex-col items-center gap-2 pointer-events-none">
                  <Upload className="w-6 h-6 text-slate-400" />
                  {todoistFile ? (
                    <div className="text-xs font-semibold text-indigo-600 truncate max-w-xs">
                      {todoistFile.name} ({(todoistFile.size / 1024).toFixed(1)} KB)
                    </div>
                  ) : (
                    <>
                      <p className="text-xs font-semibold text-slate-700">
                        Click to select or drag a CSV file
                      </p>
                      <p className="text-[11px] text-slate-400">Accepts .csv files exported from Todoist</p>
                    </>
                  )}
                </div>
              </div>

              {/* Status Message */}
              {todoistResult && (
                <div
                  className={`p-3.5 rounded-xl text-xs flex items-center justify-between gap-2 border ${
                    todoistResult.success
                      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                      : "bg-rose-50 text-rose-800 border-rose-200"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {todoistResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span>
                      {todoistResult.success
                        ? `Imported ${todoistResult.count} tasks successfully!`
                        : todoistResult.error || "Failed to import tasks."}
                    </span>
                  </div>

                  {todoistResult.success && (
                    <Link
                      href="/tasks"
                      className="inline-flex items-center gap-1 font-bold text-emerald-700 hover:underline shrink-0"
                    >
                      View Tasks <ArrowRight className="w-3 h-3" />
                    </Link>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={!todoistFile || isTodoistPending}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs shadow-xs disabled:opacity-50 transition-all cursor-pointer"
              >
                {isTodoistPending ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Parsing & Importing Tasks...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" />
                    <span>Import Tasks from Todoist</span>
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-1.5 text-[11px] text-slate-400">
            <Info className="w-3.5 h-3.5 shrink-0" />
            <span>Tasks are added to your next action queue and indexed for AI search.</span>
          </div>
        </div>

        {/* =================================================================== */}
        {/* Section 2: Anki TSV Flashcards Importer */}
        {/* =================================================================== */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Import Flashcards (Anki TSV)</h2>
                <span className="text-xs text-slate-500 font-medium">FSRS Memory Engine Compatible</span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Upload a tab-separated text/TSV file exported from Anki (<code className="bg-slate-100 px-1 py-0.5 rounded text-[11px] font-semibold text-slate-800">Front \t Back</code>). Cards will be scheduled using the FSRS spaced repetition engine.
            </p>

            <form onSubmit={handleAnkiSubmit} className="space-y-4 pt-2">
              {/* Course Selector */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">Target Course</label>
                {coursesList.length === 0 ? (
                  <div className="p-3 rounded-xl bg-amber-50 text-amber-800 text-xs border border-amber-200 flex items-center justify-between">
                    <span>No active courses found.</span>
                    <Link
                      href="/study/courses"
                      className="font-bold underline flex items-center gap-1"
                    >
                      Create Course <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                ) : (
                  <select
                    value={selectedCourseId}
                    onChange={(e) => setSelectedCourseId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  >
                    {coursesList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code}: {c.title}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* File Dropzone / Picker */}
              <div className="relative border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-xl p-5 text-center transition-colors bg-slate-50/50">
                <input
                  type="file"
                  id="anki-tsv-input"
                  accept=".tsv,.txt,text/tab-separated-values,text/plain"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setAnkiFile(e.target.files[0]);
                      setAnkiResult(null);
                    }
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="flex flex-col items-center gap-2 pointer-events-none">
                  <Upload className="w-6 h-6 text-slate-400" />
                  {ankiFile ? (
                    <div className="text-xs font-semibold text-indigo-600 truncate max-w-xs">
                      {ankiFile.name} ({(ankiFile.size / 1024).toFixed(1)} KB)
                    </div>
                  ) : (
                    <>
                      <p className="text-xs font-semibold text-slate-700">
                        Click to select or drag a TSV/TXT file
                      </p>
                      <p className="text-[11px] text-slate-400">Accepts Anki export cards (tab-separated)</p>
                    </>
                  )}
                </div>
              </div>

              {/* Status Message */}
              {ankiResult && (
                <div
                  className={`p-3.5 rounded-xl text-xs flex items-center justify-between gap-2 border ${
                    ankiResult.success
                      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                      : "bg-rose-50 text-rose-800 border-rose-200"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {ankiResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span>
                      {ankiResult.success
                        ? `Imported ${ankiResult.count} flashcards successfully!`
                        : ankiResult.error || "Failed to import flashcards."}
                    </span>
                  </div>

                  {ankiResult.success && (
                    <Link
                      href={`/study/courses/${selectedCourseId}`}
                      className="inline-flex items-center gap-1 font-bold text-emerald-700 hover:underline shrink-0"
                    >
                      Study Deck <ArrowRight className="w-3 h-3" />
                    </Link>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={!ankiFile || !selectedCourseId || isAnkiPending}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs shadow-xs disabled:opacity-50 transition-all cursor-pointer"
              >
                {isAnkiPending ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Parsing & Inserting Cards...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" />
                    <span>Import Flashcards into Course</span>
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-1.5 text-[11px] text-slate-400">
            <Info className="w-3.5 h-3.5 shrink-0" />
            <span>Cards start in State 0 (New) and will be queued during regular review sessions.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
