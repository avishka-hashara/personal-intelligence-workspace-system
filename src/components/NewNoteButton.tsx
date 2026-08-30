"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { createNote } from "@/server/actions/notes";
import { Plus, Loader2 } from "lucide-react";

export function NewNoteButton() {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleCreate = () => {
    startTransition(async () => {
      const res = await createNote();
      if (res && res.success && res.id) {
        router.push(`/notes/${res.id}`);
      }
    });
  };

  return (
    <button
      type="button"
      onClick={handleCreate}
      disabled={isPending}
      className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer disabled:cursor-not-allowed"
    >
      {isPending ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Plus className="w-3.5 h-3.5" />
      )}
      <span>{isPending ? "Creating..." : "New Note"}</span>
    </button>
  );
}

export default NewNoteButton;
