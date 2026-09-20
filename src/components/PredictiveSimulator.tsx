"use client";

import React, { useState } from "react";
import {
  runLifeSimulation,
  optimizeSchedule,
  applyOptimizedSchedule,
  SimulationResult,
  OptimizedScheduleResult,
  DailyRiskScore,
} from "@/server/actions/simulation";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from "recharts";
import {
  BrainCircuit,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  RefreshCw,
  Calendar,
  Activity,
  Lightbulb,
  ShieldAlert,
  Dna,
  Zap,
  ArrowRight,
  Check,
} from "lucide-react";
import { format, parseISO } from "date-fns";

export default function PredictiveSimulator() {
  const [loadingSim, setLoadingSim] = useState(false);
  const [loadingOpt, setLoadingOpt] = useState(false);
  const [applyingOpt, setApplyingOpt] = useState(false);
  const [appliedSuccess, setAppliedSuccess] = useState(false);

  const [simulationData, setSimulationData] = useState<SimulationResult | null>(null);
  const [optimizationData, setOptimizationData] = useState<OptimizedScheduleResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleRunSimulation = async () => {
    setLoadingSim(true);
    setErrorMsg(null);
    setAppliedSuccess(false);
    try {
      const res = await runLifeSimulation();
      if (res.success && res.data) {
        setSimulationData(res.data);
      } else {
        setErrorMsg(res.error || "Failed to run simulation");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred.");
    } finally {
      setLoadingSim(false);
    }
  };

  const handleRunOptimization = async () => {
    setLoadingOpt(true);
    setErrorMsg(null);
    setAppliedSuccess(false);
    try {
      const res = await optimizeSchedule();
      if (res.success && res.data) {
        setOptimizationData(res.data);
      } else {
        setErrorMsg(res.error || "Failed to run genetic schedule optimizer");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred.");
    } finally {
      setLoadingOpt(false);
    }
  };

  const handleApplyOptimization = async () => {
    if (!optimizationData || !optimizationData.task_updates.length) return;
    setApplyingOpt(true);
    setErrorMsg(null);
    try {
      const res = await applyOptimizedSchedule(optimizationData.task_updates);
      if (res.success) {
        setAppliedSuccess(true);
        // Re-run standard simulation to reflect newly patched database state
        await handleRunSimulation();
      } else {
        setErrorMsg(res.error || "Failed to apply optimized dates to tasks");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to patch database tasks.");
    } finally {
      setApplyingOpt(false);
    }
  };

  // Combine original vs optimized risk timeline for dual Recharts AreaChart
  const combinedChartData = React.useMemo(() => {
    const originalScores = simulationData?.risk_scores || [];
    const optimizedScores = optimizationData?.optimized_risk_timeline || [];

    const map = new Map<string, { date: string; formattedDate: string; originalRisk?: number; optimizedRisk?: number }>();

    for (const item of originalScores) {
      map.set(item.date, {
        date: item.date,
        formattedDate: format(parseISO(item.date), "MMM d"),
        originalRisk: item.burnout_risk,
      });
    }

    for (const item of optimizedScores) {
      const existing = map.get(item.date) || {
        date: item.date,
        formattedDate: format(parseISO(item.date), "MMM d"),
      };
      existing.optimizedRisk = item.burnout_risk;
      map.set(item.date, existing);
    }

    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [simulationData, optimizationData]);

  // Statistics
  const avgRisk = simulationData?.risk_scores.length
    ? Math.round(
        simulationData.risk_scores.reduce((acc, r) => acc + r.burnout_risk, 0) /
          simulationData.risk_scores.length
      )
    : 0;

  const bottleneckCount = simulationData?.predicted_bottleneck_dates.length || 0;

  return (
    <section className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800/80 rounded-2xl p-6 shadow-subtle flex flex-col gap-6">
      {/* Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500/20 via-purple-500/20 to-pink-500/20 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5">
            <BrainCircuit className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
                Predictive Life Simulation & Genetic Optimizer
              </h2>
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/50">
                Fuzzy Logic + DEAP AI
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
              Simulate 30-day burnout trajectories and run Evolutionary Genetic Algorithms to auto-flatten workload bottlenecks.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <button
            onClick={handleRunSimulation}
            disabled={loadingSim || loadingOpt}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-zinc-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-zinc-900 font-semibold text-xs shadow-sm transition-all cursor-pointer disabled:opacity-60 shrink-0"
          >
            {loadingSim ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Simulating...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Simulate Timeline</span>
              </>
            )}
          </button>

          <button
            onClick={handleRunOptimization}
            disabled={loadingSim || loadingOpt}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-md hover:shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-60 shrink-0"
          >
            {loadingOpt ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-white" />
                <span>Running DEAP Genetic Algorithm...</span>
              </>
            ) : (
              <>
                <Dna className="w-4 h-4 text-emerald-200" />
                <span>Auto-Optimize Schedule (GA)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-800 dark:text-rose-300 text-xs flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Success Patch Alert */}
      {appliedSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold">
            <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Successfully updated task schedule dates in your database!</span>
          </div>
        </div>
      )}

      {/* Genetic Optimization Comparison Banner */}
      {optimizationData && (
        <div className="p-5 rounded-xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-indigo-500/10 dark:from-emerald-950/40 dark:via-teal-950/30 dark:to-indigo-950/40 border border-emerald-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 shrink-0">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                Genetic Algorithm Result Summary
              </div>
              <div className="text-sm font-semibold text-slate-900 dark:text-zinc-100 mt-0.5">
                Reduced Peak Burnout Risk from{" "}
                <span className="text-rose-600 dark:text-rose-400 font-mono font-bold">
                  {optimizationData.before_peak_risk}%
                </span>{" "}
                down to{" "}
                <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">
                  {optimizationData.after_peak_risk}%
                </span>{" "}
                ({optimizationData.risk_reduction_percent}% risk reduction)
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                Re-assigned {optimizationData.task_updates.length} task due date(s) across the 30-day window to eliminate peak workload crunches.
              </p>
            </div>
          </div>

          <button
            onClick={handleApplyOptimization}
            disabled={applyingOpt || appliedSuccess}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-md transition-all cursor-pointer disabled:opacity-60 shrink-0"
          >
            {applyingOpt ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Applying Database Patch...</span>
              </>
            ) : appliedSuccess ? (
              <>
                <Check className="w-4 h-4" />
                <span>Schedule Applied!</span>
              </>
            ) : (
              <>
                <span>Apply Optimized Schedule</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      )}

      {/* Main Dashboard Output */}
      {simulationData || optimizationData ? (
        <div className="flex flex-col gap-6">
          {/* Top Key Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200/60 dark:border-zinc-700/60 flex items-center gap-3">
              <div className={`p-2.5 rounded-lg ${avgRisk >= 60 ? "bg-rose-500/20 text-rose-600" : avgRisk >= 35 ? "bg-amber-500/20 text-amber-600" : "bg-emerald-500/20 text-emerald-600"}`}>
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-slate-500 dark:text-zinc-400 font-medium">Average 30-Day Risk</div>
                <div className="text-lg font-bold text-slate-900 dark:text-zinc-100 font-mono">
                  {avgRisk}%{" "}
                  <span className="text-xs font-normal text-slate-500">
                    ({avgRisk >= 60 ? "High" : avgRisk >= 35 ? "Medium" : "Optimal"})
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200/60 dark:border-zinc-700/60 flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-slate-500 dark:text-zinc-400 font-medium">Bottleneck Days</div>
                <div className="text-lg font-bold text-slate-900 dark:text-zinc-100 font-mono">
                  {bottleneckCount} {bottleneckCount === 1 ? "Day" : "Days"}
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200/60 dark:border-zinc-700/60 flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-indigo-500/20 text-indigo-600 dark:text-indigo-400">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-slate-500 dark:text-zinc-400 font-medium">Simulation Horizon</div>
                <div className="text-lg font-bold text-slate-900 dark:text-zinc-100 font-mono">
                  30 Days Forward
                </div>
              </div>
            </div>
          </div>

          {/* Recharts Area Chart */}
          <div className="p-5 rounded-xl bg-slate-50/50 dark:bg-zinc-950/40 border border-slate-200/80 dark:border-zinc-800/80 flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-zinc-300">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-500" />
                <span>30-Day Burnout Risk Curve (%)</span>
              </div>
              <div className="flex items-center gap-4 text-[11px] font-normal text-slate-500 dark:text-zinc-400">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" /> Original Risk
                </span>
                {optimizationData && (
                  <span className="flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Flattened GA Risk
                  </span>
                )}
              </div>
            </div>

            <div className="h-64 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={combinedChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="origGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#818cf8" stopOpacity={0.6} />
                      <stop offset="95%" stopColor="#818cf8" stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="optGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.6} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="formattedDate"
                    stroke="#94a3b8"
                    fontSize={10}
                    tickLine={false}
                    axisLine={{ stroke: "#e2e8f0" }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    stroke="#94a3b8"
                    fontSize={10}
                    tickLine={false}
                    axisLine={{ stroke: "#e2e8f0" }}
                    unit="%"
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="p-3 rounded-lg bg-slate-900 dark:bg-zinc-800 text-white text-xs shadow-lg border border-slate-700 flex flex-col gap-1">
                            <div className="font-bold text-slate-200">{data.formattedDate}</div>
                            {data.originalRisk !== undefined && (
                              <div className="flex items-center justify-between gap-3 text-indigo-300">
                                <span>Original Risk:</span>
                                <span className="font-bold font-mono">{data.originalRisk}%</span>
                              </div>
                            )}
                            {data.optimizedRisk !== undefined && (
                              <div className="flex items-center justify-between gap-3 text-emerald-400 font-semibold">
                                <span>Flattened GA Risk:</span>
                                <span className="font-bold font-mono">{data.optimizedRisk}%</span>
                              </div>
                            )}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <ReferenceLine y={70} stroke="#f43f5e" strokeDasharray="3 3" label={{ value: "Critical Risk Threshold (70%)", fill: "#f43f5e", fontSize: 10, position: "top" }} />
                  <ReferenceLine y={35} stroke="#f59e0b" strokeDasharray="3 3" />

                  {/* Original Risk Area */}
                  {simulationData && (
                    <Area
                      type="monotone"
                      dataKey="originalRisk"
                      name="Original Risk"
                      stroke="#6366f1"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#origGradient)"
                    />
                  )}

                  {/* Optimized Risk Area Overlay */}
                  {optimizationData && (
                    <Area
                      type="monotone"
                      dataKey="optimizedRisk"
                      name="Optimized Risk"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#optGradient)"
                    />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bottom Grid: Bottleneck Warnings & Task Re-assignments */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Bottleneck Warnings Card */}
            <div className="p-4 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/40 flex flex-col gap-3">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-900 dark:text-amber-300">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>Bottleneck Warning Dates</span>
              </div>
              {simulationData?.predicted_bottleneck_dates && simulationData.predicted_bottleneck_dates.length > 0 ? (
                <ul className="flex flex-col gap-2">
                  {simulationData.predicted_bottleneck_dates.map((dateStr, idx) => (
                    <li
                      key={idx}
                      className="p-2.5 rounded-lg bg-white/80 dark:bg-zinc-800/80 border border-amber-200/60 dark:border-amber-900/50 text-xs flex items-center justify-between"
                    >
                      <span className="font-semibold text-slate-800 dark:text-zinc-200 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-rose-500" />
                        {format(parseISO(dateStr), "EEEE, MMMM d, yyyy")}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 font-mono text-[10px] font-bold">
                        High Workload Crunch
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="p-3 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-lg border border-emerald-200/50 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>No critical bottleneck dates detected for the upcoming 30 days!</span>
                </div>
              )}
            </div>

            {/* AI Recommendations / Optimized Schedule Patch Details */}
            <div className="p-4 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/70 dark:border-indigo-900/40 flex flex-col gap-3">
              <div className="flex items-center gap-2 text-xs font-bold text-indigo-900 dark:text-indigo-300">
                <Lightbulb className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>{optimizationData ? "Optimized Task Date Re-assignments" : "AI Schedule Recommendations"}</span>
              </div>

              {optimizationData ? (
                <ul className="flex flex-col gap-2">
                  {optimizationData.task_updates.map((update, idx) => (
                    <li
                      key={idx}
                      className="p-2.5 rounded-lg bg-white/80 dark:bg-zinc-800/80 border border-indigo-200/60 dark:border-indigo-900/50 text-xs flex items-center justify-between gap-2"
                    >
                      <span className="font-medium text-slate-800 dark:text-zinc-200 truncate">
                        {update.title}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0 text-[11px] font-mono">
                        <span className="text-slate-400 line-through">
                          {update.original_due_date ? format(parseISO(update.original_due_date), "MMM d") : "No date"}
                        </span>
                        <ArrowRight className="w-3 h-3 text-emerald-500" />
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                          {format(parseISO(update.optimized_due_date), "MMM d")}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : simulationData?.alternate_schedule_recommendations ? (
                <ul className="flex flex-col gap-2">
                  {simulationData.alternate_schedule_recommendations.map((rec, idx) => (
                    <li
                      key={idx}
                      className="p-2.5 rounded-lg bg-white/80 dark:bg-zinc-800/80 border border-indigo-200/60 dark:border-indigo-900/50 text-xs text-slate-700 dark:text-zinc-300 flex items-start gap-2"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0 mt-1.5" />
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <div className="p-8 rounded-xl bg-slate-50/50 dark:bg-zinc-800/30 border border-dashed border-slate-200 dark:border-zinc-800 text-center flex flex-col items-center justify-center gap-3">
          <div className="p-3 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
            <BrainCircuit className="w-6 h-6" />
          </div>
          <div className="max-w-md">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
              Ready to Simulate & Auto-Optimize Your 30-Day Horizon
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
              Click <strong>Simulate Timeline</strong> to view burnout predictions or <strong>Auto-Optimize Schedule (GA)</strong> to run DEAP evolutionary algorithms.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
