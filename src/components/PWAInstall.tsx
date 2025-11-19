"use client";

import React, { useEffect, useState } from "react";

export default function PWAInstall() {
  const [promptEvent, setPromptEvent] = useState<any>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function onBeforeInstall(e: any) {
      e.preventDefault();
      setPromptEvent(e);
      setVisible(true);
    }

    function onAppInstalled() {
      setPromptEvent(null);
      setVisible(false);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstall as EventListener);
    window.addEventListener("appinstalled", onAppInstalled as EventListener);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall as EventListener);
      window.removeEventListener("appinstalled", onAppInstalled as EventListener);
    };
  }, []);

  const handleInstall = async () => {
    if (!promptEvent) return;
    try {
      // Show the native prompt
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice && choice.outcome === "accepted") {
        setVisible(false);
        setPromptEvent(null);
      }
    } catch (err) {
      console.error("PWA install error:", err);
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <button
        onClick={handleInstall}
        className="flex items-center gap-2 px-3 py-2 bg-[#ad010d] text-white rounded-md shadow-md"
        aria-label="Install Post-Book"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M3 3a1 1 0 011-1h4a1 1 0 110 2H5v12h10V4h-3a1 1 0 110-2h4a1 1 0 011 1v14a1 1 0 01-1 1H4a1 1 0 01-1-1V3z" clipRule="evenodd" />
          <path d="M7 9a1 1 0 011.707-.707L9.414 9.293 9 9.707V13a1 1 0 102 0V9.707l-.414-.414L11.293 8.293A1 1 0 0113 9v4a1 1 0 11-2 0V9.707l-1.293 1.293A1 1 0 018 10V9a1 1 0 01-1-1z" />
        </svg>
        Install
      </button>
    </div>
  );
}
