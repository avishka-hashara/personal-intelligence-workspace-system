"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
    const [errorMessage, setErrorMessage] = useState("");
    const supabase = createClient();

    const handleLogin = async (e: React.FormEvent) => {
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

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
            <div className="max-w-sm w-full bg-white rounded-xl shadow-sm border border-slate-200 p-8">
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Sign in to PIW</h1>
                    <p className="text-sm text-slate-500 mt-2">Enter your email to receive a magic link</p>
                </div>

                {status === "success" ? (
                    <div className="bg-slate-100 border border-slate-200 text-slate-800 rounded-lg p-4 text-sm text-center font-medium">
                        Check your email for the login link!
                    </div>
                ) : (
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label htmlFor="email" className="sr-only">Email address</label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                placeholder="maya@example.edu"
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-shadow text-slate-900"
                            />
                        </div>

                        {status === "error" && (
                            <p className="text-sm text-red-600 font-medium">{errorMessage}</p>
                        )}

                        <button
                            type="submit"
                            disabled={status === "loading"}
                            className="w-full bg-slate-900 text-white font-medium rounded-lg px-4 py-2 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 transition-colors disabled:opacity-50"
                        >
                            {status === "loading" ? "Sending..." : "Send Magic Link"}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}