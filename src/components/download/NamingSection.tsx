import React from "react";
import { FileText, Info } from "lucide-react";
import { useAppStore, NAMING_PRESET_TEMPLATES, previewOutputTemplate, validateOutputTemplate } from "../../store/useAppStore";
import type { NamingPreset } from "../../store/useAppStore";

const PRESETS: Array<{ id: NamingPreset; label: string; hint: string }> = [
  { id: "title", label: "Title", hint: "Video title only" },
  { id: "title-uploader", label: "Title + Uploader", hint: "Title, then channel name" },
  { id: "uploader-title", label: "Uploader + Title", hint: "Channel name first (groups by channel)" },
  { id: "title-date", label: "Title + Date", hint: "Title with upload date in brackets" },
  { id: "playlist-index", label: "Playlist + Index + Title", hint: "01, 02, ... numbered titles" },
  { id: "custom", label: "Advanced (custom template)", hint: "Write a yt-dlp output template" },
];

/**
 * Filename template presets backed by yt-dlp's native -o output template.
 * Rendered inside the Simple quality panel so normal users never see raw
 * yt-dlp syntax unless they pick "Advanced".
 */
export const NamingSection: React.FC = () => {
  const { mediaInfo, namingPreset, setNamingPreset, customTemplate, setCustomTemplate } = useAppStore();

  const sample = {
    title: mediaInfo?.title || "My Video",
    uploader: mediaInfo?.uploader || undefined,
    uploadDate: mediaInfo?.upload_date || undefined,
    playlistIndex: 1,
  };

  const activeTemplate =
    namingPreset === "custom" ? (customTemplate || "").trim() : NAMING_PRESET_TEMPLATES[namingPreset];
  const templateError = namingPreset === "custom" && activeTemplate ? validateOutputTemplate(activeTemplate) : null;
  const preview = activeTemplate && !templateError ? previewOutputTemplate(activeTemplate, sample) : null;

  return (
    <div className="p-4 rounded-lg bg-neutral-900 border border-neutral-800 space-y-3">
      <div>
        <label className="text-xs font-semibold text-neutral-300 uppercase font-mono tracking-wider flex items-center space-x-1.5">
          <FileText className="w-3.5 h-3.5" />
          <span>Filename</span>
        </label>
        <p className="text-[11px] text-neutral-500 mt-0.5">
          How downloaded files are named. Windows-invalid characters are stripped automatically.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => setNamingPreset(p.id)}
            title={p.hint}
            className={`px-2.5 py-1.5 rounded text-xs border transition-all ${
              namingPreset === p.id
                ? "bg-emerald-600 border-emerald-500 text-white font-semibold"
                : "bg-neutral-950/60 border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-700"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {namingPreset === "custom" && (
        <div className="space-y-2">
          <div>
            <label className="text-xs text-neutral-400 block mb-1">Output template (yt-dlp syntax):</label>
            <input
              type="text"
              value={customTemplate}
              onChange={(e) => setCustomTemplate(e.target.value)}
              placeholder="%(uploader)s - %(title)s.%(ext)s"
              spellCheck={false}
              className={`w-full bg-neutral-950 border rounded px-3 py-2 text-xs text-neutral-200 font-mono focus:outline-none ${
                templateError ? "border-red-600/70 focus:border-red-500" : "border-neutral-800 focus:border-emerald-500"
              }`}
            />
            <p className="text-[10px] text-neutral-500 mt-1 font-mono">
              Fields: %(title)s %(uploader)s %(upload_date)s %(playlist_index)s %(playlist_title)s %(ext)s
            </p>
          </div>
          {templateError && (
            <div className="p-2 rounded bg-red-950/40 border border-red-800/60 text-[11px] text-red-200">
              {templateError}
            </div>
          )}
        </div>
      )}

      {preview && (
        <div className="flex items-start space-x-2 text-[11px] text-neutral-400 bg-neutral-950/60 border border-neutral-800 rounded p-2">
          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-emerald-500" />
          <div>
            <span className="text-neutral-500">Preview: </span>
            <span className="font-mono text-neutral-300 break-all">{preview}</span>
          </div>
        </div>
      )}
    </div>
  );
};
