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
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
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
    color: "text-indigo-600",
    stroke: "#6366f1",
    fill: "#e0e7ff",
    bg: "bg-indigo-50",
    border: "border-indigo-200",
  },
  water: {
    icon: Droplets,
    color: "text-sky-600",
    stroke: "#0284c7",
    fill: "#e0f2fe",
    bg: "bg-sky-50",
    border: "border-sky-200",
  },
  movement: {
    icon: Footprints,
    color: "text-emerald-600",
    stroke: "#059669",
    fill: "#d1fae5",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
  },
  mood: {
    icon: Smile,
    color: "text-amber-600",
    stroke: "#d97706",
    fill: "#fef3c7",
    bg: "bg-amber-50",
    border: "border-amber-200",
  },
};

const DEFAULT_THEME = {
  icon: Activity,
  color: "text-purple-600",
  stroke: "#9333ea",
  fill: "#f3e8ff",
  bg: "bg-purple-50",
  border: "border-purple-200",
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
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Extensions
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-medium flex items-center gap-1">
              <Heart className="w-3 h-3" />
              Health & Routine-lite
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mt-1">
            Health & Routines
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Monitor 14-day biometric and habit trends with lightweight daily logs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {metrics.length > 0 && (
            <button
              type="button"
              onClick={() => setShowAddLog(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium shadow-sm transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Log Entry</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowAddMetric(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-sm font-medium shadow-xs transition cursor-pointer"
          >
            <Sliders className="w-4 h-4" />
            <span>Manage Metrics</span>
          </button>
        </div>
      </header>

      {/* Empty State / Seed Prompt */}
      {metrics.length === 0 && (
        <div className="bg-gradient-to-br from-indigo-50/50 via-white to-purple-50/50 rounded-2xl border border-indigo-100 p-8 text-center flex flex-col items-center justify-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center shadow-xs">
            <Sparkles className="w-6 h-6" />
          </div>
          <div className="max-w-md">
            <h2 className="text-lg font-bold text-slate-900">
              Set Up Your Health Tracking
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Track essential habits like Sleep, Water, Movement, and Mood with zero friction.
            </p>
          </div>
          <div className="flex items-center gap-3 mt-2">
            <button
              type="button"
              onClick={handleSeedDefaults}
              disabled={isPending}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Initialize Default Metrics</span>
            </button>
            <button
              type="button"
              onClick={() => setShowAddMetric(true)}
              className="px-4 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium transition cursor-pointer"
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
              // if multiple, take latest or sum
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
                className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between"
              >
                {/* Metric Card Header */}
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-xl ${theme.bg} ${theme.color} flex items-center justify-center`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <h2 className="text-base font-bold text-slate-900">
                          {metric.name}
                        </h2>
                        <span className="text-xs text-slate-400 font-medium">
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
                      className="text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Log</span>
                    </button>
                  </div>

                  {/* Summary Values */}
                  <div className="grid grid-cols-2 gap-4 mt-4 pt-3 border-t border-slate-100">
                    <div>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Today
                      </span>
                      <div className="text-xl font-bold text-slate-900 mt-0.5">
                        {todayValue !== null ? (
                          <span>
                            {todayValue}{" "}
                            <span className="text-xs font-normal text-slate-500">
                              {metric.unit}
                            </span>
                          </span>
                        ) : (
                          <span className="text-slate-300 text-sm font-normal">
                            Not logged
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        14-Day Avg
                      </span>
                      <div className="text-xl font-bold text-slate-900 mt-0.5">
                        {averageVal !== "—" ? (
                          <span>
                            {averageVal}{" "}
                            <span className="text-xs font-normal text-slate-500">
                              {metric.unit}
                            </span>
                          </span>
                        ) : (
                          <span className="text-slate-300 text-sm font-normal">
                            No data
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 14-Day Sparkline / Chart */}
                <div className="mt-5 pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2">
                    <span>14-day history</span>
                    <span>{format(subDays(new Date(), 13), "MMM d")} - Today</span>
                  </div>

                  <div className="h-28 w-full">
                    {mounted ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={chartData}
                          margin={{ top: 5, right: 5, left: -25, bottom: 0 }}
                        >
                          <defs>
                            <linearGradient
                              id={`grad-${metric.id}`}
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="5%"
                                stopColor={theme.stroke}
                                stopOpacity={0.3}
                              />
                              <stop
                                offset="95%"
                                stopColor={theme.stroke}
                                stopOpacity={0.0}
                              />
                            </linearGradient>
                          </defs>
                          <XAxis
                            dataKey="label"
                            tickLine={false}
                            axisLine={false}
                            tick={{ fontSize: 9, fill: "#94a3b8" }}
                            interval={3}
                          />
                          <YAxis
                            tickLine={false}
                            axisLine={false}
                            tick={{ fontSize: 9, fill: "#94a3b8" }}
                            domain={["dataMin - 1", "dataMax + 1"]}
                          />
                          <Tooltip
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const dataPoint = payload[0].payload;
                                return (
                                  <div className="bg-slate-900 text-white px-2.5 py-1 rounded-lg text-xs shadow-lg">
                                    <div className="text-[10px] text-slate-400">
                                      {dataPoint.label}
                                    </div>
                                    <div className="font-bold">
                                      {dataPoint.value !== null
                                        ? `${dataPoint.value} ${metric.unit}`
                                        : "No entry"}
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey="value"
                            stroke={theme.stroke}
                            strokeWidth={2}
                            fillOpacity={1}
                            fill={`url(#grad-${metric.id})`}
                            connectNulls
                            dot={{
                              r: 2.5,
                              fill: theme.stroke,
                              strokeWidth: 1,
                              stroke: "#fff",
                            }}
                            activeDot={{ r: 5, strokeWidth: 0 }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full bg-slate-50 rounded-lg animate-pulse" />
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
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <History className="w-4 h-4 text-slate-700" />
                Recent 14-Day Log History
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Detailed record of all logged entries
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={historyMetricFilter}
                onChange={(e) => setHistoryMetricFilter(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-hidden"
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

          <div className="mt-4 flex flex-col divide-y divide-slate-100">
            {filteredLogs.map((log) => {
              const logDateObj = parseISO(log.loggedOn);
              return (
                <div
                  key={log.id}
                  className="group py-3 first:pt-0 last:pb-0 flex items-center justify-between text-xs hover:bg-slate-50/60 -mx-2 px-2 rounded-xl transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs">
                      <Activity className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900">
                        {log.metricName || "Metric"}
                      </div>
                      <div className="text-slate-400 text-[11px] flex items-center gap-1.5 mt-0.5">
                        <Calendar className="w-3 h-3" />
                        {format(logDateObj, "EEEE, MMM d, yyyy")}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right font-bold text-sm text-slate-900">
                      {log.value}{" "}
                      <span className="text-xs font-normal text-slate-500">
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
                      className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-600 transition cursor-pointer p-1.5 rounded-lg hover:bg-rose-50"
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
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-sm w-full p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Heart className="w-4 h-4 text-rose-600" />
                Log Metric Entry
              </h3>
              <button
                type="button"
                onClick={() => setShowAddLog(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateLog} className="mt-4 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Metric *
                </label>
                <select
                  value={selectedMetricId}
                  onChange={(e) => setSelectedMetricId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden"
                >
                  {metrics.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Date *
                </label>
                <input
                  type="date"
                  required
                  value={logDate}
                  onChange={(e) => setLogDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Value ({selectedMetric?.unit || "units"}) *
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder={`e.g. 7.5`}
                  value={logValue}
                  onChange={(e) => setLogValue(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden font-semibold"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddLog(false)}
                  className="px-3.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-xl font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-1.5 text-xs bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-semibold cursor-pointer disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-purple-600" />
                Manage Tracked Metrics
              </h3>
              <button
                type="button"
                onClick={() => setShowAddMetric(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* List existing metrics */}
            <div className="mt-4">
              <span className="text-xs font-semibold text-slate-600 block mb-2">
                Active Metrics ({metrics.length})
              </span>
              <div className="flex flex-col divide-y divide-slate-100 max-h-48 overflow-y-auto pr-1">
                {metrics.length === 0 ? (
                  <p className="text-xs text-slate-400 py-2">
                    No custom or default metrics active.
                  </p>
                ) : (
                  metrics.map((m) => (
                    <div
                      key={m.id}
                      className="py-2 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-semibold text-slate-900">
                          {m.name}
                        </span>
                        <span className="text-slate-400 ml-2">({m.unit})</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          startTransition(async () => {
                            await deleteMetricDefinition(m.id);
                          });
                        }}
                        className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
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
              className="mt-4 pt-4 border-t border-slate-100 flex flex-col gap-3"
            >
              <span className="text-xs font-semibold text-slate-900">
                + Add New Custom Metric
              </span>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  required
                  placeholder="Name (e.g. Weight)"
                  value={newMetricName}
                  onChange={(e) => setNewMetricName(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden"
                />
                <input
                  type="text"
                  required
                  placeholder="Unit (e.g. kg, mins)"
                  value={newMetricUnit}
                  onChange={(e) => setNewMetricUnit(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                {metrics.length === 0 && (
                  <button
                    type="button"
                    onClick={handleSeedDefaults}
                    className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold cursor-pointer"
                  >
                    Seed Defaults
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isPending}
                  className="ml-auto px-4 py-1.5 text-xs bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-semibold cursor-pointer disabled:opacity-50"
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
