import React, { useState } from "react";
import {
  Terminal,
  Trash2,
  Download,
  Copy,
  Check,
  Search,
  AlertTriangle,
  Info,
  CheckCircle2,
} from "lucide-react";
import { useAppStore } from "../../store/useAppStore";

export const LogViewerPage: React.FC = () => {
  const { logs, clearLogs, addToast } = useAppStore();
  const [filterLevel, setFilterLevel] = useState<"all" | "info" | "warn" | "error">("all");
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState(false);

  const filteredLogs = logs.filter((l) => {
    const isWarning = l.level === "warning" || l.level === "warn";
    if (filterLevel !== "all") {
      if (filterLevel === "warn" && !isWarning) return false;
      if (filterLevel === "info" && l.level !== "info" && l.level !== "stdout") return false;
      if (filterLevel === "error" && l.level !== "error" && l.level !== "stderr") return false;
    }
    const logText = l.text || l.message || "";
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        logText.toLowerCase().includes(q) ||
        (l.source && l.source.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const handleCopyAll = () => {
    const text = filteredLogs
      .map(
        (l) =>
          `[${l.timestamp}] [${l.level.toUpperCase()}] [${l.source || "sys"}] ${l.text || l.message || ""}`
      )
      .join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportTxt = () => {
    const text = logs
      .map(
        (l) =>
          `[${l.timestamp}] [${l.level.toUpperCase()}] [${l.source || "sys"}] ${l.text || l.message || ""}`
      )
      .join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dropdl-logs-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    addToast({
      title: "Logs Exported",
      message: "Log history exported to text file.",
      type: "success",
    });
  };

  return (
    <div id="log-viewer-page" className="p-6 space-y-4 select-none max-w-5xl mx-auto">
      {/* Top Header & Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-neutral-800">
        <div>
          <h1 className="text-lg font-bold text-neutral-100 flex items-center space-x-2">
            <Terminal className="w-5 h-5 text-emerald-400" />
            <span>Process & Diagnostic Logs</span>
          </h1>
          <p className="text-xs text-neutral-400 mt-0.5 font-mono">
            Direct stdout / stderr stream from yt-dlp, FFmpeg, and internal dispatchers
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleCopyAll}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-xs font-medium text-neutral-200 transition-colors border border-neutral-700"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>

          <button
            onClick={handleExportTxt}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-xs font-medium text-neutral-200 transition-colors border border-neutral-700"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export .txt</span>
          </button>

          <button
            onClick={clearLogs}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-xs font-medium text-neutral-200 transition-colors border border-neutral-700"
          >
            <Trash2 className="w-3.5 h-3.5 text-neutral-400" />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center space-x-1 bg-neutral-900 p-1 rounded border border-neutral-800">
          {(["all", "info", "warn", "error"] as const).map((lvl) => (
            <button
              key={lvl}
              onClick={() => setFilterLevel(lvl)}
              className={`px-3 py-1 rounded font-mono capitalize transition-all ${
                filterLevel === lvl
                  ? "bg-neutral-800 text-neutral-100 font-semibold shadow-xs"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              {lvl}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search log messages..."
            className="w-full pl-8 pr-3 py-1.5 rounded bg-neutral-900 border border-neutral-800 text-xs text-neutral-200 placeholder:text-neutral-400 focus:outline-none focus:border-emerald-500 font-mono"
          />
        </div>
      </div>

      {/* Console Output Window */}
      <div className="p-4 rounded-lg bg-neutral-950 border border-neutral-800 font-mono text-xs text-neutral-300 min-h-[420px] max-h-[600px] overflow-y-auto space-y-1.5 shadow-inner">
        {filteredLogs.length === 0 ? (
          <div className="text-neutral-500 text-center py-20 font-mono text-xs">
            No log entries matching filter criteria.
          </div>
        ) : (
          filteredLogs.map((item) => (
            <div
              key={item.id}
              className={`flex items-start space-x-2 leading-relaxed text-[11px] ${
                item.level === "error" || item.level === "stderr"
                  ? "text-red-400 bg-red-950/20 px-1 py-0.5 rounded"
                  : item.level === "warn" || item.level === "warning"
                  ? "text-amber-300"
                  : "text-neutral-300"
              }`}
            >
              <span className="text-neutral-500 shrink-0 select-none">
                [{item.timestamp}]
              </span>

              <span
                className={`font-bold uppercase shrink-0 text-[10px] px-1 rounded ${
                  item.level === "error" || item.level === "stderr"
                    ? "bg-red-900 text-white"
                    : item.level === "warn" || item.level === "warning"
                    ? "bg-amber-900 text-amber-200"
                    : "bg-neutral-800 text-neutral-300"
                }`}
              >
                {item.level}
              </span>

              {item.source && (
                <span className="text-emerald-400 shrink-0 font-semibold">
                  [{item.source}]
                </span>
              )}

              <span className="break-all whitespace-pre-wrap flex-1">
                {item.text || item.message}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
