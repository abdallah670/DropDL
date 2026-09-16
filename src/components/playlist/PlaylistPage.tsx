import React, { useState } from "react";
import {
  ListMusic,
  Check,
  Download,
  Filter,
  Layers,
  Clock,
  Film,
  Music,
} from "lucide-react";
import { useAppStore } from "../../store/useAppStore";
import { formatDuration } from "../../lib/utils";

export const PlaylistPage: React.FC = () => {
  const {
    // NOTE: read `playlist` directly (aliased). The old `playlistInfo` store
    // getter was frozen to null by zustand's spread-based set(), which made
    // this page show "No Playlist Currently Loaded" even when a playlist was
    // loaded (sidebar badge worked because it reads `playlist` directly).
    playlist: playlistInfo,
    setPlaylist,
    selectedPlaylistIndices,
    togglePlaylistIndex,
    selectAllPlaylist,
    clearAllPlaylist,
    invertPlaylistSelection,
    enqueuePlaylistItems: enqueuePlaylistSelected,
  } = useAppStore();

  const [rangeInput, setRangeInput] = useState("");
  const [batchMode, setBatchMode] = useState<"video" | "audio">("video");
  const [batchQuality, setBatchQuality] = useState<"best" | "1080p" | "720p" | "480p">("1080p");
  const [batchContainer, setBatchContainer] = useState("mp4");
  const [audioContainer, setAudioContainer] = useState("mp3");
  const [useNumberedPrefix, setUseNumberedPrefix] = useState(true);

  const containerValue = batchMode === "video" ? batchContainer : audioContainer;

  const handleEnqueueSelected = () => {
    enqueuePlaylistSelected({
      mediaMode: batchMode,
      quality: batchMode === "video" ? batchQuality : "best",
      container: containerValue,
      numberedPrefix: useNumberedPrefix,
    });
  };

  if (!playlistInfo) {
    return (
      <div id="playlist-page-empty" className="p-12 text-center select-none max-w-2xl mx-auto space-y-4">
        <div className="w-12 h-12 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center mx-auto text-neutral-400">
          <ListMusic className="w-6 h-6" />
        </div>
        <h2 className="text-base font-semibold text-neutral-200">
          No Playlist Currently Loaded
        </h2>
        <p className="text-xs text-neutral-400 leading-relaxed">
          To inspect and download playlists, paste any YouTube, SoundCloud, or supported playlist URL into the Download URL field.
        </p>
      </div>
    );
  }

  // Parse custom range (e.g. 1-3, 5, 8-10)
  const handleApplyRange = () => {
    if (!rangeInput.trim()) return;
    const indices: number[] = [];
    const parts = rangeInput.split(",");

    parts.forEach((part) => {
      const trimmed = part.trim();
      if (trimmed.includes("-")) {
        const [start, end] = trimmed.split("-").map((n) => parseInt(n.trim(), 10));
        if (!isNaN(start) && !isNaN(end)) {
          for (let i = Math.min(start, end); i <= Math.max(start, end); i++) {
            if (i >= 1 && i <= playlistInfo.entries.length) {
              indices.push(i);
            }
          }
        }
      } else {
        const num = parseInt(trimmed, 10);
        if (!isNaN(num) && num >= 1 && num <= playlistInfo.entries.length) {
          indices.push(num);
        }
      }
    });

    clearAllPlaylist();
    indices.forEach((idx) => togglePlaylistIndex(idx));
  };

  return (
    <div id="playlist-page" className="p-6 space-y-5 select-none max-w-5xl mx-auto">
      {/* Top Banner */}
      <div className="p-4 rounded-lg bg-neutral-900 border border-neutral-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs text-neutral-400 mb-1">
            <span className="font-mono text-emerald-400">PLAYLIST MODE</span>
            <span>•</span>
            <span>{playlistInfo.entries.length} videos detected</span>
          </div>
          <h1 className="text-lg font-bold text-neutral-100">
            {playlistInfo.title}
          </h1>
          <p className="text-xs text-neutral-400 mt-0.5">
            By {playlistInfo.uploader || "Unknown Creator"}
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="text-right text-xs">
            <span className="text-neutral-400">Selected:</span>{" "}
            <span className="font-bold text-emerald-400 font-mono">
              {selectedPlaylistIndices.length} / {playlistInfo.entries.length}
            </span>
          </div>
          <button
            onClick={handleEnqueueSelected}
            disabled={selectedPlaylistIndices.length === 0}
            className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-semibold text-xs flex items-center space-x-2 transition-all shadow-xs"
          >
            <Download className="w-4 h-4" />
            <span>Download {selectedPlaylistIndices.length} Selected</span>
          </button>
        </div>
      </div>

      {/* Batch Quality & Container Controls */}
      <div className="p-3.5 rounded-lg bg-neutral-900 border border-neutral-800 flex flex-wrap items-center gap-x-5 gap-y-3 text-xs">
        {/* Media Type */}
        <div className="flex items-center space-x-2">
          <span className="text-neutral-400 font-mono text-[11px]">Type:</span>
          {(["video", "audio"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setBatchMode(m)}
              className={`px-2.5 py-1 rounded border transition-colors ${
                batchMode === m
                  ? "bg-emerald-900/60 border-emerald-600 text-emerald-300 font-semibold"
                  : "bg-neutral-800 border-neutral-700 text-neutral-300 hover:bg-neutral-700"
              }`}
            >
              {m === "video" ? <Film className="w-3.5 h-3.5 inline mr-1 -mt-0.5" /> : <Music className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />}
              {m === "video" ? "Video" : "Audio only"}
            </button>
          ))}
        </div>

        {/* Quality (video mode only) */}
        {batchMode === "video" && (
          <div className="flex items-center space-x-2">
            <span className="text-neutral-400 font-mono text-[11px]">Quality:</span>
            <select
              value={batchQuality}
              onChange={(e) => setBatchQuality(e.target.value as typeof batchQuality)}
              className="bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-neutral-200 focus:outline-none focus:border-emerald-500"
            >
              <option value="best">Best available</option>
              <option value="1080p">1080p</option>
              <option value="720p">720p</option>
              <option value="480p">480p</option>
            </select>
          </div>
        )}

        {/* Container */}
        <div className="flex items-center space-x-2">
          <span className="text-neutral-400 font-mono text-[11px]">Container:</span>
          <select
            value={containerValue}
            onChange={(e) =>
              batchMode === "video"
                ? setBatchContainer(e.target.value)
                : setAudioContainer(e.target.value)
            }
            className="bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-neutral-200 focus:outline-none focus:border-emerald-500"
          >
            {batchMode === "video" ? (
              <>
                <option value="mp4">MP4</option>
                <option value="webm">WebM</option>
                <option value="mkv">MKV</option>
              </>
            ) : (
              <>
                <option value="mp3">MP3</option>
                <option value="m4a">M4A</option>
                <option value="opus">Opus</option>
                <option value="flac">FLAC</option>
                <option value="wav">WAV</option>
              </>
            )}
          </select>
        </div>

        <span className="text-neutral-500 text-[11px] font-mono">
          Applied to: {selectedPlaylistIndices.length} selected video{selectedPlaylistIndices.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* Playlist Batch Controls & Range Filter */}
      <div className="p-3.5 rounded-lg bg-neutral-900 border border-neutral-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Selection buttons */}
        <div className="flex items-center space-x-2">
          <button
            onClick={selectAllPlaylist}
            className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition-colors"
          >
            Select All
          </button>
          <button
            onClick={invertPlaylistSelection}
            className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition-colors"
          >
            Invert
          </button>
          <button
            onClick={clearAllPlaylist}
            className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition-colors"
          >
            Clear
          </button>
        </div>

        {/* Range Parser */}
        <div className="flex items-center space-x-2">
          <span className="text-neutral-400 font-mono text-[11px]">Range:</span>
          <input
            type="text"
            value={rangeInput}
            onChange={(e) => setRangeInput(e.target.value)}
            placeholder="e.g. 1-10, 15, 20-25"
            className="w-36 bg-neutral-950 border border-neutral-800 rounded px-2 py-1 text-xs text-neutral-200 font-mono focus:outline-none focus:border-emerald-500"
          />
          <button
            onClick={handleApplyRange}
            className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition-colors"
          >
            Apply
          </button>
        </div>

        {/* Numbered Prefix Option */}
        <label className="flex items-center space-x-2 cursor-pointer text-neutral-300">
          <input
            type="checkbox"
            checked={useNumberedPrefix}
            onChange={(e) => setUseNumberedPrefix(e.target.checked)}
            className="rounded border-neutral-700 bg-neutral-950 text-emerald-600 focus:ring-0"
          />
          <span className="font-mono text-[11px]">
            Index prefixes (01 - Title.mp4)
          </span>
        </label>
      </div>

      {/* Playlist Items Table */}
      <div className="border border-neutral-800 rounded-lg overflow-hidden bg-neutral-900">
        <div className="divide-y divide-neutral-800 max-h-[500px] overflow-y-auto">
          {playlistInfo.entries.map((entry) => {
            const isSelected = selectedPlaylistIndices.includes(entry.index);

            return (
              <div
                key={entry.id}
                onClick={() => togglePlaylistIndex(entry.index)}
                className={`p-3 flex items-center space-x-3 cursor-pointer transition-colors ${
                  isSelected ? "bg-emerald-950/20" : "hover:bg-neutral-800/40"
                }`}
              >
                {/* Checkbox */}
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => {}}
                  className="rounded border-neutral-700 bg-neutral-950 text-emerald-600 focus:ring-0 cursor-pointer"
                />

                {/* Index # */}
                <span className="w-8 font-mono text-xs font-bold text-neutral-400">
                  #{entry.index.toString().padStart(2, "0")}
                </span>

                {/* Thumbnail */}
                <div className="relative w-20 h-12 rounded bg-neutral-950 overflow-hidden shrink-0 border border-neutral-800">
                  {entry.thumbnail ? (
                    <img
                      src={entry.thumbnail}
                      alt={entry.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-neutral-500">
                      <Film className="w-4 h-4" />
                    </div>
                  )}
                  {entry.duration > 0 && (
                    <div className="absolute bottom-1 right-1 px-1 rounded bg-black/80 font-mono text-[9px] text-white">
                      {formatDuration(entry.duration)}
                    </div>
                  )}
                </div>

                {/* Title & Uploader */}
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-semibold text-neutral-200 truncate" title={entry.title}>
                    {entry.title}
                  </h4>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    {entry.uploader || playlistInfo.uploader}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
