import React from 'react';
import Link from 'next/link';

export function AppShell({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex h-screen w-full bg-slate-50 text-slate-900 overflow-hidden">

            {/* Left Rail (Navigation) - 240px */}
            <aside className="hidden lg:flex w-[240px] flex-col border-r border-slate-200 bg-white p-4">
                <div className="font-bold text-xl tracking-tight mb-8 px-3">PIW</div>
                <nav className="flex flex-col gap-1">
                    <Link href="/" className="px-3 py-2 rounded-md bg-slate-100 font-medium">Today [T]</Link>
                    <Link href="/plan" className="px-3 py-2 rounded-md hover:bg-slate-100 text-slate-600">Plan [G]</Link>
                    <Link href="/tasks" className="px-3 py-2 rounded-md hover:bg-slate-100 text-slate-600">Tasks [K]</Link>
                    <Link href="/study" className="px-3 py-2 rounded-md hover:bg-slate-100 text-slate-600">Study [S]</Link>
                    <Link href="/notes" className="px-3 py-2 rounded-md hover:bg-slate-100 text-slate-600">Notes [N]</Link>
                </nav>
            </aside>

            {/* Center Column (Main Content) - Fluid, capped at 880px */}
            <main className="flex-1 flex justify-center overflow-y-auto">
                <div className="w-full max-w-[880px] p-6 md:p-8">
                    {children}
                </div>
            </main>

            {/* Right Rail (Contextual) - 320px */}
            <aside className="hidden xl:flex w-[320px] flex-col border-l border-slate-200 bg-white p-4">
                <div className="text-sm font-semibold text-slate-500 tracking-wide uppercase mb-4">Context</div>
                <div className="flex-1 rounded-md border border-dashed border-slate-300 flex items-center justify-center text-slate-400 text-sm">
                    Right rail content (e.g., Focus Timer)
                </div>
            </aside>

        </div>
    );
}