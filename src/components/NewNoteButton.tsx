"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { createNote } from "@/server/actions/notes";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NewNoteButtonProps {
  className?: string;
}

export function NewNoteButton({ className }: NewNoteButtonProps) {
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
    <Button
      type="button"
      onClick={handleCreate}
      disabled={isPending}
      className={cn(
        "gap-1.5 px-4 py-2 h-auto text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer disabled:cursor-not-allowed",
        className
      )}
    >
      {isPending ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Plus className="w-3.5 h-3.5" />
      )}
      <span>{isPending ? "Creating..." : "New Note"}</span>
    </Button>
  );
}

export default NewNoteButton;
