import { getCurrentUser } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { getReviews } from "@/server/actions/reviews";
import { JournalReviewDashboard } from "@/components/journal/JournalReviewDashboard";

export const metadata = {
  title: "Journal & Reviews | Personal Intelligence Workspace",
  description: "Periodic weekly and quarterly retrospectives powered by AI-08.",
};

export default async function JournalPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  // Fetch past reviews for initial server rendering
  const initialReviews = await getReviews("all");

  return (
    <div className="p-4 sm:p-8 min-h-screen bg-slate-50/50">
      <JournalReviewDashboard initialReviews={initialReviews} />
    </div>
  );
}
