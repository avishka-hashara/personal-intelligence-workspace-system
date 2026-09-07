"use client";

import { useState } from "react";
import Link from "next/link";
import { FileText, ArrowRight, Trash2 } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { DeleteNoteModal } from "@/components/DeleteNoteModal";

interface NoteCardProps {
  note: {
    id: string;
    title: string;
    content: string | null;
    updatedAt: Date | string;
  };
}

export function NoteCard({ note }: NoteCardProps) {
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const preview = note.content
    ? note.content
        .replace(/^[#*>-]+\s+/gm, "")
        .replace(/[`*_[\]()]/g, "")
        .trim()
    : "Empty note";

  return (
    <>
      <div className="relative group bg-white dark:bg-card border border-slate-200 dark:border-border hover:border-slate-300 dark:hover:border-zinc-700 rounded-2xl p-5 shadow-xs dark:shadow-none hover:shadow-md transition-all flex flex-col justify-between">
        <Link href={`/notes/${note.id}`} className="space-y-2 block">
          <div className="flex items-center justify-between gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800/50 group-hover:bg-indigo-100/80 dark:group-hover:bg-indigo-900/50 transition-colors shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-400 dark:text-muted-foreground">
                {formatDistanceToNow(new Date(note.updatedAt), { addSuffix: true })}
              </span>
            </div>
          </div>

          <h3 className="text-base font-bold text-slate-900 dark:text-foreground group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-1 pr-6">
            {note.title || "Untitled Note"}
          </h3>

          <p className="text-xs text-slate-500 dark:text-muted-foreground line-clamp-3 leading-relaxed">
            {preview}
          </p>
        </Link>

        {/* Action Bar / Footer */}
        <div className="mt-5 pt-3 border-t border-slate-100 dark:border-border-subtle flex items-center justify-between text-xs text-slate-400 dark:text-muted-foreground">
          <span>{format(new Date(note.updatedAt), "MMM d, yyyy")}</span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDeleteOpen(true);
              }}
              className="p-1.5 rounded-lg text-slate-400 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
              title="Delete note"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="sr-only">Delete</span>
            </button>

            <Link
              href={`/notes/${note.id}`}
              className="inline-flex items-center gap-1 font-medium text-slate-500 dark:text-zinc-400 group-hover:text-slate-900 dark:group-hover:text-zinc-100 group-hover:translate-x-0.5 transition-all"
            >
              <span>Open Note</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      <DeleteNoteModal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        noteId={note.id}
        noteTitle={note.title}
      />
    </>
  );
}
