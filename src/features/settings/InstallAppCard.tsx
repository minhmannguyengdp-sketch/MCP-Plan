"use client";

import { useEffect, useMemo, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandaloneMode() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function InstallAppCard() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [message, setMessage] = useState("San sang cai MCP-Plan nhu mot ung dung rieng tren dien thoai.");

  const platformHint = useMemo(() => {
    if (typeof navigator === "undefined") return "";
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes("iphone") || userAgent.includes("ipad")) {
      return "iPhone/iPad: bam Chia se, chon Them vao man hinh chinh.";
    }
    return "Android/Chrome: bam Cài ứng dụng, hoac mo menu trinh duyet va chon Them vao man hinh chinh.";
  }, []);

  useEffect(() => {
    setIsStandalone(isStandaloneMode());

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
      setMessage("Thiet bi nay co the cai MCP-Plan nhu app rieng.");
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  async function handleInstall() {
    if (isInstalling) return;

    if (isStandalone) {
      setMessage("MCP-Plan da dang chay nhu app rieng tren thiet bi nay.");
      return;
    }

    if (!installPrompt) {
      setMessage(platformHint || "Trinh duyet hien chua hien nut cai dat tu dong.");
      return;
    }

    setIsInstalling(true);
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      setInstallPrompt(null);
      setMessage(choice.outcome === "accepted" ? "Da gui yeu cau cai app." : "Da huy cai app.");
    } finally {
      setIsInstalling(false);
    }
  }

  async function handleRefreshApp() {
    if (isUpdating) return;

    setIsUpdating(true);
    setMessage("Dang kiem tra va lam moi phien ban app...");

    try {
      if ("caches" in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
      }

      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.update()));
      }

      window.setTimeout(() => window.location.reload(), 300);
    } catch {
      setMessage("Chua the lam moi tu dong. Hay tai lai trang mot lan nua.");
      setIsUpdating(false);
    }
  }

  return (
    <div className="card settings-card">
      <div>
        <span className="badge">Ung dung</span>
        <h2 className="panel-title">Cài ứng dụng va lam moi phien ban</h2>
        <p className="page-subtitle">{message}</p>
        <p className="settings-hint">{platformHint}</p>
      </div>

      <div className="settings-actions">
        <button className="button primary" disabled={isInstalling || isUpdating} onClick={handleInstall} type="button">
          {isInstalling ? "Dang mo..." : "Cài ứng dụng"}
        </button>
        <button className="button" disabled={isUpdating} onClick={handleRefreshApp} type="button">
          {isUpdating ? "Dang lam moi..." : "Cập nhật bản mới"}
        </button>
      </div>
    </div>
  );
}
