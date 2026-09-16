import React, { useState, useMemo } from "react";
import {
  SlidersHorizontal,
  Search,
  ArrowUpDown,
  Check,
  Film,
  Music,
  Columns,
  Download,
  Info,
  Layers,
  Copy,
  Sparkles,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
} from "lucide-react";
import { useAppStore } from "../../store/useAppStore";
import { YtDlpFormat } from "../../types/ytdlp";
import { formatBytes, formatBitrate } from "../../lib/utils";
import { tauriService } from "../../services/tauriService";

type SortField =
  | "format_id"
  | "height"
  | "fps"
  | "filesize"
  | "tbr"
  | "vcodec"
  | "ext";

export const FormatExplorer: React.FC = () => {
  const {
    mediaInfo,
    selectedVideoFormatId,
    setSelectedVideoFormatId,
    selectedAudioFormatId,
    setSelectedAudioFormatId,
    inspectingFormat,
    setInspectingFormat,
    enqueueCurrentDownload,
  } = useAppStore();

  // Filters
  const [filterType, setFilterType] = useState<"all" | "video" | "audio">("all");
  const [filterRes, setFilterRes] = useState<string>("any");
  const [filterCodec, setFilterCodec] = useState<string>("any");
  const [filterContainer, setFilterContainer] = useState<string>("any");
  const [filterHdr, setFilterHdr] = useState<string>("any");
  const [filterFps, setFilterFps] = useState<string>("any");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Sorting
  const [sortField, setSortField] = useState<SortField>("height");
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // Selector Generator States
  const [formulaHeight, setFormulaHeight] = useState<string>("1080");
  const [formulaCodec, setFormulaCodec] = useState<string>("any");
  const [formulaContainer, setFormulaContainer] = useState<string>("mp4");
  const [formulaCopied, setFormulaCopied] = useState<boolean>(false);

  if (!mediaInfo) return null;

  // Derive unique filter values from genuine yt-dlp formats
  const uniqueResolutions = useMemo(() => {
    const set = new Set<string>();
    mediaInfo.formats.forEach((f) => {
      if (f.height) set.add(`${f.height}p`);
    });
    return Array.from(set).sort((a, b) => parseInt(b) - parseInt(a));
  }, [mediaInfo.formats]);

  const uniqueCodecs = useMemo(() => {
    const set = new Set<string>();
    mediaInfo.formats.forEach((f) => {
      if (f.vcodec && f.vcodec !== "none") set.add(f.vcodec.split(".")[0]);
      if (f.acodec && f.acodec !== "none") set.add(f.acodec.split(".")[0]);
    });
    return Array.from(set);
  }, [mediaInfo.formats]);

  const uniqueContainers = useMemo(() => {
    const set = new Set<string>();
    mediaInfo.formats.forEach((f) => {
      if (f.ext) set.add(f.ext);
    });
    return Array.from(set);
  }, [mediaInfo.formats]);

  // Filtered & Sorted formats list
  const filteredFormats = useMemo(() => {
    return mediaInfo.formats.filter((f) => {
      const isVideo = f.vcodec && f.vcodec !== "none";
      const isAudio = f.acodec && f.acodec !== "none";

      if (filterType === "video" && !isVideo) return false;
      if (filterType === "audio" && (isVideo || !isAudio)) return false;

      if (filterRes !== "any" && `${f.height}p` !== filterRes) return false;
      if (filterContainer !== "any" && f.ext !== filterContainer) return false;
      if (filterFps !== "any" && f.fps?.toString() !== filterFps) return false;
      if (filterHdr !== "any") {
        if (filterHdr === "HDR" && !f.dynamic_range?.includes("HDR")) return false;
        if (filterHdr === "SDR" && f.dynamic_range?.includes("HDR")) return false;
      }
      if (filterCodec !== "any") {
        const codecStr = `${f.vcodec || ""} ${f.acodec || ""}`.toLowerCase();
        if (!codecStr.includes(filterCodec.toLowerCase())) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const combined = `${f.format_id} ${f.ext} ${f.vcodec} ${f.acodec} ${f.resolution} ${f.format_note}`.toLowerCase();
        if (!combined.includes(q)) return false;
      }

      return true;
    });
  }, [
    mediaInfo.formats,
    filterType,
    filterRes,
    filterCodec,
    filterContainer,
    filterHdr,
    filterFps,
    searchQuery,
  ]);

  const sortedFormats = useMemo(() => {
    return [...filteredFormats].sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (sortField === "height") {
        valA = a.height || 0;
        valB = b.height || 0;
      } else if (sortField === "filesize") {
        valA = a.filesize || a.filesize_approx || 0;
        valB = b.filesize || b.filesize_approx || 0;
      } else if (sortField === "tbr") {
        valA = a.tbr || a.vbr || a.abr || 0;
        valB = b.tbr || b.vbr || b.abr || 0;
      }

      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [filteredFormats, sortField, sortAsc]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  // Video and Audio format subsets for manual picker
  const videoFormats = mediaInfo.formats.filter((f) => f.vcodec && f.vcodec !== "none");
  const audioFormats = mediaInfo.formats.filter((f) => f.acodec && f.acodec !== "none");



  // Update formula string when options change
  const computedFormula = useMemo(() => {
    const parts: string[] = [];
    if (formulaHeight === "any") {
      parts.push("bv*");
    } else {
      parts.push(`bv*[height<=${formulaHeight}]`);
    }
    if (formulaCodec !== "any") {
      parts[0] += `[vcodec^=${formulaCodec}]`;
    }
    return `${parts.join("")}+ba/b`;
  }, [formulaHeight, formulaCodec]);


  return (
    <div id="format-explorer-root" className="space-y-4 select-none">
      {/* 1. Filter Controls & Search */}
      <div className="p-3.5 rounded-lg bg-neutral-900 border border-neutral-800 space-y-3">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          {/* Type Switcher */}
          <div className="flex items-center space-x-1 bg-neutral-950 p-1 rounded border border-neutral-800 text-xs">
            {(["all", "video", "audio"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`px-3 py-1 rounded capitalize font-medium transition-all ${
                  filterType === t
                    ? "bg-neutral-800 text-neutral-100 shadow-xs"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Search format input */}
          <div className="relative w-full md:w-64">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search format ID, codec, ext..."
              className="w-full pl-8 pr-3 py-1.5 rounded bg-neutral-950 border border-neutral-800 text-xs text-neutral-200 placeholder:text-neutral-400 focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>
        </div>

        {/* Dropdown Filters row */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Resolution */}
          <div className="flex items-center space-x-1">
            <span className="text-neutral-400 font-mono text-[11px]">Res:</span>
            <select
              value={filterRes}
              onChange={(e) => setFilterRes(e.target.value)}
              className="bg-neutral-950 border border-neutral-800 rounded px-2 py-1 text-xs text-neutral-200 font-mono focus:outline-none"
            >
              <option value="any">Any</option>
              {uniqueResolutions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {/* Codec */}
          <div className="flex items-center space-x-1">
            <span className="text-neutral-400 font-mono text-[11px]">Codec:</span>
            <select
              value={filterCodec}
              onChange={(e) => setFilterCodec(e.target.value)}
              className="bg-neutral-950 border border-neutral-800 rounded px-2 py-1 text-xs text-neutral-200 font-mono focus:outline-none"
            >
              <option value="any">Any</option>
              {uniqueCodecs.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Container */}
          <div className="flex items-center space-x-1">
            <span className="text-neutral-400 font-mono text-[11px]">Container:</span>
            <select
              value={filterContainer}
              onChange={(e) => setFilterContainer(e.target.value)}
              className="bg-neutral-950 border border-neutral-800 rounded px-2 py-1 text-xs text-neutral-200 font-mono focus:outline-none uppercase"
            >
              <option value="any">Any</option>
              {uniqueContainers.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* HDR */}
          <div className="flex items-center space-x-1">
            <span className="text-neutral-400 font-mono text-[11px]">Dynamic Range:</span>
            <select
              value={filterHdr}
              onChange={(e) => setFilterHdr(e.target.value)}
              className="bg-neutral-950 border border-neutral-800 rounded px-2 py-1 text-xs text-neutral-200 font-mono focus:outline-none"
            >
              <option value="any">Any</option>
              <option value="HDR">HDR</option>
              <option value="SDR">SDR</option>
            </select>
          </div>

          {/* FPS */}
          <div className="flex items-center space-x-1">
            <span className="text-neutral-400 font-mono text-[11px]">FPS:</span>
            <select
              value={filterFps}
              onChange={(e) => setFilterFps(e.target.value)}
              className="bg-neutral-950 border border-neutral-800 rounded px-2 py-1 text-xs text-neutral-200 font-mono focus:outline-none"
            >
              <option value="any">Any</option>
              <option value="60">60 FPS</option>
              <option value="30">30 FPS</option>
            </select>
          </div>

          <div className="ml-auto text-neutral-400 font-mono text-[11px]">
            Showing {sortedFormats.length} of {mediaInfo.formats.length} formats
          </div>
        </div>
      </div>

      {/* 2. Format Table */}
      <div className="border border-neutral-800 rounded-lg overflow-hidden bg-neutral-900 shadow-xs">
        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-neutral-950 text-neutral-400 sticky top-0 border-b border-neutral-800 z-10 text-[11px]">
              <tr>
                <th
                  onClick={() => handleSort("format_id")}
                  className="py-2.5 px-3 cursor-pointer hover:text-neutral-200"
                >
                  <div className="flex items-center space-x-1">
                    <span>ID</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-2.5 px-3">Type</th>
                <th
                  onClick={() => handleSort("height")}
                  className="py-2.5 px-3 cursor-pointer hover:text-neutral-200"
                >
                  <div className="flex items-center space-x-1">
                    <span>Resolution</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("fps")}
                  className="py-2.5 px-3 cursor-pointer hover:text-neutral-200"
                >
                  <div className="flex items-center space-x-1">
                    <span>FPS</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("vcodec")}
                  className="py-2.5 px-3 cursor-pointer hover:text-neutral-200"
                >
                  <div className="flex items-center space-x-1">
                    <span>Codec</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("filesize")}
                  className="py-2.5 px-3 cursor-pointer hover:text-neutral-200"
                >
                  <div className="flex items-center space-x-1">
                    <span>Size</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("tbr")}
                  className="py-2.5 px-3 cursor-pointer hover:text-neutral-200"
                >
                  <div className="flex items-center space-x-1">
                    <span>Bitrate</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-2.5 px-3">HDR</th>
                <th className="py-2.5 px-3">Ext</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60">
              {sortedFormats.map((fmt) => {
                const isVideo = fmt.vcodec && fmt.vcodec !== "none";
                const isAudio = fmt.acodec && fmt.acodec !== "none";
                const isMuxed = isVideo && isAudio;

                const isSelectedVideo = selectedVideoFormatId === fmt.format_id;
                const isSelectedAudio = selectedAudioFormatId === fmt.format_id;
               

                return (
                  <tr
                    key={fmt.format_id}
                    onClick={() => setInspectingFormat(fmt)}
                    className={`cursor-pointer transition-colors ${
                      isSelectedVideo || isSelectedAudio
                        ? "bg-emerald-950/30 text-emerald-200"
                        : "hover:bg-neutral-800/60 text-neutral-300"
                    }`}
                  >
                 

                    {/* Format ID */}
                    <td className="py-2 px-3 font-semibold text-neutral-100">
                      <span className="px-1.5 py-0.5 rounded bg-neutral-950 border border-neutral-800">
                        {fmt.format_id}
                      </span>
                    </td>

                    {/* Type Badge */}
                    <td className="py-2 px-3">
                      {isMuxed ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-950/60 text-purple-300 border border-purple-800">
                          Muxed
                        </span>
                      ) : isVideo ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-sky-950/60 text-sky-300 border border-sky-800">
                          Video
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-950/60 text-emerald-300 border border-emerald-800">
                          Audio
                        </span>
                      )}
                    </td>

                    {/* Resolution */}
                    <td className="py-2 px-3">
                      {fmt.resolution || (fmt.height ? `${fmt.height}p` : "audio only")}
                    </td>

                    {/* FPS */}
                    <td className="py-2 px-3 text-neutral-400">
                      {fmt.fps ? `${fmt.fps} fps` : "—"}
                    </td>

                    {/* Codec */}
                    <td className="py-2 px-3 truncate max-w-xs" title={`${fmt.vcodec || ""} ${fmt.acodec || ""}`}>
                      {isVideo
                        ? fmt.vcodec?.split(".")[0]
                        : fmt.acodec?.split(".")[0] || "—"}
                    </td>

                    {/* Size */}
                    <td className="py-2 px-3 text-neutral-400">
                      {formatBytes(fmt.filesize || fmt.filesize_approx)}
                    </td>

                    {/* Bitrate */}
                    <td className="py-2 px-3 text-neutral-400">
                      {formatBitrate(fmt.tbr || fmt.vbr || fmt.abr)}
                    </td>

                    {/* HDR */}
                    <td className="py-2 px-3">
                      {fmt.dynamic_range ? (
                        <span
                          className={`text-[10px] px-1 py-0.2 rounded font-semibold ${
                            fmt.dynamic_range.includes("HDR")
                              ? "bg-amber-950 text-amber-300 border border-amber-800"
                              : "text-neutral-400"
                          }`}
                        >
                          {fmt.dynamic_range}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>

                    {/* Container Ext */}
                    <td className="py-2 px-3 uppercase text-neutral-400">
                      {fmt.ext}
                    </td>

                    {/* Quick Select Action */}
                    <td className="py-2 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                      {isVideo && (
                        <button
                          onClick={() => setSelectedVideoFormatId(fmt.format_id)}
                          className={`px-2 py-0.5 rounded text-[10px] mr-1 border transition-colors ${
                            isSelectedVideo
                              ? "bg-emerald-600 border-emerald-500 text-white font-semibold"
                              : "bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border-neutral-700"
                          }`}
                        >
                          {isSelectedVideo ? "Selected Video" : "Pick Video"}
                        </button>
                      )}
                      {isAudio && (
                        <button
                          onClick={() => setSelectedAudioFormatId(fmt.format_id)}
                          className={`px-2 py-0.5 rounded text-[10px] border transition-colors ${
                            isSelectedAudio
                              ? "bg-emerald-600 border-emerald-500 text-white font-semibold"
                              : "bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border-neutral-700"
                          }`}
                        >
                          {isSelectedAudio ? "Selected Audio" : "Pick Audio"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Manual Format Combination Bar */}
      <div className="p-4 rounded-lg bg-neutral-900 border border-neutral-800 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Video Dropdown */}
          <div className="flex items-center space-x-2">
            <span className="text-xs text-neutral-400 font-mono">Video:</span>
            <select
              value={selectedVideoFormatId || ""}
              onChange={(e) => setSelectedVideoFormatId(e.target.value || null)}
              className="bg-neutral-950 border border-neutral-800 rounded px-2.5 py-1.5 text-xs text-neutral-200 font-mono focus:outline-none"
            >
              <option value="">None (Audio Only)</option>
              {videoFormats.map((vf) => (
                <option key={vf.format_id} value={vf.format_id}>
                  {vf.format_id} — {vf.height}p ({vf.vcodec?.split(".")[0]}) • {formatBytes(vf.filesize || vf.filesize_approx)}
                </option>
              ))}
            </select>
          </div>

          <span className="text-neutral-500 font-mono">+</span>

          {/* Audio Dropdown */}
          <div className="flex items-center space-x-2">
            <span className="text-xs text-neutral-400 font-mono">Audio:</span>
            <select
              value={selectedAudioFormatId || ""}
              onChange={(e) => setSelectedAudioFormatId(e.target.value || null)}
              className="bg-neutral-950 border border-neutral-800 rounded px-2.5 py-1.5 text-xs text-neutral-200 font-mono focus:outline-none"
            >
              <option value="">None (Silent Video)</option>
              {audioFormats.map((af) => (
                <option key={af.format_id} value={af.format_id}>
                  {af.format_id} — {af.acodec?.split(".")[0]} ({af.abr || 128} kbps) • {formatBytes(af.filesize || af.filesize_approx)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Generated Exact yt-dlp selector */}
        <div className="flex items-center space-x-3 w-full md:w-auto justify-end">
         

          <button
            onClick={enqueueCurrentDownload}
            className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center space-x-1.5 transition-colors shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Combo</span>
          </button>
        </div>
      </div>

      {/* 4. Format Details Drawer/Card (when inspecting a row) */}
      {inspectingFormat && (
        <div
          id="format-details-panel"
          className="p-4 rounded-lg bg-neutral-900 border border-neutral-800 animate-in fade-in duration-150"
        >
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-neutral-800">
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-xs text-neutral-200 font-mono">
                Format {inspectingFormat.format_id} Details
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 font-mono">
                {inspectingFormat.vcodec && inspectingFormat.vcodec !== "none"
                  ? "Video Stream"
                  : "Audio Stream"}
              </span>
            </div>
            <button
              onClick={() => setInspectingFormat(null)}
              className="text-xs text-neutral-400 hover:text-neutral-200"
            >
              Close
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
            {inspectingFormat.width && inspectingFormat.height && (
              <div className="p-2 rounded bg-neutral-950 border border-neutral-800">
                <span className="text-neutral-400 text-[10px] block">Resolution</span>
                <span className="text-neutral-200 font-semibold">
                  {inspectingFormat.width} × {inspectingFormat.height}
                </span>
              </div>
            )}

            {inspectingFormat.fps && (
              <div className="p-2 rounded bg-neutral-950 border border-neutral-800">
                <span className="text-neutral-400 text-[10px] block">FPS</span>
                <span className="text-neutral-200 font-semibold">{inspectingFormat.fps}</span>
              </div>
            )}

            {inspectingFormat.vcodec && inspectingFormat.vcodec !== "none" && (
              <div className="p-2 rounded bg-neutral-950 border border-neutral-800">
                <span className="text-neutral-400 text-[10px] block">Video Codec</span>
                <span className="text-neutral-200 font-semibold truncate block" title={inspectingFormat.vcodec}>
                  {inspectingFormat.vcodec}
                </span>
              </div>
            )}

            {inspectingFormat.acodec && inspectingFormat.acodec !== "none" && (
              <div className="p-2 rounded bg-neutral-950 border border-neutral-800">
                <span className="text-neutral-400 text-[10px] block">Audio Codec</span>
                <span className="text-neutral-200 font-semibold">{inspectingFormat.acodec}</span>
              </div>
            )}

            {inspectingFormat.tbr && (
              <div className="p-2 rounded bg-neutral-950 border border-neutral-800">
                <span className="text-neutral-400 text-[10px] block">Total Bitrate</span>
                <span className="text-neutral-200 font-semibold">{formatBitrate(inspectingFormat.tbr)}</span>
              </div>
            )}

            {inspectingFormat.dynamic_range && (
              <div className="p-2 rounded bg-neutral-950 border border-neutral-800">
                <span className="text-neutral-400 text-[10px] block">Dynamic Range</span>
                <span className="text-neutral-200 font-semibold">{inspectingFormat.dynamic_range}</span>
              </div>
            )}

            <div className="p-2 rounded bg-neutral-950 border border-neutral-800">
              <span className="text-neutral-400 text-[10px] block">Container</span>
              <span className="text-neutral-200 font-semibold uppercase">{inspectingFormat.ext}</span>
            </div>

            <div className="p-2 rounded bg-neutral-950 border border-neutral-800">
              <span className="text-neutral-400 text-[10px] block">File Size</span>
              <span className="text-neutral-200 font-semibold">
                {formatBytes(inspectingFormat.filesize || inspectingFormat.filesize_approx)}
              </span>
            </div>

            {inspectingFormat.protocol && (
              <div className="p-2 rounded bg-neutral-950 border border-neutral-800">
                <span className="text-neutral-400 text-[10px] block">Protocol</span>
                <span className="text-neutral-200 font-semibold">{inspectingFormat.protocol}</span>
              </div>
            )}

            {inspectingFormat.asr && (
              <div className="p-2 rounded bg-neutral-950 border border-neutral-800">
                <span className="text-neutral-400 text-[10px] block">Sample Rate</span>
                <span className="text-neutral-200 font-semibold">{(inspectingFormat.asr / 1000).toFixed(1)} kHz</span>
              </div>
            )}

            {inspectingFormat.audio_channels && (
              <div className="p-2 rounded bg-neutral-950 border border-neutral-800">
                <span className="text-neutral-400 text-[10px] block">Audio Channels</span>
                <span className="text-neutral-200 font-semibold">{inspectingFormat.audio_channels} ch</span>
              </div>
            )}
          </div>
        </div>
      )}

    
    </div>
  );
};
