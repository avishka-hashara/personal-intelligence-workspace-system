import Link from "next/link";
import { Calendar, CheckSquare, Settings, BookOpen, Map, Home, FileText, Book } from "lucide-react";

export function Sidebar() {
    return (
        <aside className="w-[240px] border-r border-slate-200 bg-slate-50 hidden lg:flex flex-col h-screen fixed left-0 top-0">
            <div className="p-6">
                <h2 className="text-lg font-bold tracking-tight text-slate-900">PIW</h2>
            </div>
            <nav className="flex-1 px-4 space-y-1">
                <Link href="/" className="flex items-center gap-3 px-3 py-2 rounded-md bg-slate-200 text-slate-900 font-medium">
                    <Home className="h-4 w-4" /> Today
                </Link>
                <Link href="/plan/goals" className="flex items-center gap-3 px-3 py-2 rounded-md text-slate-600 hover:bg-slate-100 font-medium transition-colors">
                    <Map className="h-4 w-4" /> Plan
                </Link>
                <Link href="/tasks" className="flex items-center gap-3 px-3 py-2 rounded-md text-slate-600 hover:bg-slate-100 font-medium transition-colors">
                    <CheckSquare className="h-4 w-4" /> Tasks
                </Link>
                <Link href="/study/courses" className="flex items-center gap-3 px-3 py-2 rounded-md text-slate-600 hover:bg-slate-100 font-medium transition-colors">
                    <BookOpen className="h-4 w-4" /> Study
                </Link>
                <Link href="/calendar" className="flex items-center gap-3 px-3 py-2 rounded-md text-slate-600 hover:bg-slate-100 font-medium transition-colors">
                    <Calendar className="h-4 w-4" /> Calendar
                </Link>
                <Link href="/notes" className="flex items-center gap-3 px-3 py-2 rounded-md text-slate-600 hover:bg-slate-100 font-medium transition-colors">
                    <FileText className="h-4 w-4" /> Notes
                </Link>
                <Link href="/journal" className="flex items-center gap-3 px-3 py-2 rounded-md text-slate-600 hover:bg-slate-100 font-medium transition-colors">
                    <Book className="h-4 w-4" /> Journal
                </Link>
            </nav>
            <div className="p-4 border-t border-slate-200">
                <Link href="/settings" className="flex items-center gap-3 px-3 py-2 rounded-md text-slate-600 hover:bg-slate-100 font-medium transition-colors">
                    <Settings className="h-4 w-4" /> Settings
                </Link>
            </div>
        </aside>
    );
}