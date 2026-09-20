"use client";

import React, { useState } from "react";
import {
  runLifeSimulation,
  SimulationResult,
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
} from "lucide-react";
import { format, parseISO } from "date-fns";

export default function PredictiveSimulator() {
  const [loading, setLoading] = useState(false);
  const [simulationData, setSimulationData] = useState<SimulationResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleRunSimulation = async () => {
    setLoading(true);
    setErrorMsg(null);
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
      setLoading(false);
    }
  };

  // Format chart tick dates (e.g. "Sep 22")
  const chartData = (simulationData?.risk_scores || []).map((item) => ({
    ...item,
    formattedDate: format(parseISO(item.date), "MMM d"),
  }));

  // Calculate statistics
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500/20 via-purple-500/20 to-pink-500/20 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5">
            <BrainCircuit className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
                Predictive Life Simulation Engine
              </h2>
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/50">
                Fuzzy Logic AI
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
              Simulate your 30-day forward burnout risk trajectory before committing to new goals or sprint workloads.
            </p>
          </div>
        </div>

        <button
          onClick={handleRunSimulation}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-xs shadow-md hover:shadow-indigo-500/20 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed shrink-0"
        >
          {loading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin text-white" />
              <span>Evaluating Fuzzy Model...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>Run 30-Day Predictive Simulation</span>
            </>
          )}
        </button>
      </div>

      {/* Error Alert */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-800 dark:text-rose-300 text-xs flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Dashboard Output */}
      {simulationData ? (
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
                <span>30-Day Burnout Risk Trajectory (%)</span>
              </div>
              <div className="flex items-center gap-4 text-[11px] font-normal text-slate-500 dark:text-zinc-400">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> &lt;35% Low
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> 35-70% Medium
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> &gt;70% Critical
                </span>
              </div>
            </div>

            <div className="h-64 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="riskGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.8} />
                      <stop offset="45%" stopColor="#f59e0b" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.1} />
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
                        const data = payload[0].payload as DailyRiskScore & { formattedDate: string };
                        return (
                          <div className="p-3 rounded-lg bg-slate-900 dark:bg-zinc-800 text-white text-xs shadow-lg border border-slate-700">
                            <div className="font-bold text-slate-200">{data.formattedDate}</div>
                            <div className="mt-1 flex items-center justify-between gap-3">
                              <span className="text-slate-400">Burnout Risk:</span>
                              <span
                                className={`font-bold font-mono ${
                                  data.burnout_risk >= 70
                                    ? "text-rose-400"
                                    : data.burnout_risk >= 35
                                    ? "text-amber-400"
                                    : "text-emerald-400"
                                }`}
                              >
                                {data.burnout_risk}% ({data.risk_level})
                              </span>
                            </div>
                            <div className="mt-0.5 flex items-center justify-between gap-3">
                              <span className="text-slate-400">Est. Daily Workload:</span>
                              <span className="font-mono text-slate-300">{data.task_load} hrs</span>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <ReferenceLine y={70} stroke="#f43f5e" strokeDasharray="3 3" label={{ value: "Critical Risk Threshold (70%)", fill: "#f43f5e", fontSize: 10, position: "top" }} />
                  <ReferenceLine y={35} stroke="#f59e0b" strokeDasharray="3 3" />
                  <Area
                    type="monotone"
                    dataKey="burnout_risk"
                    stroke="#6366f1"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#riskGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bottom Grid: Bottleneck Warnings & AI Recommendations */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Bottleneck Warnings Card */}
            <div className="p-4 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/40 flex flex-col gap-3">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-900 dark:text-amber-300">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>Bottleneck Warning Dates</span>
              </div>
              {simulationData.predicted_bottleneck_dates.length > 0 ? (
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

            {/* AI Schedule Recommendations */}
            <div className="p-4 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/70 dark:border-indigo-900/40 flex flex-col gap-3">
              <div className="flex items-center gap-2 text-xs font-bold text-indigo-900 dark:text-indigo-300">
                <Lightbulb className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>AI Schedule Recommendations</span>
              </div>
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
              Ready to Simulate Your 30-Day Horizon
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
              Click the button above to query your active tasks, habits, and health logs to run the fuzzy risk simulation engine.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
