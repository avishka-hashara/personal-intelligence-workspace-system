"use client";

import { useState, useEffect } from "react";
import { useUIStore } from "@/store/uiStore";
import { Download, X, Smartphone, ExternalLink, CheckCircle2 } from "lucide-react";

export function PWAInstallBanner() {
  const { isStandalone, isInstallable, triggerInstall } = useUIStore();
  const [isOpen, setIsOpen] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Detect mobile device
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
    const mobileRegex = /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;
    const isMobileDevice = mobileRegex.test(userAgent.toLowerCase());
    setIsMobile(isMobileDevice);

    // Check if dismissed previously in this session
    const dismissed = sessionStorage.getItem("piw_install_banner_dismissed");
    if (isMobileDevice && !isStandalone && !dismissed) {
      // Delay showing slightly so user sees initial page
      const timer = setTimeout(() => setIsOpen(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [isStandalone]);

  if (isStandalone || !isMobile || !isOpen) {
    return (
      <>
        {showManualModal && (
          <ManualInstallModal onClose={() => setShowManualModal(false)} />
        )}
      </>
    );
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      const accepted = await triggerInstall();
      if (accepted) {
        setIsOpen(false);
      } else {
        setShowManualModal(true);
      }
    } else {
      setShowManualModal(true);
    }
  };

  const handleDismiss = () => {
    setIsOpen(false);
    sessionStorage.setItem("piw_install_banner_dismissed", "true");
  };

  return (
    <>
      <aside
        aria-label="Install app banner"
        className="lg:hidden fixed bottom-18 left-3 right-3 z-50 p-3 rounded-2xl bg-zinc-900/95 dark:bg-zinc-100/95 text-white dark:text-zinc-900 backdrop-blur-xl border border-zinc-700/50 dark:border-zinc-300 shadow-float flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shrink-0 shadow-subtle text-white">
            <Smartphone className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-tight truncate">
              Install PIW App
            </p>
            <p className="text-[11px] text-zinc-400 dark:text-zinc-600 truncate">
              Add to Home screen for full-screen offline access
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleInstallClick}
            className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs shadow-subtle cursor-pointer active:scale-95 transition-all flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Install</span>
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-white dark:hover:text-zinc-900 cursor-pointer"
            aria-label="Dismiss banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {showManualModal && (
        <ManualInstallModal onClose={() => setShowManualModal(false)} />
      )}
    </>
  );
}

function ManualInstallModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 shadow-float space-y-4 text-zinc-900 dark:text-zinc-100 animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
              PIW
            </div>
            <h2 className="text-sm font-semibold">How to Install on Android</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3 text-xs">
          <div className="flex items-start gap-3 p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-zinc-700/60">
            <div className="w-6 h-6 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center shrink-0">
              1
            </div>
            <div>
              <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                Tap Chrome Menu (⋮)
              </p>
              <p className="text-zinc-500 dark:text-zinc-400 text-[11px]">
                Tap the three dots icon in the top-right corner of Google Chrome.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-zinc-700/60">
            <div className="w-6 h-6 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center shrink-0">
              2
            </div>
            <div>
              <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                Tap &ldquo;Install app&rdquo; or &ldquo;Add to Home screen&rdquo;
              </p>
              <p className="text-zinc-500 dark:text-zinc-400 text-[11px]">
                Look for the install or home screen option in the menu list.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-zinc-700/60">
            <div className="w-6 h-6 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center shrink-0">
              3
            </div>
            <div>
              <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                Tap &ldquo;Install&rdquo;
              </p>
              <p className="text-zinc-500 dark:text-zinc-400 text-[11px]">
                Android will add PIW directly to your home screen and app drawer!
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-medium text-xs shadow-subtle cursor-pointer active:scale-[0.98] transition-all"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
