import React from "react";
import { FileText, Check, Download } from "lucide-react";
import { useAppStore } from "../../store/useAppStore";

export const SubtitlesSection: React.FC = () => {
  const { mediaInfo, subtitlesConfig, updateSubtitlesConfig, enqueueCurrentDownload } = useAppStore();

  if (!mediaInfo) return null;

  const normalSubs = mediaInfo.subtitles ? Object.keys(mediaInfo.subtitles) : [];
  const autoSubs = mediaInfo.automatic_captions ? Object.keys(mediaInfo.automatic_captions) : [];

  const handleToggleLang = (lang: string) => {
    const exists = subtitlesConfig.selectedLangs.includes(lang);
    if (exists) {
      updateSubtitlesConfig({
        selectedLangs: subtitlesConfig.selectedLangs.filter((l) => l !== lang),
      });
    } else {
      updateSubtitlesConfig({
        selectedLangs: [...subtitlesConfig.selectedLangs, lang],
      });
    }
  };

  return (
    <div id="subtitles-section" className="space-y-4 select-none">
      {/* Language Checklist */}
      <div className="p-4 rounded-lg bg-neutral-900 border border-neutral-800 space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-neutral-300 uppercase font-mono tracking-wider">
            Available Subtitle Tracks
          </label>
          <span className="text-[11px] text-neutral-400">
            {normalSubs.length} official tracks found by yt-dlp
          </span>
        </div>

        {normalSubs.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            {normalSubs.map((lang) => {
              const isSelected = subtitlesConfig.selectedLangs.includes(lang);
              const trackInfo = mediaInfo.subtitles?.[lang]?.[0];
              const langName = trackInfo?.name || lang;

              return (
                <button
                  key={lang}
                  onClick={() => handleToggleLang(lang)}
                  className={`p-2 rounded border text-left flex items-center justify-between transition-all ${
                    isSelected
                      ? "bg-neutral-800 border-emerald-500 text-neutral-100"
                      : "bg-neutral-950/40 border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200"
                  }`}
                >
                  <div className="truncate pr-1">
                    <span className="font-semibold block capitalize truncate">
                      {langName}
                    </span>
                    <span className="text-[10px] text-neutral-400 font-mono">
                      Code: {lang} ({trackInfo?.ext || "vtt"})
                    </span>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="p-4 rounded bg-neutral-950/40 border border-neutral-800 text-center text-xs text-neutral-400 font-mono">
            No official author-uploaded subtitles detected on this media.
          </div>
        )}

        {/* Automatic Subtitles Toggle */}
        {autoSubs.length > 0 && (
          <div className="pt-3 border-t border-neutral-800/80">
            <label className="flex items-center space-x-2 text-xs text-neutral-300 cursor-pointer">
              <input
                type="checkbox"
                checked={subtitlesConfig.autoSubs}
                onChange={(e) => updateSubtitlesConfig({ autoSubs: e.target.checked })}
                className="rounded border-neutral-700 bg-neutral-950 text-emerald-600 focus:ring-0"
              />
              <span>
                Include automatic speech-to-text captions ({autoSubs.length} auto-generated languages)
              </span>
            </label>
          </div>
        )}
      </div>

      {/* Subtitle Handling Options */}
      <div className="p-4 rounded-lg bg-neutral-900 border border-neutral-800 space-y-4">
        <label className="text-xs font-semibold text-neutral-300 uppercase font-mono tracking-wider block">
          Subtitle Output Strategy
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <label
            className={`p-3 rounded-lg border flex items-start space-x-3 cursor-pointer transition-all ${
              subtitlesConfig.embedSubs
                ? "bg-neutral-800/80 border-emerald-500 text-neutral-200"
                : "bg-neutral-950/40 border-neutral-800 text-neutral-400"
            }`}
          >
            <input
              type="checkbox"
              checked={subtitlesConfig.embedSubs}
              onChange={(e) => updateSubtitlesConfig({ embedSubs: e.target.checked })}
              className="mt-0.5 rounded border-neutral-700 bg-neutral-950 text-emerald-600 focus:ring-0"
            />
            <div>
              <span className="font-semibold block text-neutral-200">
                Embed Subtitles Into Video Container
              </span>
              <p className="text-[11px] text-neutral-400 mt-0.5 leading-snug">
                Packaged directly into MP4 or MKV as selectable soft subtitles.
              </p>
            </div>
          </label>

          <label
            className={`p-3 rounded-lg border flex items-start space-x-3 cursor-pointer transition-all ${
              subtitlesConfig.downloadSubFiles
                ? "bg-neutral-800/80 border-emerald-500 text-neutral-200"
                : "bg-neutral-950/40 border-neutral-800 text-neutral-400"
            }`}
          >
            <input
              type="checkbox"
              checked={subtitlesConfig.downloadSubFiles}
              onChange={(e) =>
                updateSubtitlesConfig({ downloadSubFiles: e.target.checked })
              }
              className="mt-0.5 rounded border-neutral-700 bg-neutral-950 text-emerald-600 focus:ring-0"
            />
            <div>
              <span className="font-semibold block text-neutral-200">
                Write Separate Subtitle Files (.srt / .vtt)
              </span>
              <p className="text-[11px] text-neutral-400 mt-0.5 leading-snug">
                Saves external subtitle files alongside your downloaded video file.
              </p>
            </div>
          </label>
        </div>

        {/* Format Selector */}
        <div>
          <span className="text-xs text-neutral-400 block mb-2">Preferred Subtitle Format:</span>
          <div className="flex space-x-2">
            {(["VTT", "SRT", "ASS"] as const).map((fmt) => (
              <button
                key={fmt}
                onClick={() => updateSubtitlesConfig({ format: fmt })}
                className={`px-3 py-1 rounded text-xs font-mono font-semibold border transition-all ${
                  subtitlesConfig.format === fmt
                    ? "bg-emerald-600 border-emerald-500 text-white"
                    : "bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-neutral-200"
                }`}
              >
                {fmt}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="pt-2 flex justify-end">
        <button
          onClick={enqueueCurrentDownload}
          className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center space-x-2 transition-all"
        >
          <Download className="w-4 h-4" />
          <span>Apply & Download</span>
        </button>
      </div>
    </div>
  );
};
