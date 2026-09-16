import React, { useState } from "react";
import {
  Clock,
  User,
  Eye,
  Calendar,
  Layers,
  ChevronDown,
  ChevronUp,
  Tag,
  Radio,
  SlidersHorizontal,
  FileText,
  Bookmark,
  Terminal,
  ExternalLink,
} from "lucide-react";
import { useAppStore } from "../../store/useAppStore";
import { formatDuration, formatNumber } from "../../lib/utils";

export const MediaHeader: React.FC = () => {
  const { mediaInfo, activeMediaTab, setActiveMediaTab } = useAppStore();
  const [showFullDescription, setShowFullDescription] = useState(false);

  if (!mediaInfo) return null;

  const tabs: Array<{
    id: "simple" | "formats" | "subtitles" | "metadata";
    label: string;
    icon: React.ReactNode;
    highlight?: boolean;
    badge?: string;
  }> = [
    {
      id: "simple",
      label: "Simple Mode",
      icon: <Radio className="w-3.5 h-3.5" />,
    },
    {
      id: "formats",
      label: "Format Explorer",
      icon: <SlidersHorizontal className="w-3.5 h-3.5" />,
      highlight: true,
      badge: `${mediaInfo.formats.length} formats`,
    },
    {
      id: "subtitles",
      label: "Subtitles",
      icon: <FileText className="w-3.5 h-3.5" />,
      badge: mediaInfo.subtitles
        ? `${Object.keys(mediaInfo.subtitles).length}`
        : undefined,
    },
    {
      id: "metadata",
      label: "Metadata & Tags",
      icon: <Bookmark className="w-3.5 h-3.5" />,
    },

  ];

  return (
    <div
      id="media-header-card"
      className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden select-none"
    >
      {/* Top Media Info Bar */}
      <div className="p-4 flex flex-col md:flex-row items-start md:items-center space-y-4 md:space-y-0 md:space-x-4">
        {/* Media Thumbnail */}
        <div className="relative w-full md:w-56 h-32 md:h-28 rounded bg-neutral-950 overflow-hidden shrink-0 border border-neutral-800">
          {mediaInfo.thumbnail ? (
            <img
              src={mediaInfo.thumbnail}
              alt={mediaInfo.title}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-neutral-400 font-mono text-xs">
              No Thumbnail
            </div>
          )}

          {/* Duration Pill */}
          {mediaInfo.duration !== undefined && mediaInfo.duration > 0 && (
            <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/80 backdrop-blur-xs text-white font-mono text-[10px] flex items-center space-x-1 border border-white/10">
              <Clock className="w-2.5 h-2.5" />
              <span>{formatDuration(mediaInfo.duration)}</span>
            </div>
          )}

          {/* Platform Extractor Pill */}
          <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/80 backdrop-blur-xs text-neutral-300 font-sans text-[10px] capitalize font-medium border border-white/10">
            {mediaInfo.extractor}
          </div>
        </div>

        {/* Media Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2 mb-1 flex-wrap gap-y-1">
            <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-neutral-800 text-neutral-400 border border-neutral-700">
              ID: {mediaInfo.id}
            </span>
            {mediaInfo.is_live && (
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-red-950 text-red-400 border border-red-800 animate-pulse font-semibold">
                ● LIVE
              </span>
            )}
            {mediaInfo.age_limit !== undefined && mediaInfo.age_limit > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-950 text-amber-400 border border-amber-800 font-mono">
                {mediaInfo.age_limit}+
              </span>
            )}
          </div>

          <h2
            className="text-base font-semibold text-neutral-100 line-clamp-2 tracking-tight leading-snug"
            title={mediaInfo.title}
          >
            {mediaInfo.title}
          </h2>

          {/* Metadata Row */}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-400">
            {mediaInfo.uploader && (
              <div className="flex items-center space-x-1.5 text-neutral-300">
                <User className="w-3.5 h-3.5 text-neutral-400" />
                <span className="font-medium">{mediaInfo.uploader}</span>
              </div>
            )}

            {mediaInfo.view_count !== undefined && (
              <div className="flex items-center space-x-1.5">
                <Eye className="w-3.5 h-3.5 text-neutral-400" />
                <span>{formatNumber(mediaInfo.view_count)} views</span>
              </div>
            )}

            {mediaInfo.upload_date && (
              <div className="flex items-center space-x-1.5">
                <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                <span>
                  {mediaInfo.upload_date.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3")}
                </span>
              </div>
            )}

            <div className="flex items-center space-x-1.5">
              <Layers className="w-3.5 h-3.5 text-neutral-400" />
              <span>{mediaInfo.formats.length} formats available</span>
            </div>
          </div>

          {/* Description Snippet */}
          {mediaInfo.description && (
            <div className="mt-2 text-xs text-neutral-400">
              <p className={showFullDescription ? "" : "line-clamp-1"}>
                {mediaInfo.description}
              </p>
              <button
                onClick={() => setShowFullDescription(!showFullDescription)}
                className="mt-0.5 text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center space-x-0.5"
              >
                <span>{showFullDescription ? "Show less" : "Show full description"}</span>
                {showFullDescription ? (
                  <ChevronUp className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="flex items-center space-x-1 px-4 border-t border-neutral-800/80 bg-neutral-950/40 overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = activeMediaTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              onClick={() => setActiveMediaTab(tab.id)}
              className={`flex items-center space-x-2 py-2.5 px-3.5 text-xs font-medium border-b-2 transition-all shrink-0 ${
                isActive
                  ? "border-emerald-500 text-emerald-400 bg-neutral-900/50"
                  : "border-transparent text-neutral-400 hover:text-neutral-200 hover:border-neutral-700"
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.badge && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isActive
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      : "bg-neutral-800 text-neutral-400 border border-neutral-700"
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
