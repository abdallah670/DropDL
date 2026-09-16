import React, { useEffect, useRef } from "react";
import { useAppStore } from "./store/useAppStore";

/** Minimum gap between automatic queue writes (progress ticks arrive faster). */
const QUEUE_SAVE_INTERVAL_MS = 2000;

import { Sidebar } from "./components/common/Sidebar";
import { NotificationToast } from "./components/common/NotificationToast";


import { ErrorDialog } from "./components/common/ErrorDialog";

import { DownloadPage } from "./components/download/DownloadPage";
import { FormatExplorer } from "./components/formats/FormatExplorer";
import { QueuePage } from "./components/queue/QueuePage";
import { HistoryPage } from "./components/history/HistoryPage";
import { PlaylistPage } from "./components/playlist/PlaylistPage";
import { LogViewerPage } from "./components/logs/LogViewerPage";
import { SettingsPage } from "./components/settings/SettingsPage";

export default function App() {
  const { activeNav, mediaInfo, refreshDependencies, setShowDependencyModal, loadPersistedData, persistNow, settings, history, paths, queue, hasLoadedData } = useAppStore();

  /** Timestamp of the last automatic queue write (see the throttle below). */
  const lastQueueSaveRef = useRef(0);

  useEffect(() => {
    // Load saved settings & history from disk on startup
    loadPersistedData();

    // Last-chance save when the window closes: persist queued/paused/active
    // tasks so nothing in the batch is lost between sessions.
    const onBeforeUnload = () => {
      useAppStore.getState().persistNow();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Check yt-dlp / ffmpeg dependencies after startup
  useEffect(() => {
    refreshDependencies().then(() => {
      // Read fresh state — the `dependencies` variable captured here is stale
      const fresh = useAppStore.getState().dependencies;
      const missingRequired = fresh.some((d) => d.required && !d.installed);
      if (missingRequired) {
        setShowDependencyModal(true);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save to disk whenever settings, history, or paths changes
  useEffect(() => {
    persistNow();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, history, paths]);

  // Throttled auto-save whenever the QUEUE changes (enqueued, started, paused,
  // finished...). Download progress ticks arrive several times a second, so a
  // plain debounce would be reset forever and never fire — this guarantees a
  // write at most QUEUE_SAVE_INTERVAL_MS after a change, plus an immediate one
  // whenever nothing has been written recently.
  useEffect(() => {
    if (!hasLoadedData) return;
    const delay = Math.max(0, QUEUE_SAVE_INTERVAL_MS - (Date.now() - lastQueueSaveRef.current));
    const t = setTimeout(() => {
      lastQueueSaveRef.current = Date.now();
      persistNow();
    }, delay);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue, hasLoadedData]);

  return (
    <div
      id="desktop-app-root"
      className="h-screen w-screen flex flex-col bg-neutral-950 text-neutral-100 font-sans overflow-hidden select-none"
    >
    

      {/* 2. Main Desktop Shell Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Navigation Sidebar */}
        <Sidebar />

        {/* Center Main Scrollable Viewport */}
        <main
          id="main-viewport"
          className="flex-1 overflow-y-auto bg-neutral-950 text-neutral-100 relative"
        >
          {activeNav === "download" && <DownloadPage />}

          {activeNav === "formats" && (
            <div className="p-6 space-y-4 max-w-5xl mx-auto">
              <div className="pb-3 border-b border-neutral-800">
                <h1 className="text-lg font-bold text-neutral-100">
                  Format Explorer & Stream Inspector
                </h1>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Inspect raw stream tracks, filter by bitrate/codec, and compare formats side by side.
                </p>
              </div>
              {mediaInfo ? (
                <FormatExplorer />
              ) : (
                <div className="p-12 text-center rounded-lg bg-neutral-900 border border-neutral-800 text-xs text-neutral-400 font-mono">
                  No active media analyzed yet. Paste a URL on the Download page or select a sample to inspect all its stream formats.
                </div>
              )}
            </div>
          )}

          {activeNav === "queue" && <QueuePage />}
          {activeNav === "history" && <HistoryPage />}
          {activeNav === "playlist" && <PlaylistPage />}
          {activeNav === "logs" && <LogViewerPage />}
          {activeNav === "settings" && <SettingsPage />}
        </main>
      </div>

      {/* 3. Global Desktop Modals & Overlays */}
      <NotificationToast />


   
      <ErrorDialog />
    </div>
  );
}
