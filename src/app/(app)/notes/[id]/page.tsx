import { db } from "@/server/db";
import { notes } from "@/server/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { getCurrentUser } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { NoteEditor } from "@/components/NoteEditor";
import { getNodeConnections } from "@/server/actions/nodes";

interface NoteDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function NoteDetailPage({ params }: NoteDetailPageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { id } = await params;

  // 1. Fetch Note
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

  // 2. Fetch Node Connections (Forward links & Backlinks)
  const connections = await getNodeConnections(id);

  return <NoteEditor note={note} connections={connections} />;
}
