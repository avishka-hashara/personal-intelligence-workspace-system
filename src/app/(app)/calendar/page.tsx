import { getCurrentUser } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { getCalendarData } from "@/server/actions/calendar";
import { CalendarView } from "@/components/calendar/CalendarView";

export const metadata = {
  title: "Calendar & Time-Blocking | Personal Intelligence Workspace",
  description: "Drag-and-drop time-blocking grid with capacity warnings and overlap protection.",
};

interface CalendarPageProps {
  searchParams: Promise<{
    d?: string;
    view?: string;
  }>;
}

function formatDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default async function CalendarPage(props: CalendarPageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const searchParams = await props.searchParams;
  const currentDateStr = searchParams.d || formatDateStr(new Date());
  const currentView = searchParams.view === "day" ? "day" : "week";

  const [y, m, d] = currentDateStr.split("-").map(Number);
  const targetDate = new Date(y, m - 1, d);

  let startDate: Date;
  let endDate: Date;

  if (currentView === "day") {
    startDate = new Date(y, m - 1, d, 0, 0, 0);
    endDate = new Date(y, m - 1, d, 23, 59, 59, 999);
  } else {
    // Week view: Find Monday of that week
    const dayOfWeek = targetDate.getDay();
    const distanceToMonday = (dayOfWeek + 6) % 7;
    const monday = new Date(targetDate);
    monday.setDate(targetDate.getDate() - distanceToMonday);

    startDate = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate(), 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    endDate = new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate(), 23, 59, 59, 999);
  }

  const { timeBlocks, availableMinutesPerDay, unscheduledTasks } = await getCalendarData(
    startDate,
    endDate,
    user.id
  );

  return (
    <div className="p-4 sm:p-6 md:p-8 min-h-screen bg-slate-50/50">
      <CalendarView
        initialTimeBlocks={timeBlocks}
        availableMinutesPerDay={availableMinutesPerDay}
        unscheduledTasks={unscheduledTasks}
        currentDateStr={currentDateStr}
        currentView={currentView}
      />
    </div>
  );
}
