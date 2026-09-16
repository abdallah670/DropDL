import React, { useState } from "react";
import {
  Clock,
  Pause,
  Play,
  X,
  Trash2,
  Terminal,
  Folder,
  CheckCircle2,
  AlertCircle,
  Film,
  Music,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { useAppStore } from "../../store/useAppStore";
import { formatBytes } from "../../lib/utils";
import { explainFormat } from "../../lib/formatSelector";

export const QueuePage: React.FC = () => {
  const {
    queue,
    pauseTask,
    resumeTask,
    cancelTask,
    removeTask,
    pauseAll,
    resumeAll,
    cancelAll,
    retryAll,
    retryTask,
    clearCompleted,
    setActiveNav,
  } = useAppStore();

  const [expandedLogTaskId, setExpandedLogTaskId] = useState<string | null>(null);

  const activeCount = queue.filter((t) => t.status === "downloading").length;
  const queuedCount = queue.filter((t) => t.status === "queued").length;
  const pausedCount = queue.filter((t) => t.status === "paused").length;
  const completedCount = queue.filter((t) => t.status === "completed" || t.status === "cancelled").length;
  // Anything that can still be stopped: running, queued or paused tasks.
  const cancellableCount = queue.filter((t) =>
    ["downloading", "queued", "paused", "processing", "merging", "analyzing"].includes(t.status)
  ).length;
  // Failed or cancelled tasks that can be re-queued with one click.
  const retryableCount = queue.filter(
    (t) => t.status === "failed" || t.status === "cancelled"
  ).length;

  // Aggregate batch progress across all pending tasks (playlist/queue level view)
  const pendingTasks = queue.filter((t) =>
    ["downloading", "queued", "paused", "processing", "merging", "analyzing"].includes(t.status)
  );
  const aggTotal = pendingTasks.reduce((s, t) => s + (t.totalBytes > 0 ? t.totalBytes : 0), 0);
  const aggDone = pendingTasks.reduce((s, t) => s + (t.totalBytes > 0 ? t.downloadedBytes : 0), 0);
  const aggPct = aggTotal > 0 ? Math.min(100, Math.round((aggDone / aggTotal) * 100)) : 0;

  // Reveal the finished file's containing folder (uses the safe open_folder command)
  const openContainingFolder = async (filePath: string) => {
    const tauri = (window as any).__TAURI__;
    if (!tauri?.invoke) return;
    const dir = filePath.replace(/[\\/][^\\/]+$/, "");
    try {
      await tauri.invoke("open_folder", { path: dir });
    } catch {
      /* non-fatal */
    }
  };
  return (
    <div id="queue-page" className="p-6 space-y-5 select-none max-w-5xl mx-auto">
      {/* Top Header & Global Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-neutral-800">
        <div>
          <h1 className="text-lg font-bold text-neutral-100 flex items-center space-x-2">
            <Clock className="w-5 h-5 text-emerald-400" />
            <span>Download Queue</span>
          </h1>
          <p className="text-xs text-neutral-400 mt-0.5">
            {activeCount} downloading • {queuedCount} queued{pausedCount > 0 ? ` • ${pausedCount} paused` : ""} • {queue.length} total tasks
          </p>

          {/* Aggregate batch progress (playlist/queue level) */}
          {pendingTasks.length > 1 && (
            <div className="mt-2 max-w-md">
              <div className="flex items-center justify-between text-[10px] font-mono text-neutral-500 mb-1">
                <span>
                  {pendingTasks.length} tasks in batch
                  {aggTotal > 0 ? ` • ${formatBytes(aggDone)} / ${formatBytes(aggTotal)}` : ""}
                </span>
                <span>{aggPct}% overall</span>
              </div>
              <div className="h-1 rounded-full bg-neutral-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                  style={{ width: `${aggPct}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={pauseAll}
            disabled={activeCount === 0}
            className="flex items-center space-x-1 px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 text-xs font-medium text-neutral-200 transition-colors border border-neutral-700"
          >
            <Pause className="w-3.5 h-3.5 text-amber-400" />
            <span>Pause All</span>
          </button>

          <button
            onClick={resumeAll}
            disabled={pausedCount === 0}
            className="flex items-center space-x-1 px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 text-xs font-medium text-neutral-200 transition-colors border border-neutral-700"
          >
            <Play className="w-3.5 h-3.5 text-emerald-400" />
            <span>Resume All</span>
          </button>

          <button
            onClick={cancelAll}
            disabled={cancellableCount === 0}
            className="flex items-center space-x-1 px-3 py-1.5 rounded bg-red-950/60 hover:bg-red-900/60 disabled:opacity-40 text-xs font-medium text-red-300 transition-colors border border-red-900"
          >
            <X className="w-3.5 h-3.5" />
            <span>Cancel All</span>
          </button>

          <button
            onClick={retryAll}
            disabled={retryableCount === 0}
            className="flex items-center space-x-1 px-3 py-1.5 rounded bg-sky-950/60 hover:bg-sky-900/60 disabled:opacity-40 text-xs font-medium text-sky-300 transition-colors border border-sky-900"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Retry All</span>
          </button>

          <button
            onClick={clearCompleted}
            disabled={completedCount === 0}
            className="flex items-center space-x-1 px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 text-xs font-medium text-neutral-200 transition-colors border border-neutral-700"
          >
            <Trash2 className="w-3.5 h-3.5 text-neutral-400" />
            <span>Clear Completed</span>
          </button>
        </div>
      </div>

      {/* Task List */}
      {queue.length === 0 ? (
        <div className="p-12 text-center rounded-lg bg-neutral-900 border border-neutral-800 space-y-3">
          <div className="w-12 h-12 rounded-full bg-neutral-800 flex items-center justify-center mx-auto text-neutral-400">
            <Clock className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-neutral-200">
            No active downloads in queue
          </h3>
          <p className="text-xs text-neutral-400 max-w-sm mx-auto">
            Analyze a video or playlist URL on the Download page and click "Download" to monitor progress here.
          </p>
          <button
            onClick={() => setActiveNav("download")}
            className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white transition-colors"
          >
            Go to Download Page
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {queue.map((task) => {
            const isDownloading = task.status === "downloading";
            const isPaused = task.status === "paused";
            const isCompleted = task.status === "completed";
            const isProcessing = task.status === "processing" || task.status === "merging";
            const isExpanded = expandedLogTaskId === task.id;

            return (
              <div
                key={task.id}
                id={`task-card-${task.id}`}
                className="p-4 rounded-lg bg-neutral-900 border border-neutral-800 transition-all hover:border-neutral-700 shadow-xs"
              >
                <div className="flex flex-col md:flex-row items-start md:items-center space-y-3 md:space-y-0 md:space-x-4">
                  {/* Thumbnail */}
                  <div className="relative w-full md:w-36 h-20 rounded bg-neutral-950 overflow-hidden shrink-0 border border-neutral-800">
                    {task.thumbnail ? (
                      <img
                        src={task.thumbnail}
                        alt={task.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-neutral-500">
                        {task.mediaType === "audio" ? <Music className="w-5 h-5" /> : <Film className="w-5 h-5" />}
                      </div>
                    )}

                    <div className="absolute bottom-1 right-1 px-1.5 py-0.2 rounded bg-black/80 backdrop-blur-xs font-mono text-[9px] uppercase text-neutral-300">
                      {task.container}
                    </div>
                  </div>

                  {/* Task Metadata & Live Progress */}
                  <div className="flex-1 min-w-0 space-y-2 w-full">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3
                          className="text-xs font-semibold text-neutral-100 truncate max-w-lg"
                          title={task.title}
                        >
                          {task.title}
                        </h3>
                        <div className="flex items-center space-x-2 text-[11px] text-neutral-400 mt-0.5">
                          <span
                            className="font-mono text-emerald-400 cursor-help"
                            title={`${explainFormat(task.formatSelector).explanation}\n\nyt-dlp: -f "${task.formatSelector}"`}
                          >
                            {task.resolutionLabel}
                          </span>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-mono font-medium capitalize ${
                          isDownloading
                            ? "bg-sky-950 text-sky-300 border border-sky-800 animate-pulse"
                            : isPaused
                            ? "bg-amber-950 text-amber-300 border border-amber-800"
                            : isCompleted
                            ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                            : isProcessing
                            ? "bg-purple-950 text-purple-300 border border-purple-800 animate-pulse"
                            : task.status === "failed"
                            ? "bg-red-950 text-red-300 border border-red-800"
                            : "bg-neutral-800 text-neutral-400 border border-neutral-700"
                        }`}
                      >
                        {task.status}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="w-full bg-neutral-950 rounded-full h-2 overflow-hidden border border-neutral-800">
                        <div
                          className={`h-full transition-all duration-300 ${
                            isCompleted
                              ? "bg-emerald-500"
                              : isProcessing
                              ? "bg-purple-500"
                              : isPaused
                              ? "bg-amber-500"
                              : "bg-emerald-500"
                          }`}
                          style={{ width: `${task.progress}%` }}
                        />
                      </div>

                      {/* Live Statistics Row: Bytes, Speed, ETA, Fragments */}
                      <div className="flex flex-wrap items-center justify-between text-[11px] font-mono text-neutral-400 pt-0.5">
                        <div className="flex items-center space-x-3">
                          <span className="font-bold text-neutral-200">
                            {task.progress}%
                          </span>
                          <span>
                            {formatBytes(task.downloadedBytes)} {task.totalBytes > 0 ? `of ${formatBytes(task.totalBytes)}` : "downloaded"}
                          </span>
                          {task.currentFragment !== undefined && task.totalFragments && (
                            <span className="text-neutral-400">
                              Frag {task.currentFragment}/{task.totalFragments}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center space-x-3">
                          {isDownloading && task.speed > 0 && (
                            <span className="text-emerald-400">
                              {(task.speed / 1048576).toFixed(1)} MB/s
                            </span>
                          )}
                          {isDownloading && task.etaSeconds > 0 && (
                            <span>
                              ETA 00:{task.etaSeconds.toString().padStart(2, "0")}
                            </span>
                          )}
                          {!isPaused && task.status !== "cancelled" && task.postProcessingStep && (
                            <span className="text-purple-400 animate-pulse">
                              {task.postProcessingStep}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Task Control Actions */}
                  <div className="flex items-center space-x-1.5 shrink-0 self-center">
                    {isDownloading && (
                      <button
                        onClick={() => pauseTask(task.id)}
                        className="p-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition-colors"
                        title="Pause download"
                      >
                        <Pause className="w-4 h-4 text-amber-400" />
                      </button>
                    )}

                    {isPaused && (
                      <button
                        onClick={() => resumeTask(task.id)}
                        className="p-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition-colors"
                        title="Resume download"
                      >
                        <Play className="w-4 h-4 text-emerald-400" />
                      </button>
                    )}

                    {(task.status === "failed" || task.status === "cancelled") && (
                      <button
                        onClick={() => retryTask(task.id)}
                        className="p-1.5 rounded bg-sky-950/60 hover:bg-sky-900/60 text-neutral-200 transition-colors border border-sky-900"
                        title="Retry this download"
                      >
                        <RotateCcw className="w-4 h-4 text-sky-400" />
                      </button>
                    )}

                    {isCompleted && task.filePath && (
                      <button
                        onClick={() => openContainingFolder(task.filePath!)}
                        className="p-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition-colors"
                        title="Show in folder"
                      >
                        <Folder className="w-4 h-4 text-sky-400" />
                      </button>
                    )}

                    <button
                      onClick={() =>
                        setExpandedLogTaskId(isExpanded ? null : task.id)
                      }
                      className={`p-1.5 rounded transition-colors ${
                        isExpanded
                          ? "bg-neutral-800 text-emerald-400"
                          : "hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200"
                      }`}
                      title="Inspect technical yt-dlp logs"
                    >
                      <Terminal className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => removeTask(task.id)}
                      className="p-1.5 rounded hover:bg-red-950/40 text-neutral-400 hover:text-red-400 transition-colors"
                      title="Cancel and remove task"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Individual Task Expandable Logs */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-neutral-800/80">
                    <div className="p-3 rounded bg-neutral-950 font-mono text-[11px] text-neutral-300 max-h-36 overflow-y-auto space-y-1">
                      {task.logs.length > 0 ? (
                        task.logs.map((log, idx) => (
                          <div key={idx} className="leading-snug">
                            {log}
                          </div>
                        ))
                      ) : (
                        <div className="text-neutral-500">Waiting for process output...</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
