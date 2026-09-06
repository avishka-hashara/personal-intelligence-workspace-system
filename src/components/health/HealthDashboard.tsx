"use client";

import React, { useState, useEffect, useTransition } from "react";
import { format, subDays, parseISO, isSameDay } from "date-fns";
import {
  Activity,
  Heart,
  Droplets,
  Moon,
  Footprints,
  Smile,
  Plus,
  Trash2,
  Calendar,
  Sparkles,
  ChevronRight,
  X,
  Check,
  TrendingUp,
  Sliders,
  History,
} from "lucide-react";
import dynamic from "next/dynamic";

const HealthMetricChart = dynamic(
  () => import("@/components/health/HealthMetricChart"),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full flex items-center justify-center bg-zinc-50 dark:bg-zinc-800/50 rounded-xl">
        <div className="h-1.5 w-24 bg-zinc-200 dark:bg-zinc-700 rounded-full animate-pulse" />
      </div>
    ),
  }
);
import {
  createMetricLog,
  deleteMetricLog,
  createMetricDefinition,
  deleteMetricDefinition,
  seedDefaultMetrics,
} from "@/server/actions/extensions";

interface MetricDefinition {
  id: string;
  name: string;
  unit: string;
}

interface MetricLog {
  id: string;
  metricId: string;
  loggedOn: string;
  value: string;
  createdAt: Date | string;
  metricName?: string;
  metricUnit?: string;
}

interface HealthDashboardProps {
  metrics: MetricDefinition[];
  logs: MetricLog[];
}

const METRIC_THEMES: Record<
  string,
  {
    icon: React.ComponentType<any>;
    color: string;
    stroke: string;
    fill: string;
    bg: string;
    border: string;
  }
> = {
  sleep: {
    icon: Moon,
    color: "text-indigo-600 dark:text-indigo-400",
    stroke: "#6366f1",
    fill: "#e0e7ff",
    bg: "bg-indigo-50/70 dark:bg-indigo-950/30",
    border: "border-indigo-200/60 dark:border-indigo-800/40",
  },
  water: {
    icon: Droplets,
    color: "text-sky-600 dark:text-sky-400",
    stroke: "#0284c7",
    fill: "#e0f2fe",
    bg: "bg-sky-50/70 dark:bg-sky-950/30",
    border: "border-sky-200/60 dark:border-sky-800/40",
  },
  movement: {
    icon: Footprints,
    color: "text-emerald-600 dark:text-emerald-400",
    stroke: "#059669",
    fill: "#d1fae5",
    bg: "bg-emerald-50/70 dark:bg-emerald-950/30",
    border: "border-emerald-200/60 dark:border-emerald-800/40",
  },
  mood: {
    icon: Smile,
    color: "text-amber-600 dark:text-amber-400",
    stroke: "#d97706",
    fill: "#fef3c7",
    bg: "bg-amber-50/70 dark:bg-amber-950/30",
    border: "border-amber-200/60 dark:border-amber-800/40",
  },
};

const DEFAULT_THEME = {
  icon: Activity,
  color: "text-zinc-600 dark:text-zinc-400",
  stroke: "#71717a",
  fill: "#f4f4f5",
  bg: "bg-zinc-100 dark:bg-zinc-800",
  border: "border-zinc-200/60 dark:border-zinc-700/50",
};

export function HealthDashboard({ metrics, logs }: HealthDashboardProps) {
  const [isPending, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);

  // Modals
  const [showAddLog, setShowAddLog] = useState(false);
  const [showAddMetric, setShowAddMetric] = useState(false);

  // Quick Log State
  const [selectedMetricId, setSelectedMetricId] = useState(metrics[0]?.id || "");
  const [logDate, setLogDate] = useState(new Date().toISOString().split("T")[0]);
  const [logValue, setLogValue] = useState("");

  // New Metric Definition State
  const [newMetricName, setNewMetricName] = useState("");
  const [newMetricUnit, setNewMetricUnit] = useState("");

  // Filter History
  const [historyMetricFilter, setHistoryMetricFilter] = useState("all");

  useEffect(() => {
    setMounted(true);
  }, []);

  // Compute 14-day date range array
  const last14Days = Array.from({ length: 14 }, (_, i) => {
    const d = subDays(new Date(), 13 - i);
    return format(d, "yyyy-MM-dd");
  });

  const todayStr = format(new Date(), "yyyy-MM-dd");

  const handleCreateLog = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(logValue);
    if (!selectedMetricId || isNaN(val)) return;

    startTransition(async () => {
      await createMetricLog({
        metricId: selectedMetricId,
        loggedOn: logDate,
        value: val,
      });
      setLogValue("");
      setShowAddLog(false);
    });
  };

  const handleCreateMetric = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMetricName.trim() || !newMetricUnit.trim()) return;

    startTransition(async () => {
      await createMetricDefinition({
        name: newMetricName.trim(),
        unit: newMetricUnit.trim(),
      });
      setNewMetricName("");
      setNewMetricUnit("");
      setShowAddMetric(false);
    });
  };

  const handleSeedDefaults = () => {
    startTransition(async () => {
      await seedDefaultMetrics();
    });
  };

  const selectedMetric = metrics.find((m) => m.id === selectedMetricId) || metrics[0];

  const filteredLogs =
    historyMetricFilter === "all"
      ? logs
      : logs.filter((l) => l.metricId === historyMetricFilter);

  return (
    <div className="flex flex-col gap-8 pb-16">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              Extensions
            </span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200/70 dark:border-zinc-700/70 font-medium flex items-center gap-1.5">
              <Heart className="w-3 h-3 text-rose-500" />
              Health & Routine-lite
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight mt-1">
            Health & Routines
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Monitor 14-day biometric and habit trends with lightweight daily logs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {metrics.length > 0 && (
            <button
              type="button"
              onClick={() => setShowAddLog(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-sm font-medium shadow-subtle hover:shadow-float active:scale-[0.98] transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Log Entry</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowAddMetric(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-800/80 text-zinc-700 dark:text-zinc-300 text-sm font-medium shadow-subtle hover:shadow-float active:scale-[0.98] transition-all cursor-pointer"
          >
            <Sliders className="w-4 h-4" />
            <span>Manage Metrics</span>
          </button>
        </div>
      </header>

      {/* Empty State / Seed Prompt */}
      {metrics.length === 0 && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/70 dark:border-zinc-800/70 p-8 text-center flex flex-col items-center justify-center gap-4 shadow-subtle">
          <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 flex items-center justify-center shadow-subtle">
            <Sparkles className="w-5 h-5 text-indigo-500" />
          </div>
          <div className="max-w-md">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
              Set Up Your Health Tracking
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              Track essential habits like Sleep, Water, Movement, and Mood with zero friction.
            </p>
          </div>
          <div className="flex items-center gap-3 mt-2">
            <button
              type="button"
              onClick={handleSeedDefaults}
              disabled={isPending}
              className="px-4 py-2 rounded-xl bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-semibold shadow-subtle transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Initialize Default Metrics</span>
            </button>
            <button
              type="button"
              onClick={() => setShowAddMetric(true)}
              className="px-4 py-2 rounded-xl bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-800/80 text-zinc-700 dark:text-zinc-300 text-xs font-medium shadow-subtle transition-all cursor-pointer"
            >
              + Create Custom Metric
            </button>
          </div>
        </div>
      )}

      {/* Metrics Grid with 14-Day Sparklines */}
      {metrics.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {metrics.map((metric) => {
            const key = metric.name.toLowerCase();
            const theme = METRIC_THEMES[key] || DEFAULT_THEME;
            const Icon = theme.icon;

            // Extract logs for this metric
            const metricLogsList = logs.filter((l) => l.metricId === metric.id);

            // Map each day in last14Days to a value
            const chartData = last14Days.map((dayStr) => {
              const matchingLogs = metricLogsList.filter((l) => l.loggedOn === dayStr);
              const val = matchingLogs.length > 0 ? parseFloat(matchingLogs[0].value) : null;
              return {
                date: dayStr,
                label: format(parseISO(dayStr), "MMM d"),
                value: val,
              };
            });

            // Calculate stats
            const loggedValues = chartData
              .filter((d) => d.value !== null)
              .map((d) => d.value as number);

            const todayLog = metricLogsList.find((l) => l.loggedOn === todayStr);
            const todayValue = todayLog ? parseFloat(todayLog.value) : null;

            const averageVal =
              loggedValues.length > 0
                ? (loggedValues.reduce((a, b) => a + b, 0) / loggedValues.length).toFixed(1)
                : "—";

            return (
              <div
                key={metric.id}
                className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/70 dark:border-zinc-800/70 p-5 shadow-subtle hover:shadow-float transition-all duration-200 flex flex-col justify-between"
              >
                {/* Metric Card Header */}
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-xl ${theme.bg} ${theme.color} border ${theme.border} flex items-center justify-center`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
                          {metric.name}
                        </h2>
                        <span className="text-xs text-zinc-400 dark:text-zinc-500 font-medium">
                          unit: {metric.unit}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedMetricId(metric.id);
                        setShowAddLog(true);
                      }}
                      className="text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 border border-zinc-200/70 dark:border-zinc-700/70 px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Log</span>
                    </button>
                  </div>

                  {/* Summary Values */}
                  <div className="grid grid-cols-2 gap-4 mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800/70">
                    <div>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                        Today
                      </span>
                      <div className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 font-mono tabular-nums mt-0.5">
                        {todayValue !== null ? (
                          <span>
                            {todayValue}{" "}
                            <span className="text-xs font-normal text-zinc-400 font-sans">
                              {metric.unit}
                            </span>
                          </span>
                        ) : (
                          <span className="text-zinc-300 dark:text-zinc-600 text-sm font-normal font-sans">
                            Not logged
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                        14-Day Avg
                      </span>
                      <div className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 font-mono tabular-nums mt-0.5">
                        {averageVal !== "—" ? (
                          <span>
                            {averageVal}{" "}
                            <span className="text-xs font-normal text-zinc-400 font-sans">
                              {metric.unit}
                            </span>
                          </span>
                        ) : (
                          <span className="text-zinc-300 dark:text-zinc-600 text-sm font-normal font-sans">
                            No data
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 14-Day Sparkline / Chart */}
                <div className="mt-5 pt-3 border-t border-zinc-100 dark:border-zinc-800/70">
                  <div className="flex items-center justify-between text-[11px] text-zinc-400 dark:text-zinc-500 mb-2">
                    <span>14-day history</span>
                    <span className="font-mono">{format(subDays(new Date(), 13), "MMM d")} - Today</span>
                  </div>

                  <div className="h-28 w-full">
                    {mounted ? (
                      <HealthMetricChart
                        data={chartData}
                        metricId={metric.id}
                        metricUnit={metric.unit}
                        stroke={theme.stroke}
                      />
                    ) : (
                      <div className="h-full bg-zinc-50 dark:bg-zinc-800/50 rounded-lg animate-pulse" />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 14-Day Log History */}
      {logs.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/70 dark:border-zinc-800/70 p-5 shadow-subtle">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-zinc-100 dark:border-zinc-800/70">
            <div>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight flex items-center gap-2">
                <History className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
                Recent 14-Day Log History
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Detailed record of all logged entries
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={historyMetricFilter}
                onChange={(e) => setHistoryMetricFilter(e.target.value)}
                className="text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-700/80 rounded-xl px-2.5 py-1.5 text-zinc-700 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-zinc-100/10"
              >
                <option value="all">All Metrics</option>
                {metrics.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800/70">
            {filteredLogs.map((log) => {
              const logDateObj = parseISO(log.loggedOn);
              return (
                <div
                  key={log.id}
                  className="group py-3 first:pt-0 last:pb-0 flex items-center justify-between text-xs hover:bg-zinc-50/80 dark:hover:bg-zinc-800/50 -mx-2 px-2 rounded-xl transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 flex items-center justify-center font-bold text-xs">
                      <Activity className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {log.metricName || "Metric"}
                      </div>
                      <div className="text-zinc-400 dark:text-zinc-500 text-[11px] flex items-center gap-1.5 mt-0.5 font-mono">
                        <Calendar className="w-3 h-3" />
                        {format(logDateObj, "EEEE, MMM d, yyyy")}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right font-semibold font-mono tabular-nums text-sm text-zinc-900 dark:text-zinc-100">
                      {log.value}{" "}
                      <span className="text-xs font-normal text-zinc-400 font-sans">
                        {log.metricUnit}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        startTransition(async () => {
                          await deleteMetricLog(log.id);
                        });
                      }}
                      className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 transition cursor-pointer p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30"
                      title="Delete entry"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* Modals */}
      {/* ------------------------------------------------------------- */}

      {/* Modal: Log Metric */}
      {showAddLog && (
        <div className="fixed inset-0 z-50 bg-black/40 dark:bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 shadow-float max-w-sm w-full p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800/70">
              <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Heart className="w-4 h-4 text-rose-500" />
                Log Metric Entry
              </h3>
              <button
                type="button"
                onClick={() => setShowAddLog(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateLog} className="mt-4 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Metric *
                </label>
                <select
                  value={selectedMetricId}
                  onChange={(e) => setSelectedMetricId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-700/80 rounded-xl text-zinc-900 dark:text-zinc-100 focus:bg-white dark:focus:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-zinc-100/10 transition-all"
                >
                  {metrics.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Date *
                </label>
                <input
                  type="date"
                  required
                  value={logDate}
                  onChange={(e) => setLogDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-700/80 rounded-xl text-zinc-900 dark:text-zinc-100 focus:bg-white dark:focus:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-zinc-100/10 transition-all font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Value ({selectedMetric?.unit || "units"}) *
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="e.g. 7.5"
                  value={logValue}
                  onChange={(e) => setLogValue(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-700/80 rounded-xl text-zinc-900 dark:text-zinc-100 focus:bg-white dark:focus:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-zinc-100/10 transition-all font-mono font-semibold"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800/70">
                <button
                  type="button"
                  onClick={() => setShowAddLog(false)}
                  className="px-3.5 py-1.5 text-xs text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl font-medium cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-1.5 text-xs bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 rounded-xl font-medium shadow-subtle cursor-pointer disabled:opacity-50 transition-all active:scale-[0.98]"
                >
                  {isPending ? "Saving..." : "Save Log"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Manage / Add Metrics */}
      {showAddMetric && (
        <div className="fixed inset-0 z-50 bg-black/40 dark:bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 shadow-float max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800/70">
              <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
                Manage Tracked Metrics
              </h3>
              <button
                type="button"
                onClick={() => setShowAddMetric(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* List existing metrics */}
            <div className="mt-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 block mb-2">
                Active Metrics ({metrics.length})
              </span>
              <div className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800/70 max-h-48 overflow-y-auto pr-1">
                {metrics.length === 0 ? (
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 py-2">
                    No custom or default metrics active.
                  </p>
                ) : (
                  metrics.map((m) => (
                    <div
                      key={m.id}
                      className="py-2.5 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-medium text-zinc-900 dark:text-zinc-100">
                          {m.name}
                        </span>
                        <span className="text-zinc-400 dark:text-zinc-500 ml-2 font-mono">({m.unit})</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          startTransition(async () => {
                            await deleteMetricDefinition(m.id);
                          });
                        }}
                        className="text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 p-1 cursor-pointer transition-colors"
                        title="Delete metric"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Form to add custom metric */}
            <form
              onSubmit={handleCreateMetric}
              className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800/70 flex flex-col gap-3"
            >
              <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                + Add New Custom Metric
              </span>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  required
                  placeholder="Name (e.g. Weight)"
                  value={newMetricName}
                  onChange={(e) => setNewMetricName(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-700/80 rounded-xl text-zinc-900 dark:text-zinc-100 focus:bg-white dark:focus:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-zinc-100/10 transition-all"
                />
                <input
                  type="text"
                  required
                  placeholder="Unit (e.g. kg, mins)"
                  value={newMetricUnit}
                  onChange={(e) => setNewMetricUnit(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-700/80 rounded-xl text-zinc-900 dark:text-zinc-100 focus:bg-white dark:focus:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-zinc-100/10 transition-all font-mono"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                {metrics.length === 0 && (
                  <button
                    type="button"
                    onClick={handleSeedDefaults}
                    className="text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 font-medium cursor-pointer transition-colors"
                  >
                    Seed Defaults
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isPending}
                  className="ml-auto px-4 py-1.5 text-xs bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 rounded-xl font-medium shadow-subtle cursor-pointer disabled:opacity-50 transition-all active:scale-[0.98]"
                >
                  {isPending ? "Adding..." : "Add Metric"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
