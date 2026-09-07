"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { updateNote } from "@/server/actions/notes";
import type { notes } from "@/server/db/schema";
import type { ConnectedNode } from "@/server/actions/nodes";
import { ConnectionsPanel } from "@/components/ConnectionsPanel";
import { DeleteNoteModal } from "@/components/DeleteNoteModal";
import {
  ArrowLeft,
  Columns,
  Edit3,
  Eye,
  Check,
  Loader2,
  FileText,
  Calendar,
  Sparkles,
  Trash2,
} from "lucide-react";
import { format } from "date-fns";
import { ContextSetter } from "@/components/ContextSetter";

export type Note = typeof notes.$inferSelect;

interface NoteEditorProps {
  note: Note;
  connections?: {
    forwardLinks: ConnectedNode[];
    backlinks: ConnectedNode[];
  };
}

type ViewMode = "split" | "edit" | "preview";

export function NoteEditor({ note, connections }: NoteEditorProps) {
  const router = useRouter();
  const [title, setTitle] = useState(note.title || "Untitled Note");
  const [content, setContent] = useState(note.content || "");
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");

  // Track if initial mount
  const isFirstRender = useRef(true);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Trigger background auto-save
  const performSave = (newTitle: string, newContent: string) => {
    setSaveStatus("saving");
    startTransition(async () => {
      await updateNote(note.id, {
        title: newTitle.trim() || "Untitled Note",
        content: newContent,
      });
      setSaveStatus("saved");
    });
  };

  // Debounced auto-save on content or title change
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    setSaveStatus("unsaved");

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      performSave(title, content);
    }, 1200);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [title, content]);

  const handleBlur = () => {
    if (saveStatus === "unsaved") {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      performSave(title, content);
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-12">
      <ContextSetter type="Note" id={note.id} title={title} data={content} />
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <Link
            href="/notes"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            <span>Notes</span>
          </Link>

          <span className="text-zinc-300 dark:text-zinc-700">/</span>

          {/* Save Status Indicator */}
          <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 dark:text-zinc-400 font-medium">
            {saveStatus === "saving" ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin text-indigo-500" />
                <span className="text-indigo-600 dark:text-indigo-400">Saving...</span>
              </>
            ) : saveStatus === "unsaved" ? (
              <span className="text-amber-500 dark:text-amber-400">Unsaved changes</span>
            ) : (
              <>
                <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                <span className="text-zinc-500 dark:text-zinc-400">Saved</span>
              </>
            )}
          </div>
        </div>

        {/* Right Actions: View Mode Toggle & Delete Note */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 bg-zinc-100/90 dark:bg-zinc-800/90 p-1 rounded-xl border border-zinc-200/80 dark:border-zinc-700/80 shadow-subtle">
            <button
              type="button"
              onClick={() => setViewMode("split")}
              className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                viewMode === "split"
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 shadow-2xs border border-transparent dark:border-white/10"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
              }`}
            >
              <Columns className="w-3.5 h-3.5" />
              <span>Split</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode("edit")}
              className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                viewMode === "edit"
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 shadow-2xs border border-transparent dark:border-white/10"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode("preview")}
              className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                viewMode === "preview"
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 shadow-2xs border border-transparent dark:border-white/10"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Preview</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsDeleteOpen(true)}
            className="inline-flex items-center justify-center p-2 rounded-xl text-zinc-400 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 border border-zinc-200 dark:border-zinc-700 hover:border-rose-200 dark:hover:border-rose-800 transition-colors cursor-pointer"
            title="Delete note"
          >
            <Trash2 className="w-4 h-4" />
            <span className="sr-only">Delete</span>
          </button>
        </div>
      </div>

      {/* Title & Metadata Card */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl p-5 sm:p-6 shadow-xs space-y-2">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleBlur}
          placeholder="Untitled Note"
          className="w-full text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 border-none outline-none focus:ring-0 bg-transparent p-0 tracking-tight"
        />

        <div className="flex items-center gap-3 text-[11px] text-zinc-400 dark:text-zinc-500 pt-1">
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            Created {format(new Date(note.createdAt), "MMM d, yyyy")}
          </span>
          <span>·</span>
          <span>{content.trim().split(/\s+/).filter(Boolean).length} words</span>
          <span>·</span>
          <span>{content.length} characters</span>
        </div>
      </div>

      {/* Bi-directional Knowledge Connections */}
      {connections && (
        <ConnectionsPanel nodeId={note.id} connections={connections} />
      )}

      {/* Editor & Preview Split Pane */}
      <div
        className={`grid gap-4 ${
          viewMode === "split"
            ? "grid-cols-1 lg:grid-cols-2"
            : "grid-cols-1"
        }`}
      >
        {/* Left / Edit Pane */}
        {(viewMode === "split" || viewMode === "edit") && (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col min-h-[550px]">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-zinc-100 dark:border-zinc-800 text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              <span>Markdown Source</span>
              <span>Rich Markdown Syntax Supported</span>
            </div>

            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onBlur={handleBlur}
              placeholder="Write your note in Markdown... (e.g. # Heading, - Lists, **Bold**, `Code`, [[Links]])"
              className="w-full flex-1 min-h-[480px] text-xs sm:text-sm font-mono text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 border-none outline-none focus:ring-0 bg-transparent resize-none leading-relaxed p-0"
            />
          </div>
        )}

        {/* Right / Preview Pane */}
        {(viewMode === "split" || viewMode === "preview") && (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col min-h-[550px]">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-zinc-100 dark:border-zinc-800 text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              <span>Live Markdown Preview</span>
              <span>Rendered</span>
            </div>

            <div className="flex-1 overflow-y-auto min-h-[480px]">
              {content.trim() ? (
                <div className="prose prose-zinc dark:prose-invert prose-sm max-w-none text-zinc-800 dark:text-zinc-200 leading-relaxed space-y-3 font-sans">
                  <ReactMarkdown>{content}</ReactMarkdown>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 text-zinc-400 dark:text-zinc-500 gap-2">
                  <FileText className="w-8 h-8 text-zinc-300 dark:text-zinc-600" />
                  <p className="text-xs font-medium">Nothing to preview yet</p>
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                    Type markdown syntax in the editor on the left to see live formatting.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <DeleteNoteModal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        noteId={note.id}
        noteTitle={title}
        onDeleted={() => router.push("/notes")}
      />
    </div>
  );
}

export default NoteEditor;
