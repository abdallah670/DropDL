import React from "react";
import {
  Download,
  Loader2,
  Sparkles,
  Layers,
  Film,
  Music,
  SlidersHorizontal,
  FolderDown,
  Terminal,
  ArrowRight,
} from "lucide-react";
import { useAppStore } from "../../store/useAppStore";
import { UrlInputSection } from "./UrlInputSection";
import { MediaHeader } from "./MediaHeader";
import { SimpleQualitySelector } from "./SimpleQualitySelector";
import { NamingSection } from "./NamingSection";
import { FormatExplorer } from "../formats/FormatExplorer";
import { SubtitlesSection } from "../subtitles/SubtitlesSection";
import { MetadataSection } from "../metadata/MetadataSection";


export const DownloadPage: React.FC = () => {
  const {
    mediaInfo,
    isAnalyzing,
    activeMediaTab,
    inputUrl,
    analyzeUrl,
    setInputUrl,
  } = useAppStore();

  return (
    <div id="download-page" className="p-6 space-y-6 select-none max-w-5xl mx-auto">
      <UrlInputSection />
      {isAnalyzing && (
        <div
          id="analyzing-status-card"
          className="p-10 rounded-lg bg-neutral-900 border border-neutral-800 text-center space-y-3 animate-in fade-in"
        >
          <div className="w-10 h-10 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center mx-auto text-emerald-400">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
          <h3 className="text-sm font-semibold text-neutral-100">
            Analyzing...
          </h3>
        </div>
      )}

      {!isAnalyzing && mediaInfo && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <MediaHeader />
          {activeMediaTab === "simple" && <SimpleQualitySelector />}
          {activeMediaTab === "simple" && <NamingSection />}
          {activeMediaTab === "formats" && <FormatExplorer />}
          {activeMediaTab === "subtitles" && <SubtitlesSection />}
          {activeMediaTab === "metadata" && <MetadataSection />}
        </div>
      )}
    </div>
  );
};
