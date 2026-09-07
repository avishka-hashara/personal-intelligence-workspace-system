"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  deleteResource,
  type DeleteResourceAction,
} from "@/server/actions/study";
import {
  Trash2,
  FileText,
  Brain,
  Sparkles,
  Loader2,
  AlertTriangle,
  ExternalLink,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";

interface DeleteResourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  resource: {
    id: string;
    title: string;
    url: string;
    resourceType: string | null;
    pageCount: number | null;
    indexStatus: string | null;
  };
  courseId: string;
  chunkCount: number;
  onDeleted?: () => void;
}

export function DeleteResourceModal({
  isOpen,
  onClose,
  resource,
  courseId,
  chunkCount,
  onDeleted,
}: DeleteResourceModalProps) {
  const [selectedAction, setSelectedAction] = useState<DeleteResourceAction>("convert_to_note");
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{
    message: string;
    noteId?: string;
  } | null>(null);

  const hasChunks = chunkCount > 0;

  const handleConfirmDelete = (actionOverride?: DeleteResourceAction) => {
    const actionToRun = actionOverride || (hasChunks ? selectedAction : "purge_all");
    setErrorMsg(null);

    startTransition(async () => {
      const res = await deleteResource(resource.id, courseId, actionToRun);

      if (res.error) {
        setErrorMsg(res.error);
        return;
      }

      if (res.action === "convert_to_note" && res.createdNoteId) {
        setSuccessInfo({
          message: "Converted to knowledge note & linked to course!",
          noteId: res.createdNoteId,
        });
      } else {
        onClose();
        if (onDeleted) onDeleted();
      }
    });
  };

  const handleFinish = () => {
    setSuccessInfo(null);
    onClose();
    if (onDeleted) onDeleted();
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !isPending) {
          setErrorMsg(null);
          setSuccessInfo(null);
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-xl bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-xl border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100">
        {successInfo ? (
          <div className="space-y-5 text-center py-4">
            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">
                Resource Converted & Archived
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                The content from <strong className="text-slate-800 dark:text-zinc-200">{resource.title}</strong> has been extracted into a persistent Markdown note linked to this course.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              {successInfo.noteId && (
                <Link
                  href={`/notes/${successInfo.noteId}`}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-xs"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Open Converted Note</span>
                  <ExternalLink className="w-3 h-3 ml-0.5" />
                </Link>
              )}
              <button
                type="button"
                onClick={handleFinish}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 border border-rose-100 dark:border-rose-900/40">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-slate-900 dark:text-zinc-100">
                    Delete Course Resource
                  </DialogTitle>
                  <DialogDescription className="text-xs text-slate-500 dark:text-zinc-400 line-clamp-1">
                    {resource.title}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            {errorMsg && (
              <div className="rounded-xl p-3 text-xs bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500 dark:text-rose-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            {hasChunks ? (
              <div className="space-y-4 pt-1">
                {/* Knowledge impact stats banner */}
                <div className="bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100/80 dark:border-indigo-900/40 rounded-xl p-3.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-indigo-600/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                      <Brain className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                        <span>Active in AI Knowledge Graph</span>
                        <span className="text-[10px] bg-indigo-200/60 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-300 font-semibold px-1.5 py-0.2 rounded-md">
                          {chunkCount} {chunkCount === 1 ? "chunk" : "chunks"}
                        </span>
                      </div>
                      <p className="text-[11px] text-indigo-700/80 dark:text-indigo-300/80 leading-relaxed">
                        Extracted across {resource.pageCount ?? 1} {(resource.pageCount ?? 1) === 1 ? "page" : "pages"}. Choose what happens to the learned knowledge:
                      </p>
                    </div>
                  </div>
                </div>

                {/* 3 Action Choices */}
                <div className="space-y-2.5">
                  {/* Option 1: Convert to Knowledge Note */}
                  <label
                    onClick={() => setSelectedAction("convert_to_note")}
                    className={`block rounded-xl p-3.5 border text-left cursor-pointer transition-all ${
                      selectedAction === "convert_to_note"
                        ? "border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20 shadow-xs"
                        : "border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800/40 hover:border-slate-300 dark:hover:border-zinc-700 hover:bg-slate-50/50 dark:hover:bg-zinc-800/70"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="deleteAction"
                        checked={selectedAction === "convert_to_note"}
                        onChange={() => setSelectedAction("convert_to_note")}
                        className="mt-1 h-4 w-4 text-indigo-600 border-slate-300 dark:border-zinc-700 focus:ring-indigo-500 cursor-pointer"
                      />
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                            Convert to Knowledge Note & Delete File
                          </span>
                          <span className="text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                            Recommended Second Brain
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-zinc-400 leading-normal">
                          Converts the extracted knowledge into an editable Markdown Note in <strong>Notes & Knowledge</strong>, links it to this course, reassigns vector chunks, and frees cloud file storage.
                        </p>
                      </div>
                    </div>
                  </label>

                  {/* Option 2: Keep Knowledge Chunks Only */}
                  <label
                    onClick={() => setSelectedAction("keep_chunks")}
                    className={`block rounded-xl p-3.5 border text-left cursor-pointer transition-all ${
                      selectedAction === "keep_chunks"
                        ? "border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20 shadow-xs"
                        : "border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800/40 hover:border-slate-300 dark:hover:border-zinc-700 hover:bg-slate-50/50 dark:hover:bg-zinc-800/70"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="deleteAction"
                        checked={selectedAction === "keep_chunks"}
                        onChange={() => setSelectedAction("keep_chunks")}
                        className="mt-1 h-4 w-4 text-indigo-600 border-slate-300 dark:border-zinc-700 focus:ring-indigo-500 cursor-pointer"
                      />
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-1.5">
                            <Brain className="w-3.5 h-3.5 text-slate-600 dark:text-zinc-400" />
                            Delete Document Only (Retain AI Knowledge)
                          </span>
                          <span className="text-[10px] font-semibold bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 px-2 py-0.5 rounded-full border border-slate-200 dark:border-zinc-700">
                            AI Remembers
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-zinc-400 leading-normal">
                          Removes the document and deletes the cloud file to save storage, but keeps the semantic vector chunks active so AI Copilot and Quizzes can still answer questions from it.
                        </p>
                      </div>
                    </div>
                  </label>

                  {/* Option 3: Full Purge */}
                  <label
                    onClick={() => setSelectedAction("purge_all")}
                    className={`block rounded-xl p-3.5 border text-left cursor-pointer transition-all ${
                      selectedAction === "purge_all"
                        ? "border-rose-500 bg-rose-50/40 dark:bg-rose-950/40 ring-2 ring-rose-500/20 shadow-xs"
                        : "border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800/40 hover:border-slate-300 dark:hover:border-zinc-700 hover:bg-slate-50/50 dark:hover:bg-zinc-800/70"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="deleteAction"
                        checked={selectedAction === "purge_all"}
                        onChange={() => setSelectedAction("purge_all")}
                        className="mt-1 h-4 w-4 text-rose-600 border-slate-300 dark:border-zinc-700 focus:ring-rose-500 cursor-pointer"
                      />
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-rose-900 dark:text-rose-200 flex items-center gap-1.5">
                            <Trash2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                            Purge Everything (Delete File & Wipe Knowledge)
                          </span>
                          <span className="text-[10px] font-semibold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 px-2 py-0.5 rounded-full border border-rose-200 dark:border-rose-800">
                            Full Purge
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-zinc-400 leading-normal">
                          Permanently deletes the document, purges the cloud storage file, and wipes all vector embeddings from the database. The AI will completely forget this material.
                        </p>
                      </div>
                    </div>
                  </label>
                </div>
              </div>
            ) : (
              /* Non-indexed resource fallback */
              <div className="space-y-3 py-3">
                <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                  Are you sure you want to delete <strong className="text-slate-900 dark:text-zinc-100">{resource.title}</strong>? This resource is not indexed in the knowledge graph. Deleting will permanently remove it from this course.
                </p>
              </div>
            )}

            <DialogFooter className="mt-4 pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={isPending}
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isPending}
                onClick={() => handleConfirmDelete()}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all shadow-xs disabled:opacity-50 ${
                  !hasChunks || selectedAction === "purge_all"
                    ? "bg-rose-600 hover:bg-rose-700"
                    : "bg-indigo-600 hover:bg-indigo-700"
                }`}
              >
                {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>
                  {isPending
                    ? "Processing..."
                    : !hasChunks
                    ? "Delete Resource"
                    : selectedAction === "convert_to_note"
                    ? "Convert to Note & Delete File"
                    : selectedAction === "keep_chunks"
                    ? "Delete File (Retain Knowledge)"
                    : "Purge Everything"}
                </span>
              </button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
