import { db } from "@/server/db";
import { metricDefinitions, metricLogs } from "@/server/db/schema";
import { eq, and, isNull, desc, gte } from "drizzle-orm";
import { getCurrentUser } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { HealthDashboard } from "@/components/health/HealthDashboard";
import { subDays, format } from "date-fns";

export default async function HealthPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  // 1. Fetch Metric Definitions
  const userMetrics = await db
    .select({
      id: metricDefinitions.id,
      name: metricDefinitions.name,
      unit: metricDefinitions.unit,
    })
    .from(metricDefinitions)
    .where(
      and(
        eq(metricDefinitions.userId, user.id),
        isNull(metricDefinitions.deletedAt)
      )
    )
    .orderBy(metricDefinitions.name);

  // 2. Fetch Metric Logs for the last 14 days
  const startDate = subDays(new Date(), 14);
  const startDateStr = format(startDate, "yyyy-MM-dd");

  const userLogs = await db
    .select({
      id: metricLogs.id,
      metricId: metricLogs.metricId,
      loggedOn: metricLogs.loggedOn,
      value: metricLogs.value,
      createdAt: metricLogs.createdAt,
      metricName: metricDefinitions.name,
      metricUnit: metricDefinitions.unit,
    })
    .from(metricLogs)
    .innerJoin(
      metricDefinitions,
      eq(metricLogs.metricId, metricDefinitions.id)
    )
    .where(
      and(
        eq(metricLogs.userId, user.id),
        gte(metricLogs.loggedOn, startDateStr),
        isNull(metricLogs.deletedAt),
        isNull(metricDefinitions.deletedAt)
      )
    )
    .orderBy(desc(metricLogs.loggedOn), desc(metricLogs.createdAt));

  return <HealthDashboard metrics={userMetrics} logs={userLogs} />;
}
