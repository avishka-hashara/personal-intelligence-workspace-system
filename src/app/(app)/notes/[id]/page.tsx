import { db } from "@/server/db";
import { notes } from "@/server/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { getCurrentUser } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { NoteEditor } from "@/components/NoteEditor";

interface NoteDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function NoteDetailPage({ params }: NoteDetailPageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { id } = await params;

  const [note] = await db
    .select()
    .from(notes)
    .where(
      and(
        eq(notes.id, id),
        eq(notes.userId, user.id),
        isNull(notes.deletedAt)
      )
    )
    .limit(1);

  if (!note) {
    redirect("/notes");
  }

  return <NoteEditor note={note} />;
}
