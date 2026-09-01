import Link from "next/link";
import { Sparkles, Shield, BookOpen, ArrowRight, Home } from "lucide-react";

export default function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Public Top Navbar */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 font-bold text-lg text-slate-900">
              <span className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-sm">
                P
              </span>
              <span>PIW</span>
            </Link>

            <nav className="hidden sm:flex items-center gap-5 text-sm font-medium text-slate-600">
              <Link href="/docs" className="hover:text-slate-900 transition-colors flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-slate-400" />
                <span>Documentation</span>
              </Link>
              <Link href="/privacy" className="hover:text-slate-900 transition-colors flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-slate-400" />
                <span>Privacy & Security</span>
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
            >
              Open App
            </Link>
            <Link
              href="/login"
              className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </header>

      {/* Main Public Content */}
      <main className="flex-1 py-10 px-4 sm:px-6 max-w-5xl mx-auto w-full">
        {children}
      </main>

      {/* Public Footer */}
      <footer className="border-t border-slate-200 bg-white py-8 text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">Personal Intelligence Workspace (PIW)</span>
            <span>•</span>
            <span>Zero Data Selling Pledge</span>
          </div>

          <div className="flex items-center gap-5 font-medium">
            <Link href="/docs" className="hover:text-slate-800 transition-colors">
              Docs
            </Link>
            <Link href="/privacy" className="hover:text-slate-800 transition-colors">
              Privacy Policy
            </Link>
            <Link href="/settings/ai" className="hover:text-slate-800 transition-colors">
              Data Egress Map
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
