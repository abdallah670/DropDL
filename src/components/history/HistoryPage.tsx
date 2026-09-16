import React, { useState } from "react";
import {
  History,
  Search,
  Trash2,
  ExternalLink,
  Folder,
  RotateCcw,
  Copy,
  Check,
  Film,
  Music,
  Calendar,
} from "lucide-react";
import { useAppStore } from "../../store/useAppStore";
import { formatBytes } from "../../lib/utils";
import { explainFormat } from "../../lib/formatSelector";

export const HistoryPage: React.FC = () => {
  const { history, clearHistory, removeHistoryItem, enqueueTask, addToast } = useAppStore();
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredHistory = history.filter((item) => {
    const q = search.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.container.toLowerCase().includes(q) ||
      item.url.toLowerCase().includes(q)
    );
  });



  const handleOpenFolder = async (path: string) => {
    try {
      const tauri = (window as any).__TAURI__;
      // Preferred: native command (works regardless of shell.open allowlist scope)
      if (tauri?.invoke) {
        await tauri.invoke("open_folder", { path });
        return;
      }
      if (tauri?.shell?.open) {
        await tauri.shell.open(path);
      } else {
        addToast({
          title: "File Manager",
          message: `Path: ${path}`,
          type: "info",
        });
      }
    } catch (e: any) {
      addToast({
        title: "Could not open folder",
        message: e?.toString() || "Unknown error",
        type: "warning",
      });
    }
  };

  return (
    <div id="history-page" className="p-6 space-y-5 select-none max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-neutral-800">
        <div>
          <h1 className="text-lg font-bold text-neutral-100 flex items-center space-x-2">
            <History className="w-5 h-5 text-emerald-400" />
            <span>Download History</span>
          </h1>
          <p className="text-xs text-neutral-400 mt-0.5">
            {history.length} completed downloads recorded locally
          </p>
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-60">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search history..."
              className="w-full pl-8 pr-3 py-1.5 rounded bg-neutral-900 border border-neutral-800 text-xs text-neutral-200 placeholder:text-neutral-400 focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>

          <button
            onClick={clearHistory}
            disabled={history.length === 0}
            className="flex items-center space-x-1 px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 text-xs font-medium text-neutral-200 transition-colors border border-neutral-700 shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5 text-neutral-400" />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* List */}
      {filteredHistory.length === 0 ? (
        <div className="p-12 text-center rounded-lg bg-neutral-900 border border-neutral-800 text-xs text-neutral-400 font-mono">
          {search ? "No matching downloads found in history." : "No download history yet."}
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredHistory.map((item) => (
            <div
              key={item.id}
              className="p-3.5 rounded-lg bg-neutral-900 border border-neutral-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:border-neutral-700 transition-colors"
            >
              <div className="flex items-start space-x-3 min-w-0">
                <div className="relative w-20 h-12 rounded bg-neutral-950 overflow-hidden shrink-0 border border-neutral-800">
                  {item.thumbnail ? (
                    <img
                      src={item.thumbnail}
                      alt={item.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-neutral-500">
                      {item.container?.toLowerCase() === "mp3" ? <Music className="w-4 h-4" /> : <Film className="w-4 h-4" />}
                    </div>
                  )}
                </div>

                <div className="min-w-0">
                  <h3
                    className="text-xs font-semibold text-neutral-200 truncate max-w-lg"
                    title={item.title}
                  >
                    {item.title}
                  </h3>
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] font-mono text-neutral-400 mt-1">
                    <span className="text-emerald-400 font-bold uppercase">
                      .{item.container}
                    </span>
                    <span>•</span>
                    <span
                      className="cursor-help"
                      title={`${explainFormat(item.formatSelector).explanation}\n\nyt-dlp: -f "${item.formatSelector}"`}
                    >
                      {item.resolutionLabel}
                    </span>
                    <span>•</span>
                    <span>{formatBytes(item.fileSizeBytes || item.totalBytes || 0)}</span>
                    <span>•</span>
                    <span className="flex items-center space-x-1">
                      <Calendar className="w-3 h-3 text-neutral-400" />
                      <span>{new Date(item.completedAt || item.createdAt).toLocaleDateString()}</span>
                    </span>
                    <span>•</span>
                    <span className="truncate max-w-xs text-neutral-400" title={item.destinationPath}>
                      {item.destinationPath}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center space-x-1 shrink-0 self-end sm:self-center">
                <button
                  onClick={() => handleOpenFolder(item.destinationPath)}
                  className="p-1.5 rounded hover:bg-neutral-800 text-neutral-300 transition-colors"
                  title="Reveal in file explorer"
                >
                  <Folder className="w-4 h-4" />
                </button>


                <button
                  onClick={() => removeHistoryItem(item.id)}
                  className="p-1.5 rounded hover:bg-red-950/40 text-neutral-400 hover:text-red-400 transition-colors"
                  title="Remove from history"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
