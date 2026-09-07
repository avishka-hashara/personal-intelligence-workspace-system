"use client";

import { useTransition, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { deleteNote } from "@/server/actions/notes";
import { Trash2, Loader2, AlertTriangle } from "lucide-react";

interface DeleteNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  noteId: string;
  noteTitle: string;
  onDeleted?: () => void;
}

export function DeleteNoteModal({
  isOpen,
  onClose,
  noteId,
  noteTitle,
  onDeleted,
}: DeleteNoteModalProps) {
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleDelete = () => {
    setErrorMsg(null);
    startTransition(async () => {
      const res = await deleteNote(noteId);
      if (res?.error) {
        setErrorMsg(res.error);
      } else {
        onClose();
        if (onDeleted) onDeleted();
      }
    });
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !isPending) {
          setErrorMsg(null);
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md bg-white dark:bg-card p-6 rounded-2xl shadow-xl dark:shadow-none border border-slate-200 dark:border-border">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 border border-rose-100 dark:border-rose-800/50">
              <Trash2 className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-slate-900 dark:text-foreground">
                Delete Note
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 dark:text-muted-foreground line-clamp-1">
                {noteTitle || "Untitled Note"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {errorMsg && (
          <div className="rounded-xl p-3 text-xs bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500 dark:text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="py-2">
          <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed">
            Are you sure you want to delete <strong className="text-slate-900 dark:text-foreground">{noteTitle || "this note"}</strong>?
            This note, its node links, and any associated knowledge embeddings will be removed from your knowledge base.
          </p>
        </div>

        <DialogFooter className="mt-4 pt-3 border-t border-slate-100 dark:border-border-subtle flex items-center justify-end gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={isPending}
            onClick={handleDelete}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 dark:bg-rose-600 dark:hover:bg-rose-500 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
          >
            {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>{isPending ? "Deleting..." : "Delete Note"}</span>
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
