import { getCurrentUser } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { getAISettings } from "@/server/actions/ai-settings";
import { AISettingsManager } from "@/components/settings/AISettingsManager";

export const metadata = {
  title: "AI & Privacy Settings | Personal Intelligence Workspace",
  description: "Configure AI inference features, spend caps, and inspect the Data Egress Map.",
};

export default async function AISettingsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const initialSettings = await getAISettings(user.id);

  return (
    <div className="p-4 sm:p-8 min-h-screen bg-slate-50/50">
      <AISettingsManager initialSettings={initialSettings} />
    </div>
  );
}
