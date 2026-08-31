"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { Lock, Mail, ArrowRight, Sparkles } from "lucide-react";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [authMode, setAuthMode] = useState<"magic_link" | "password">("password");
    const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
    const [errorMessage, setErrorMessage] = useState("");
    const supabase = createClient();
    const router = useRouter();

    const handleMagicLinkLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus("loading");
        setErrorMessage("");

        const { error } = await supabase.auth.signInWithOtp({
            email,
            options: {
                emailRedirectTo: `${window.location.origin}/auth/callback`,
            },
        });

        if (error) {
            setStatus("error");
            setErrorMessage(error.message);
        } else {
            setStatus("success");
        }
    };

    const handlePasswordAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus("loading");
        setErrorMessage("");

        // 1. Attempt sign in with password
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (!signInError && signInData.session) {
            router.push("/");
            router.refresh();
            return;
        }

        // 2. If user does not exist or credentials invalid, try sign up
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email,
            password,
        });

        if (signUpError) {
            setStatus("error");
            setErrorMessage(signInError?.message || signUpError.message);
        } else if (signUpData.session) {
            router.push("/");
            router.refresh();
        } else {
            setStatus("success");
            setErrorMessage("Account created! If email confirmation is enabled, check your inbox.");
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
                <div className="text-center mb-6">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-semibold uppercase tracking-wider mb-2">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Personal Intelligence Workspace</span>
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Sign in to PIW</h1>
                    <p className="text-xs text-slate-500 mt-1">
                        Access your intentional life graph, study engine, and tasks
                    </p>
                </div>

                {/* Mode Selector Tabs */}
                <div className="flex rounded-xl bg-slate-100 p-1 mb-5">
                    <button
                        type="button"
                        onClick={() => { setAuthMode("password"); setErrorMessage(""); }}
                        className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                            authMode === "password"
                                ? "bg-white text-slate-900 shadow-xs"
                                : "text-slate-600 hover:text-slate-900"
                        }`}
                    >
                        Password / Direct
                    </button>
                    <button
                        type="button"
                        onClick={() => { setAuthMode("magic_link"); setErrorMessage(""); }}
                        className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                            authMode === "magic_link"
                                ? "bg-white text-slate-900 shadow-xs"
                                : "text-slate-600 hover:text-slate-900"
                        }`}
                    >
                        Magic Link
                    </button>
                </div>

                {status === "success" && authMode === "magic_link" ? (
                    <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl p-4 text-xs text-center font-medium">
                        Check your email inbox for the magic sign-in link!
                    </div>
                ) : (
                    <form onSubmit={authMode === "password" ? handlePasswordAuth : handleMagicLinkLogin} className="space-y-3.5">
                        <div>
                            <label htmlFor="email" className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                                Email Address
                            </label>
                            <div className="relative">
                                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    placeholder="you@example.com"
                                    className="w-full pl-9 pr-4 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all text-slate-900"
                                />
                            </div>
                        </div>

                        {authMode === "password" && (
                            <div>
                                <label htmlFor="password" className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                                    Password
                                </label>
                                <div className="relative">
                                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                    <input
                                        id="password"
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        placeholder="••••••••"
                                        className="w-full pl-9 pr-4 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all text-slate-900"
                                    />
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1">
                                    If this is a new email, an account will be created automatically.
                                </p>
                            </div>
                        )}

                        {status === "error" && (
                            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                                {errorMessage}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={status === "loading"}
                            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl px-4 py-2.5 text-xs transition-colors disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                        >
                            {status === "loading" ? (
                                <span>Authenticating...</span>
                            ) : (
                                <>
                                    <span>{authMode === "password" ? "Sign In / Register" : "Send Magic Link"}</span>
                                    <ArrowRight className="w-3.5 h-3.5" />
                                </>
                            )}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}