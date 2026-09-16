import React, { useState, useEffect } from "react";
import {
  Link2,
  Search,
  Clipboard,
  Sparkles,
  ArrowDownToLine,
  FileText,
  X,
  Loader2,
} from "lucide-react";
import { useAppStore } from "../../store/useAppStore";
import { tauriService } from "../../services/tauriService";

export const UrlInputSection: React.FC = () => {
  const {
    inputUrl,
    setInputUrl,
    analyzeUrl,
    isAnalyzing,
    detectedClipboardUrl,
    setDetectedClipboardUrl,
    settings,
  } = useAppStore();

  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Clipboard polling — use Tauri native clipboard (no permission prompt)
  useEffect(() => {
    if (!settings.general.clipboardMonitoring) return;

    const checkClip = async () => {
      try {
        let clip: string | null = null;
        if (typeof window !== "undefined" && (window as any).__TAURI__?.clipboard) {
          clip = await (window as any).__TAURI__.clipboard.readText();
        } else {
          clip = await tauriService.checkClipboard();
        }
        if (clip && clip !== inputUrl && clip !== detectedClipboardUrl &&
            (clip.startsWith("http://") || clip.startsWith("https://"))) {
          setDetectedClipboardUrl(clip);
        }
      } catch {
        // Clipboard access denied or unavailable
      }
    };

    const interval = setInterval(checkClip, 3000);
    return () => clearInterval(interval);
  }, [settings.general.clipboardMonitoring, inputUrl, detectedClipboardUrl, setDetectedClipboardUrl]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);

    // If dragged a file (e.g. urls.txt)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (text) {
          const firstUrl = text
            .split("\n")
            .map((l) => l.trim())
            .find((l) => l.startsWith("http://") || l.startsWith("https://"));
          if (firstUrl) {
            setInputUrl(firstUrl);
            analyzeUrl(firstUrl);
          }
        }
      };
      reader.readAsText(file);
      return;
    }

    // If dragged URL text
    const text = e.dataTransfer.getData("text/plain");
    if (text) {
      setInputUrl(text.trim());
      analyzeUrl(text.trim());
    }
  };

  const handlePasteClipboard = async () => {
    try {
      let text: string | null = null;
      if (typeof window !== "undefined" && (window as any).__TAURI__?.clipboard) {
        text = await (window as any).__TAURI__.clipboard.readText();
      } else {
        text = await navigator.clipboard.readText();
      }
      if (text) {
        setInputUrl(text.trim());
      }
    } catch {
      // Clipboard access denied
    }
  };


  return (
    <div className="space-y-3">
      {/* Clipboard detected banner */}
      {detectedClipboardUrl && (
        <div
          id="clipboard-detected-banner"
          className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-800/80 text-xs text-emerald-200 animate-in fade-in slide-in-from-top-2 select-none"
        >
          <div className="flex items-center space-x-2 truncate mr-2">
            <Clipboard className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-emerald-400 font-semibold shrink-0">
              URL detected on clipboard:
            </span>
            <span className="truncate font-mono text-[11px] text-emerald-300">
              {detectedClipboardUrl}
            </span>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={() => {
                setInputUrl(detectedClipboardUrl);
                analyzeUrl(detectedClipboardUrl);
                setDetectedClipboardUrl(null);
              }}
              className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition-colors"
            >
              Analyze
            </button>
            <button
              onClick={() => setDetectedClipboardUrl(null)}
              className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs transition-colors"
            >
              Ignore
            </button>
          </div>
        </div>
      )}

      {/* Main Drag-and-drop & URL input card */}
      <div
        id="url-drop-zone"
        onDragOver={(e) => {
          e.preventDefault();
          setIsDraggingOver(true);
        }}
        onDragLeave={() => setIsDraggingOver(false)}
        onDrop={handleDrop}
        className={`p-3.5 rounded-lg bg-neutral-900 border transition-all ${
          isDraggingOver
            ? "border-emerald-500 bg-emerald-950/20 ring-2 ring-emerald-500/20"
            : "border-neutral-800 hover:border-neutral-700"
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold text-neutral-200 flex items-center space-x-1.5">
            <Link2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Media Source URL</span>
          </label>
          <div className="flex items-center space-x-2 text-[11px] text-neutral-400">
            <span>Supports YouTube, Vimeo, SoundCloud, Twitter, Twitch, and 1,000+ sites</span>
          </div>
        </div>

        {/* Input Bar */}
        <div className="flex items-center space-x-2">
          <div className="relative flex-1">
            <input
              id="input-media-url"
              type="text"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") analyzeUrl();
              }}
              placeholder="Paste video, audio, or playlist URL (e.g. https://...)"
              className="w-full bg-neutral-950 border border-neutral-700/80 rounded px-3 py-2 text-xs text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono"
            />
            {inputUrl && (
              <button
                onClick={() => setInputUrl("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-200"
                title="Clear input"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            id="btn-paste-clipboard"
            onClick={handlePasteClipboard}
            className="px-3 py-2 rounded bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-300 text-xs font-medium flex items-center space-x-1.5 transition-colors shrink-0"
            title="Paste from clipboard"
          >
            <Clipboard className="w-3.5 h-3.5" />
            <span>Paste</span>
          </button>

          <button
            id="btn-analyze-url"
            onClick={() => analyzeUrl()}
            disabled={isAnalyzing || !inputUrl.trim()}
            className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold flex items-center space-x-2 transition-all shadow-xs shrink-0"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Analyzing...</span>
              </>
            ) : (
              <>
                <Search className="w-3.5 h-3.5" />
                <span>Analyze</span>
              </>
            )}
          </button>
        </div>

        {/* Drop target hint */}
        <div className="mt-2.5 pt-2.5 border-t border-neutral-800/80 flex items-center text-[11px] text-neutral-400">
          <div className="flex items-center space-x-1.5">
            <ArrowDownToLine className="w-3 h-3 text-neutral-400" />
            <span>Drag &amp; drop media URLs or .txt batch files directly into this window</span>
          </div>
        </div>
      </div>
    </div>
  );
};
