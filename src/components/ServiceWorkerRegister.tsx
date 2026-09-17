"use client";

import { useEffect } from "react";
import { useUIStore } from "@/store/uiStore";

export function ServiceWorkerRegister() {
  const { setInstallPrompt, setIsStandalone } = useUIStore();

  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1. Detect if already launched in standalone PWA / full-screen mode
    const checkStandalone = () => {
      const isStandaloneMode =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes("android-app://");
      setIsStandalone(Boolean(isStandaloneMode));
    };

    checkStandalone();

    // 2. Register Service Worker for offline support & Web Push
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((registration) => {
          // Check for periodic updates
          registration.onupdatefound = () => {
            const installingWorker = registration.installing;
            if (installingWorker) {
              installingWorker.onstatechange = () => {
                if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
                  console.log("[PWA] New version of PIW available. Will activate on next load.");
                }
              };
            }
          };
        })
        .catch((error) => {
          console.warn("[PWA] Service worker registration error:", error);
        });
    }

    // 3. Capture native install prompt event for custom trigger
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    // 4. Handle completed installation
    const handleAppInstalled = () => {
      setInstallPrompt(null);
      setIsStandalone(true);
      console.log("[PWA] Application was installed to device.");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, [setInstallPrompt, setIsStandalone]);

  return null;
}
