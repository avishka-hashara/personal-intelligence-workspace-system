"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import {
  Sparkles,
  ShieldCheck,
  Lock,
  Database,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  DollarSign,
  Cpu,
  Server,
  Zap,
  Info,
  Layers,
  ArrowRight,
  BookOpen,
  Calendar,
  Trash2,
} from "lucide-react";
import { updateAISettings, type AISettings } from "@/server/actions/ai-settings";

interface AISettingsManagerProps {
  initialSettings: AISettings;
}

export function AISettingsManager({ initialSettings }: AISettingsManagerProps) {
  const [settings, setSettings] = useState<AISettings>(initialSettings);
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(
    null
  );

  const handleToggle = (key: keyof AISettings) => {
    const updated = {
      ...settings,
      [key]: !settings[key],
    };
    setSettings(updated);
    saveSettings(updated);
  };

  const handleSpendCapChange = (cap: number) => {
    const updated = {
      ...settings,
      monthlySpendCap: cap,
    };
    setSettings(updated);
    saveSettings(updated);
  };

  const saveSettings = (newSettings: AISettings) => {
    setFeedback(null);
    startTransition(async () => {
      const res = await updateAISettings(newSettings);
      if (res.success && res.settings) {
        setSettings(res.settings);
        setFeedback({ type: "success", message: "AI preferences saved successfully." });
      } else {
        setFeedback({ type: "error", message: res.error || "Failed to update settings." });
      }
    });
  };

  return (
    <div className="space-y-10 max-w-5xl mx-auto pb-20">
      {/* Settings Navigation Tabs */}
      <div className="border-b border-slate-200">
        <div className="flex items-center gap-6">
          <Link
            href="/settings/data"
            className="pb-3 text-sm font-medium text-slate-500 hover:text-slate-900 flex items-center gap-2 transition-colors"
          >
            <Database className="w-4 h-4" />
            <span>Data & Imports</span>
          </Link>
          <Link
            href="/settings/ai"
            className="pb-3 text-sm font-bold text-indigo-600 border-b-2 border-indigo-600 flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            <span>AI & Privacy Controls</span>
          </Link>
        </div>
      </div>

      {/* Header Description */}
      <div className="space-y-1">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold uppercase tracking-wider border border-indigo-200">
          <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
          Data Ownership & Control
        </div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">AI & Privacy Settings</h1>
        <p className="text-slate-600 text-sm max-w-2xl leading-relaxed">
          Configure how artificial intelligence capabilities interact with your workspace data. You have complete
          sovereignty over which features run, spend budgets, and what data leaves your device.
        </p>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-xl text-xs sm:text-sm flex items-center gap-3 border shadow-xs animate-in fade-in duration-150 ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-rose-50 text-rose-800 border-rose-200"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <span className="font-medium">{feedback.message}</span>
        </div>
      )}

      {/* =================================================================== */}
      {/* 1. Master AI Toggle & Monthly Spend Cap */}
      {/* =================================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Master Switch Card (2 cols) */}
        <div className="md:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Cpu className="w-5 h-5 text-indigo-600" />
                <h2 className="text-base font-bold text-slate-900">Master AI Control</h2>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Globally enable or disable all AI inference features. When disabled, the entire workspace
                functions in 100% deterministic local mode with zero external LLM API calls.
              </p>
            </div>

            {/* Switch UI */}
            <button
              type="button"
              onClick={() => handleToggle("masterEnabled")}
              disabled={isPending}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                settings.masterEnabled ? "bg-indigo-600" : "bg-slate-300"
              }`}
              role="switch"
              aria-checked={settings.masterEnabled}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  settings.masterEnabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-2 text-xs">
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                settings.masterEnabled ? "bg-emerald-500" : "bg-slate-400"
              }`}
            />
            <span className="font-semibold text-slate-700">
              Status: {settings.masterEnabled ? "Active (AI Layer Enabled)" : "Offline (Local Deterministic Only)"}
            </span>
          </div>
        </div>

        {/* Monthly Spend Cap (1 col) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-600" />
              <h2 className="text-base font-bold text-slate-900">Monthly Spend Cap</h2>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Hard budget threshold. If 100% is reached, features degrade to deterministic fallbacks rather than failing.
            </p>

            <div className="grid grid-cols-3 gap-2 pt-2">
              {[5, 10, 25].map((cap) => (
                <button
                  key={cap}
                  type="button"
                  onClick={() => handleSpendCapChange(cap)}
                  disabled={isPending || !settings.masterEnabled}
                  className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    settings.monthlySpendCap === cap
                      ? "bg-slate-900 text-white shadow-xs"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  } disabled:opacity-40`}
                >
                  ${cap}/mo
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Hard stop: <strong>${settings.monthlySpendCap}.00 USD</strong></span>
            <span className="text-emerald-600 font-semibold">Active</span>
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* 2. Granular Feature Toggles & Journal Exclusion */}
      {/* =================================================================== */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
        <div>
          <h2 className="text-base font-bold text-slate-900">Feature Privacy & Invocations</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Toggle individual capabilities. Disabled features transparently fall back to statistical or manual modes.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Feature: Copilot */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span className="text-sm font-semibold text-slate-900">Workspace Copilot (C)</span>
              </div>
              <p className="text-xs text-slate-500">
                Interactive chat assistant for task breakdown, course analysis, and scheduling.
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.masterEnabled && settings.copilotEnabled}
              disabled={!settings.masterEnabled || isPending}
              onChange={() => handleToggle("copilotEnabled")}
              className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer mt-1"
            />
          </div>

          {/* Feature: AI-08 Review Synthesis */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-purple-600" />
                <span className="text-sm font-semibold text-slate-900">Review Synthesis (AI-08)</span>
              </div>
              <p className="text-xs text-slate-500">
                Synthesizes weekly and quarterly retrospectives from activity logs and proposes adjustments.
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.masterEnabled && settings.reviewSynthesisEnabled}
              disabled={!settings.masterEnabled || isPending}
              onChange={() => handleToggle("reviewSynthesisEnabled")}
              className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer mt-1"
            />
          </div>

          {/* Feature: AI-10 Coaching Nudges */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-semibold text-slate-900">Coaching Nudges (AI-10)</span>
              </div>
              <p className="text-xs text-slate-500">
                Non-judgmental executive coaching nudges when habit streaks or goals drift.
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.masterEnabled && settings.coachingNudgesEnabled}
              disabled={!settings.masterEnabled || isPending}
              onChange={() => handleToggle("coachingNudgesEnabled")}
              className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer mt-1"
            />
          </div>

          {/* Feature: AI-04 Re-planning */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-teal-600" />
                <span className="text-sm font-semibold text-slate-900">Roadmap Re-planning (AI-04)</span>
              </div>
              <p className="text-xs text-slate-500">
                Recomputes milestone critical paths and resolves dependencies during project replans.
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.masterEnabled && settings.replanEnabled}
              disabled={!settings.masterEnabled || isPending}
              onChange={() => handleToggle("replanEnabled")}
              className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer mt-1"
            />
          </div>

          {/* Feature: AI-07 Flashcard & Quiz Generation */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-semibold text-slate-900">Quiz & Flashcard Gen (AI-07)</span>
              </div>
              <p className="text-xs text-slate-500">
                Extracts active recall flashcard pairs from uploaded course syllabi and note chunks.
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.masterEnabled && settings.quizGenEnabled}
              disabled={!settings.masterEnabled || isPending}
              onChange={() => handleToggle("quizGenEnabled")}
              className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer mt-1"
            />
          </div>

          {/* Critical Privacy Guarantee: Exclude Journal from AI */}
          <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/40 flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-rose-600" />
                <span className="text-sm font-semibold text-rose-950">Exclude Journal from AI</span>
              </div>
              <p className="text-xs text-rose-700/90 leading-relaxed">
                Guarantees journal entries and reflection text are <strong>never</strong> transmitted to external AI providers.
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.excludeJournalFromAI}
              disabled={isPending}
              onChange={() => handleToggle("excludeJournalFromAI")}
              className="h-4 w-4 rounded text-rose-600 focus:ring-rose-500 border-rose-300 cursor-pointer mt-1"
            />
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* 3. Table 14.1 — Data Egress Map */}
      {/* =================================================================== */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <Server className="w-5 h-5 text-slate-700" />
            <h2 className="text-base font-bold text-slate-900">What Leaves the Device (Data Egress Map)</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Table 14.1 reproduced verbatim from the system architecture. A privacy claim the user cannot inspect
            is not a privacy control.
          </p>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
              <tr>
                <th className="p-3.5 font-bold uppercase tracking-wider text-[11px] w-1/5">Destination</th>
                <th className="p-3.5 font-bold uppercase tracking-wider text-[11px] w-2/5">What is sent</th>
                <th className="p-3.5 font-bold uppercase tracking-wider text-[11px] w-2/5">What is never sent</th>
                <th className="p-3.5 font-bold uppercase tracking-wider text-[11px] w-1/5">Retention</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 leading-relaxed">
              <tr className="hover:bg-slate-50/70 transition-colors">
                <td className="p-3.5 font-semibold text-slate-900 align-top">PIW server (Supabase)</td>
                <td className="p-3.5 align-top">All application data, since the product is server-backed.</td>
                <td className="p-3.5 text-slate-400 align-top">—</td>
                <td className="p-3.5 align-top">Until deletion; backups 30 days.</td>
              </tr>
              <tr className="hover:bg-slate-50/70 transition-colors">
                <td className="p-3.5 font-semibold text-slate-900 align-top">Anthropic (Claude API)</td>
                <td className="p-3.5 align-top">
                  Only the assembled context for the specific capability invoked: titles, dates, task text, selected note or resource chunks, and pre-computed aggregates.
                </td>
                <td className="p-3.5 align-top">
                  Email address, user id (a per-run pseudonymous id is used), push tokens, OAuth tokens, files as binaries, any entity flagged exclude_from_ai, and journal text when the journal toggle is off.
                </td>
                <td className="p-3.5 align-top">
                  Per the provider’s API data policy — API inputs are not used to train models; PIW stores only token counts and a context hash, never the prompt body.
                </td>
              </tr>
              <tr className="hover:bg-slate-50/70 transition-colors">
                <td className="p-3.5 font-semibold text-slate-900 align-top">OpenAI (embeddings)</td>
                <td className="p-3.5 align-top">Chunk text for notes and resources at index time; query strings at search time.</td>
                <td className="p-3.5 align-top">Any content flagged exclude_from_ai; journal text when excluded.</td>
                <td className="p-3.5 align-top">Not retained for training under the API terms; PIW stores vectors only.</td>
              </tr>
              <tr className="hover:bg-slate-50/70 transition-colors">
                <td className="p-3.5 font-semibold text-slate-900 align-top">Google (Calendar)</td>
                <td className="p-3.5 align-top">An OAuth token exchange and incremental sync requests.</td>
                <td className="p-3.5 align-top">No PIW content is ever written to Google in v1 — the integration is read-only.</td>
                <td className="p-3.5 align-top">Tokens until disconnected.</td>
              </tr>
              <tr className="hover:bg-slate-50/70 transition-colors">
                <td className="p-3.5 font-semibold text-slate-900 align-top">Resend (email)</td>
                <td className="p-3.5 align-top">Email address, digest and reminder subject/body text.</td>
                <td className="p-3.5 align-top">Note bodies, journal content, attachments.</td>
                <td className="p-3.5 align-top">Provider log retention, ~30 days.</td>
              </tr>
              <tr className="hover:bg-slate-50/70 transition-colors">
                <td className="p-3.5 font-semibold text-slate-900 align-top">Sentry / PostHog</td>
                <td className="p-3.5 align-top">Error stacks and product events keyed to a pseudonymous id.</td>
                <td className="p-3.5 align-top">PII scrubbing is enabled; entity titles and bodies are stripped by a beforeSend hook.</td>
                <td className="p-3.5 align-top">90 days.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
