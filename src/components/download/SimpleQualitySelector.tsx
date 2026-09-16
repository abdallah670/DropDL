import React, { useState } from "react";
import {
  Film,
  Music,
  Download,
  Folder,
  Layers,
  Sparkles,
  Info,
  Sliders,
  Check,
  X,
} from "lucide-react";
import { useAppStore } from "../../store/useAppStore";
import { formatBytes } from "../../lib/utils";export const SimpleQualitySelector: React.FC = () => {
  const {
    mediaMode,
    setMediaMode,
    simpleQuality,
    setSimpleQuality,
    outputContainer,
    setOutputContainer,
    audioExtractionFormat,
    setAudioExtractionFormat,
    audioQuality,
    setAudioQuality,
    settings,
    enqueueCurrentDownload,
    mediaInfo,
    paths,
    updateSettings,
  } = useAppStore();

  // Per-download folder override (does NOT change global settings)
  const [overrideFolder, setOverrideFolder] = useState<string | null>(null);
  const [showFolderPicker, setShowFolderPicker] = useState(false);

  const activeFolder = overrideFolder ?? settings.downloads.defaultFolder;

  const handleBrowseOverride = async () => {
    try {
      const tauri = (window as any).__TAURI__;
      if (!tauri?.dialog) return;
      const selected = await tauri.dialog.open({
        directory: true,
        multiple: false,
        title: "Select Folder for This Download",
        defaultPath: activeFolder,
      });
      if (selected && typeof selected === "string") {
        setOverrideFolder(selected);
        // Also add to favorites
        updateSettings({ downloads: { ...settings.downloads } });
        const tauri2 = (window as any).__TAURI__;
        if (tauri2) {
          // trigger a paths update by briefly updating defaultFolder and restoring
          // (favorites are tracked via updateSettings when folder changes)
        }
      }
    } catch {
      // dialog cancelled or not available
    }
  };

  const handleDownload = () => {
    if (overrideFolder) {
      // Temporarily override the setting just for enqueue, then restore
      const original = settings.downloads.defaultFolder;
      updateSettings({ downloads: { ...settings.downloads, defaultFolder: overrideFolder } });
      // Use setTimeout 0 to ensure state is flushed before enqueue reads it
      setTimeout(() => {
        enqueueCurrentDownload();
        // Restore original default after queueing
        updateSettings({ downloads: { ...settings.downloads, defaultFolder: original } });
        setOverrideFolder(null);
      }, 0);
    } else {
      enqueueCurrentDownload();
    }
  };

  const qualities = [
    { id: "best", label: "Best Available", note: "Auto-select maximum resolution & bitrate" },
    { id: "2160p", label: "2160p (4K UHD)", note: "Ultra HD • 3840 × 2160" },
    { id: "1440p", label: "1440p (2K QHD)", note: "Quad HD • 2560 × 1440" },
    { id: "1080p", label: "1080p (Full HD)", note: "High Definition • 1920 × 1080" },
    { id: "720p", label: "720p (HD)", note: "Standard HD • 1280 × 720" },
    { id: "480p", label: "480p (SD)", note: "Standard Definition • 854 × 480" },
  ] as const;

  const audioFormats = ["MP3", "M4A", "OPUS", "FLAC", "WAV"] as const;
  const audioBitrates = [
    { id: "best", label: "Best (VBR Master)" },
    { id: "320", label: "320 kbps (CBR)" },
    { id: "256", label: "256 kbps" },
    { id: "192", label: "192 kbps" },
    { id: "128", label: "128 kbps (Standard)" },
  ] as const;

  const containers = ["MP4", "MKV", "WebM", "Original"] as const;

  // Size Estimations
  const getEstimatedVideoSize = (qualityId: string): number | null => {
    if (!mediaInfo) return null;
    const vFormats = mediaInfo.formats.filter((f) => f.vcodec && f.vcodec !== "none");
    if (vFormats.length === 0) return null;

    let targetFormat;
    if (qualityId === "best") {
      targetFormat = vFormats.reduce((prev, current) => 
        ((current.tbr || current.vbr || 0) > (prev.tbr || prev.vbr || 0)) ? current : prev
      , vFormats[0]);
    } else {
      const targetHeight = parseInt(qualityId);
      const candidates = vFormats.filter(f => f.height === targetHeight);
      if (candidates.length === 0) return null;
      targetFormat = candidates.reduce((prev, current) => 
        ((current.tbr || current.vbr || 0) > (prev.tbr || prev.vbr || 0)) ? current : prev
      , candidates[0]);
    }

    if (!targetFormat) return null;
    let videoSize = targetFormat.filesize || targetFormat.filesize_approx || 0;
    
    if (videoSize === 0 && (targetFormat.tbr || targetFormat.vbr) && mediaInfo.duration) {
      const bitrate = targetFormat.tbr || targetFormat.vbr || 0;
      videoSize = (bitrate * 1000 / 8) * mediaInfo.duration;
    }

    let totalSize = videoSize;

    // Add estimated audio size for combined mode
    if (mediaMode === "video-audio") {
      const bestAudioSize = getEstimatedAudioSize("best");
      if (bestAudioSize) totalSize += bestAudioSize;
    }
    
    return totalSize > 0 ? totalSize : null;
  };

  const getEstimatedAudioSize = (bitrateId: string): number | null => {
    if (!mediaInfo) return null;
    const aFormats = mediaInfo.formats.filter((f) => f.acodec && f.acodec !== "none");
    if (aFormats.length === 0) return null;

    let targetFormat;
    if (bitrateId === "best") {
      targetFormat = aFormats.reduce((prev, current) => 
        ((current.abr || 0) > (prev.abr || 0)) ? current : prev
      , aFormats[0]);
    } else {
      const targetAbr = parseInt(bitrateId);
      targetFormat = aFormats.reduce((prev, current) => {
        return Math.abs((current.abr || 0) - targetAbr) < Math.abs((prev.abr || 0) - targetAbr) ? current : prev;
      }, aFormats[0]);
    }

    if (!targetFormat) return null;
    let size = targetFormat.filesize || targetFormat.filesize_approx || 0;
    if (size === 0 && targetFormat.abr && mediaInfo.duration) {
      size = (targetFormat.abr * 1000 / 8) * mediaInfo.duration;
    }
    return size > 0 ? size : null;
  };

  return (
    <div id="simple-quality-selector-panel" className="space-y-5 select-none">
      {/* 1. Mode Selection: Video+Audio, Audio Only, Video Only */}
      <div className="p-4 rounded-lg bg-neutral-900 border border-neutral-800">
        <label className="text-xs font-semibold text-neutral-300 mb-3 block uppercase font-mono tracking-wider">
          1. Select Media Type
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <button
            id="mode-video-audio"
            onClick={() => setMediaMode("video-audio")}
            className={`p-3 rounded-lg border text-left transition-all ${
              mediaMode === "video-audio"
                ? "bg-emerald-950/40 border-emerald-500 text-white shadow-xs"
                : "bg-neutral-950/60 border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-700"
            }`}
          >
            <div className="flex items-center space-x-2 font-semibold text-xs text-neutral-200">
              <Film className="w-3.5 h-3.5 text-emerald-400" />
              <span>+</span>
              <Music className="w-3.5 h-3.5 text-emerald-400" />
              <span>Video + Audio</span>
            </div>
            <p className="text-[11px] text-neutral-400 mt-1 leading-snug">
              Merged via FFmpeg into a single complete media file.
            </p>
          </button>

          <button
            id="mode-audio-only"
            onClick={() => setMediaMode("audio-only")}
            className={`p-3 rounded-lg border text-left transition-all ${
              mediaMode === "audio-only"
                ? "bg-emerald-950/40 border-emerald-500 text-white shadow-xs"
                : "bg-neutral-950/60 border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-700"
            }`}
          >
            <div className="flex items-center space-x-2 font-semibold text-xs text-neutral-200">
              <Music className="w-4 h-4 text-emerald-400" />
              <span>Audio Only</span>
            </div>
            <p className="text-[11px] text-neutral-400 mt-1 leading-snug">
              Extract track directly into MP3, M4A, FLAC, or OPUS.
            </p>
          </button>

          <button
            id="mode-video-only"
            onClick={() => setMediaMode("video-only")}
            className={`p-3 rounded-lg border text-left transition-all ${
              mediaMode === "video-only"
                ? "bg-emerald-950/40 border-emerald-500 text-white shadow-xs"
                : "bg-neutral-950/60 border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-700"
            }`}
          >
            <div className="flex items-center space-x-2 font-semibold text-xs text-neutral-200">
              <Film className="w-4 h-4 text-sky-400" />
              <span>Video Only</span>
            </div>
            <p className="text-[11px] text-neutral-400 mt-1 leading-snug">
              Raw silent visual stream without audio track payloads.
            </p>
          </button>
        </div>
      </div>

      {/* 2. Quality Selection */}
      {mediaMode !== "audio-only" ? (
        <div className="p-4 rounded-lg bg-neutral-900 border border-neutral-800">
          <div className="flex items-center justify-between mb-3">
            <label className="text-xs font-semibold text-neutral-300 uppercase font-mono tracking-wider">
              2. Target Video Quality
            </label>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {qualities.map((q) => {
              const isSelected = simpleQuality === q.id;
              const estSize = getEstimatedVideoSize(q.id);
              return (
                <button
                  key={q.id}
                  id={`quality-${q.id}`}
                  onClick={() => setSimpleQuality(q.id)}
                  className={`p-2.5 rounded-lg border text-left transition-all relative ${
                    isSelected
                      ? "bg-neutral-800 border-emerald-500 text-neutral-100 ring-1 ring-emerald-500/30"
                      : "bg-neutral-950/40 border-neutral-800/80 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-neutral-200">
                      {q.label}
                    </span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                  </div>
                  <div className="text-[10px] text-neutral-400 mt-1 font-mono leading-tight">
                    {q.note}
                    {estSize && <div className="mt-1 text-emerald-500/70 font-semibold text-[9px] uppercase tracking-wider">~ {formatBytes(estSize)}</div>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        /* Audio Extraction Configuration */
        <div className="p-4 rounded-lg bg-neutral-900 border border-neutral-800 space-y-4">
          <label className="text-xs font-semibold text-neutral-300 uppercase font-mono tracking-wider block">
            2. Audio Extraction Parameters
          </label>

          <div>
            <span className="text-xs text-neutral-400 block mb-2">Target Audio Format:</span>
            <div className="flex flex-wrap gap-2">
              {audioFormats.map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => setAudioExtractionFormat(fmt)}
                  className={`px-3 py-1.5 rounded text-xs font-semibold font-mono border transition-all ${
                    audioExtractionFormat === fmt
                      ? "bg-emerald-600 border-emerald-500 text-white"
                      : "bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-700"
                  }`}
                >
                  {fmt}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="text-xs text-neutral-400 block mb-2">Audio Bitrate / Quality:</span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {audioBitrates.map((b) => {
                const isSelected = audioQuality === b.id;
                const estSize = getEstimatedAudioSize(b.id);
                return (
                  <button
                    key={b.id}
                    onClick={() => setAudioQuality(b.id as any)}
                    className={`p-2 rounded text-left border text-xs transition-all relative ${
                      isSelected
                        ? "bg-neutral-800 border-emerald-500 text-neutral-100 ring-1 ring-emerald-500/30"
                        : "bg-neutral-950/40 border-neutral-800 text-neutral-400 hover:border-neutral-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold block">{b.label}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                    </div>
                    {estSize && <div className="mt-1 text-emerald-500/70 font-semibold text-[9px] uppercase tracking-wider">~ {formatBytes(estSize)}</div>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

  

      {/* 3. Output Container & Destination */}
      <div className="p-4 rounded-lg bg-neutral-900 border border-neutral-800 space-y-4">
        <label className="text-xs font-semibold text-neutral-300 uppercase font-mono tracking-wider block">
          3. Destination & Output Container
        </label>

        {mediaMode !== "audio-only" && (
          <div>
            <span className="text-xs text-neutral-400 block mb-2">Container / Format:</span>
            <div className="flex flex-wrap gap-2">
              {containers.map((c) => (
                <button
                  key={c}
                  onClick={() => setOutputContainer(c)}
                  className={`px-3 py-1.5 rounded text-xs font-semibold font-mono border transition-all ${
                    outputContainer === c
                      ? "bg-emerald-600 border-emerald-500 text-white"
                      : "bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-700"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-neutral-400 mt-1.5">
              Note: Changing container to MP4 may trigger remuxing if original video codec is VP9/AV1.
            </p>
          </div>
        )}

        {/* Output folder picker for THIS download */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-400 font-mono">Save to:</span>
            {overrideFolder && (
              <button
                onClick={() => setOverrideFolder(null)}
                className="text-[10px] text-neutral-500 hover:text-neutral-300 flex items-center space-x-1"
                title="Reset to default folder"
              >
                <X className="w-3 h-3" />
                <span>Reset to default</span>
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <div
              className={`flex-1 flex items-center space-x-2 px-3 py-2 rounded border text-xs font-mono truncate ${
                overrideFolder
                  ? "bg-emerald-950/20 border-emerald-700/60 text-emerald-300"
                  : "bg-neutral-950 border-neutral-800 text-neutral-400"
              }`}
            >
              <Folder className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate" title={activeFolder}>{activeFolder}</span>
              {overrideFolder && <span className="ml-1 shrink-0 text-[9px] px-1 rounded bg-emerald-800/40 text-emerald-400 border border-emerald-700/50">override</span>}
            </div>
            <button
              onClick={handleBrowseOverride}
              className="px-3 py-2 rounded bg-neutral-800 hover:bg-neutral-700 text-xs text-neutral-200 border border-neutral-700 flex items-center space-x-1.5 shrink-0"
              title="Browse for folder"
            >
              <Folder className="w-3.5 h-3.5" />
              <span>Browse</span>
            </button>
          </div>

          {/* Favorite folder quick-picks */}
          {paths.favoriteFolders.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {paths.favoriteFolders.map((folder) => (
                <button
                  key={folder}
                  onClick={() => setOverrideFolder(folder === settings.downloads.defaultFolder ? null : folder)}
                  className={`px-2 py-1 rounded text-[10px] font-mono border transition-all truncate max-w-[200px] ${
                    activeFolder === folder
                      ? "bg-emerald-900/40 border-emerald-700 text-emerald-300"
                      : "bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-neutral-200"
                  }`}
                  title={folder}
                >
                  {folder}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Big Download Button */}
      <div className="pt-2 flex items-center justify-between">
        <div className="text-xs text-neutral-400">
          Selected:{" "}
          <span className="text-neutral-200 font-semibold">
            {mediaMode === "audio-only"
              ? `Audio (${audioExtractionFormat} • ${audioQuality})`
              : `${simpleQuality} • ${outputContainer}`}
          </span>
        </div>

        <button
          id="btn-download-now"
          onClick={handleDownload}
          className="px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center space-x-2 transition-all shadow-md active:scale-98"
        >
          <Download className="w-4 h-4" />
          <span>Download Media</span>
        </button>
      </div>
    </div>
  );
};
