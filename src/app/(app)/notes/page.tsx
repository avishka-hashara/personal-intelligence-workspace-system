import { db } from "@/server/db";
import { notes } from "@/server/db/schema";
import { eq, and, isNull, desc } from "drizzle-orm";
import { getCurrentUser } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  FileText,
  Clock,
  Sparkles,
  ArrowRight,
  BookOpen,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { NewNoteButton } from "@/components/NewNoteButton";
import { NoteCard } from "@/components/NoteCard";

export default async function NotesPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const userNotes = await db
    .select()
    .from(notes)
    .where(
      and(
        eq(notes.userId, user.id),
        isNull(notes.deletedAt)
      )
    )
    .orderBy(desc(notes.updatedAt));

  return (
    <div className="flex flex-col gap-8 pb-12">
      {/* Page Header */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-muted-foreground">
              Knowledge Base
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/50 font-medium">
              {userNotes.length} {userNotes.length === 1 ? "Note" : "Notes"}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-foreground tracking-tight mt-1">
            Notes & Knowledge
          </h1>
          <p className="text-sm text-slate-500 dark:text-muted-foreground mt-1">
            Capture thoughts, markdown documents, ideas, and polymorphic node references.
          </p>
        </div>

        <div>
          <NewNoteButton />
        </div>
      </header>

      {/* Notes Grid */}
      <section className="space-y-4">
        {userNotes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {userNotes.map((note) => (
              <NoteCard key={note.id} note={note} />
            ))}
          </div>
        ) : (
          <div className="bg-white dark:bg-card border border-dashed border-slate-200 dark:border-border rounded-2xl p-12 text-center flex flex-col items-center justify-center gap-3 shadow-xs dark:shadow-none">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-100 dark:border-indigo-800/50">
              <FileText className="w-6 h-6" />
            </div>
            <div className="max-w-md">
              <h3 className="text-base font-bold text-slate-900 dark:text-foreground">No notes written yet</h3>
              <p className="text-xs text-slate-500 dark:text-muted-foreground mt-1">
                Create your first markdown note to capture lectures, research ideas, or project thoughts.
              </p>
            </div>
            <div className="pt-2">
              <NewNoteButton />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
