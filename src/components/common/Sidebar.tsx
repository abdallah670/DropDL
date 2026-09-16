import React from "react";
import {
  Download,
  Clock,
  CheckCircle2,
  ListVideo,
  Settings,
  Terminal,
  Folder,
  Cpu,
  HelpCircle,
} from "lucide-react";
import { useAppStore, NavTab } from "../../store/useAppStore";

export const Sidebar: React.FC = () => {
  const {
    activeNav,
    setActiveNav,
    queue,
    history,
    playlist,
    settings,
    dependencies,
    setShowDependencyModal,
    setShowShortcutsModal,
  } = useAppStore();

  // ── Queue counters ────────────────────────────────────────────────────────
  // The badge must reflect everything still sitting in the queue, not just the
  // tasks that happen to be running: after "Cancel All" (or after restoring a
  // batch as paused) the items are still there and retryable, so counting only
  // downloading/queued made the badge disappear while the queue was full.
  const downloadingCount = queue.filter((t) =>
    ["downloading", "processing", "merging", "analyzing"].includes(t.status)
  ).length;
  const queuedCount = queue.filter((t) => t.status === "queued").length;
  const pausedCount = queue.filter((t) => t.status === "paused").length;
  const failedCount = queue.filter((t) => t.status === "failed").length;
  const cancelledCount = queue.filter((t) => t.status === "cancelled").length;

  /** Everything not finished — completed tasks belong to History. */
  const queueCount =
    downloadingCount + queuedCount + pausedCount + failedCount + cancelledCount;

  /** True while work is actually in flight (drives the badge colour). */
  const hasActiveDownloads = downloadingCount > 0 || queuedCount > 0;

  const queueBreakdown = [
    downloadingCount > 0 ? `${downloadingCount} downloading` : null,
    queuedCount > 0 ? `${queuedCount} waiting` : null,
    pausedCount > 0 ? `${pausedCount} paused` : null,
    failedCount > 0 ? `${failedCount} failed` : null,
    cancelledCount > 0 ? `${cancelledCount} cancelled` : null,
  ].filter(Boolean);
  const queueBadgeTitle = `${queueBreakdown.join(" · ")} — ${queueCount} in queue`;

  const navItems: Array<{
    id: NavTab;
    label: string;
    icon: React.ReactNode;
    badge?: number | string;
    badgeColor?: string;
    badgeTitle?: string;
  }> = [
    {
      id: "download",
      label: "Download",
      icon: <Download className="w-4 h-4" />,
    },
    {
      id: "queue",
      label: "Queue",
      icon: <Clock className="w-4 h-4" />,
      badge: queueCount > 0 ? queueCount : undefined,
      // Emerald while something is running; amber when the queue is idle but
      // still holds work the user may need to resume/retry.
      badgeColor: hasActiveDownloads
        ? "bg-emerald-500 text-neutral-950 font-bold"
        : "bg-amber-500/90 text-neutral-950 font-bold",
      badgeTitle: queueBadgeTitle,
    },
    {
      id: "history",
      label: "History",
      icon: <CheckCircle2 className="w-4 h-4" />,
      badge: history.length > 0 ? history.length : undefined,
      badgeColor: "bg-neutral-800 text-neutral-400 border border-neutral-700",
    },
    {
      id: "playlist",
      label: "Playlist",
      icon: <ListVideo className="w-4 h-4" />,
      badge: playlist ? playlist.entries.length : undefined,
      badgeColor: "bg-indigo-900/70 text-indigo-200 border border-indigo-700",
    },
  ];

  return (
    <aside
      id="app-sidebar"
      className="w-56 bg-neutral-900/90 border-r border-neutral-800 flex flex-col justify-between select-none shrink-0 h-full text-neutral-300"
    >
      {/* Top navigation links */}
      <div className="p-3 space-y-1">
        <div className="px-2 py-1 text-[10px] font-mono tracking-wider uppercase text-neutral-400 font-semibold">
          Tasks & Media
        </div>

        {navItems.map((item) => {
          const isActive = activeNav === item.id;
          return (
            <button
              key={item.id}
              id={`nav-${item.id}`}
              onClick={() => setActiveNav(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs font-medium transition-all group ${
                isActive
                  ? "bg-neutral-800 text-white shadow-sm border border-neutral-700/80"
                  : "text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800/50"
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <span
                  className={`${
                    isActive
                      ? "text-emerald-400"
                      : "text-neutral-400 group-hover:text-neutral-300"
                  }`}
                >
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && (
                <span
                  title={item.badgeTitle}
                  className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    item.badgeColor || "bg-neutral-800 text-neutral-300"
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}

        <div className="my-2 border-t border-neutral-800/80" />

        <div className="px-2 py-1 text-[10px] font-mono tracking-wider uppercase text-neutral-400 font-semibold">
          System
        </div>

        <button
          id="nav-settings"
          onClick={() => setActiveNav("settings")}
          className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded text-xs font-medium transition-all group ${
            activeNav === "settings"
              ? "bg-neutral-800 text-white border border-neutral-700/80"
              : "text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800/50"
          }`}
        >
          <Settings
            className={`w-4 h-4 ${
              activeNav === "settings"
                ? "text-emerald-400"
                : "text-neutral-400 group-hover:text-neutral-300"
            }`}
          />
          <span>Settings</span>
        </button>

        <button
          id="nav-logs"
          onClick={() => setActiveNav("logs")}
          className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded text-xs font-medium transition-all group ${
            activeNav === "logs"
              ? "bg-neutral-800 text-white border border-neutral-700/80"
              : "text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800/50"
          }`}
        >
          <Terminal
            className={`w-4 h-4 ${
              activeNav === "logs"
                ? "text-emerald-400"
                : "text-neutral-400 group-hover:text-neutral-300"
            }`}
          />
          <span>Process Logs</span>
        </button>
      </div>

    </aside>
  );
};
