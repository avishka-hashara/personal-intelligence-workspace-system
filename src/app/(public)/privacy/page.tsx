import Link from "next/link";
import { ShieldCheck, Lock, Database, RefreshCw, Sparkles, FileText, CheckCircle2, ArrowRight } from "lucide-react";

export const metadata = {
  title: "Privacy Policy & Data Ownership | Personal Intelligence Workspace",
  description: "Our explicit data ownership promises, backup retention policies, and AI privacy guarantees.",
};

export default function PrivacyPage() {
  return (
    <div className="space-y-12 pb-16">
      {/* Hero Header */}
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-semibold uppercase tracking-wider border border-emerald-200">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          Transparency & Ownership First
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          Privacy Policy & Data Ownership Pledge
        </h1>
        <p className="text-slate-600 text-base sm:text-lg max-w-3xl leading-relaxed">
          Personal Intelligence Workspace (PIW) is built on a single uncompromising principle:{" "}
          <strong>Your thoughts, goals, and academic records belong entirely to you.</strong> We do not sell data, display ads, or allow third parties to train models on your private life.
        </p>
      </div>

      {/* Core Principles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Principle 1: No AI Training */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
            <Lock className="w-5 h-5" />
          </div>
          <h2 className="text-base font-bold text-slate-900">Zero AI Training on Your Data</h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            All AI capabilities (Copilot, AI-08 Review Synthesis, AI-10 Coaching, and FSRS Flashcard Generation)
            connect exclusively to commercial API tiers under strict Zero Data Retention policies. AI providers
            (Anthropic, OpenAI) are <strong>contractually prohibited from using your data to train or fine-tune public models</strong>.
          </p>
        </div>

        {/* Principle 2: Backup Retention */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
            <Database className="w-5 h-5" />
          </div>
          <h2 className="text-base font-bold text-slate-900">30-Day Backup Aging Policy</h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Database snapshots and disaster-recovery backups are encrypted with AES-256 and{" "}
            <strong>automatically age out after exactly 30 days</strong>. We never claim &quot;instant snapshot erasure&quot;
            because honest infrastructure preserves rolling recovery snapshots for resilience.
          </p>
        </div>

        {/* Principle 3: Journal Privacy Guarantee */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100">
            <Sparkles className="w-5 h-5" />
          </div>
          <h2 className="text-base font-bold text-slate-900">Explicit Journal Exclusion</h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Deep personal reflections require absolute safety. You can toggle{" "}
            <strong>&quot;Exclude Journal from AI&quot;</strong> in your settings at any time to ensure journal entries
            are never included in prompt context, semantic search embeddings, or external AI calls.
          </p>
        </div>

        {/* Principle 4: 7-Day Deletion Grace Period */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100">
            <RefreshCw className="w-5 h-5" />
          </div>
          <h2 className="text-base font-bold text-slate-900">7-Day Deletion Grace Period</h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            When you request account deletion, sessions are revoked immediately and your account enters a 7-day
            cancellation grace period. After 7 days, all database rows, storage files, and vector embeddings are
            permanently purged via cascade.
          </p>
        </div>
      </div>

      {/* Detailed Technical Commitments */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
        <h2 className="text-lg font-bold text-slate-900">Detailed Privacy & Security Commitments</h2>

        <div className="space-y-4 text-xs sm:text-sm text-slate-700 leading-relaxed">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <strong className="text-slate-900">Complete Data Exportability:</strong> You can download a full archive
              of your workspace at any time, containing raw JSON records, Markdown notes with YAML front matter, and uploaded attachments.
            </div>
          </div>

          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <strong className="text-slate-900">Encryption in Transit & at Rest:</strong> All traffic is enforced with
              TLS 1.3 and HSTS. Storage volumes and Postgres tables are encrypted with AES-256 at rest.
            </div>
          </div>

          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <strong className="text-slate-900">Granular AI Egress Control:</strong> Inspect our full{" "}
              <Link href="/settings/ai" className="font-bold text-indigo-600 hover:underline">
                Data Egress Map
              </Link>{" "}
              directly inside the application to see exactly which service providers receive data and what is never sent.
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4 text-xs">
          <span className="text-slate-500">Last updated: September 1, 2026</span>
          <Link
            href="/settings/ai"
            className="inline-flex items-center gap-1.5 font-bold text-indigo-600 hover:text-indigo-700"
          >
            Inspect In-App AI Settings <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
