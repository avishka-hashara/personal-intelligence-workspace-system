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
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Knowledge Base
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-medium">
              {userNotes.length} {userNotes.length === 1 ? "Note" : "Notes"}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mt-1">
            Notes & Knowledge
          </h1>
          <p className="text-sm text-slate-500 mt-1">
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
            {userNotes.map((note) => {
              const preview = note.content
                ? note.content
                    .replace(/^[#*>-]+\s+/gm, "")
                    .replace(/[`*_[\]()]/g, "")
                    .trim()
                : "Empty note";

              return (
                <Link
                  key={note.id}
                  href={`/notes/${note.id}`}
                  className="group bg-white border border-slate-200 hover:border-slate-300 rounded-2xl p-5 shadow-xs hover:shadow transition-all flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100 group-hover:bg-indigo-100/80 transition-colors shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {formatDistanceToNow(new Date(note.updatedAt), { addSuffix: true })}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1">
                      {note.title || "Untitled Note"}
                    </h3>

                    <p className="text-xs text-slate-500 line-clamp-3 leading-relaxed">
                      {preview}
                    </p>
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                    <span>
                      {format(new Date(note.updatedAt), "MMM d, yyyy")}
                    </span>

                    <span className="inline-flex items-center gap-1 font-medium text-slate-500 group-hover:text-slate-900 group-hover:translate-x-0.5 transition-all">
                      <span>Open Note</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-12 text-center flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
              <FileText className="w-6 h-6" />
            </div>
            <div className="max-w-md">
              <h3 className="text-base font-bold text-slate-900">No notes written yet</h3>
              <p className="text-xs text-slate-500 mt-1">
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
