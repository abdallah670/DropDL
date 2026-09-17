import React from "react";
import { Bookmark, Download, Image, FileCode, MessageSquare, ListTree } from "lucide-react";
import { useAppStore } from "../../store/useAppStore";

export const MetadataSection: React.FC = () => {
  const { metadataConfig, updateMetadataConfig, enqueueCurrentDownload } = useAppStore();

  const options: Array<{
    key: keyof typeof metadataConfig;
    label: string;
    hint?: string;
    icon: React.ReactNode;
  }> = [
    {
      key: "embedMetadata",
      label: "Embed Metadata Tags",

      icon: <Bookmark className="w-4 h-4 text-emerald-400" />
    },
    {
      key: "embedThumbnail",
      label: "Embed Cover Art / Thumbnail",
      icon: <Image className="w-4 h-4 text-sky-400" />
    },
    {
      key: "embedChapters",
      label: "Embed Chapters Into Video",
      hint: "Adds chapter markers to the video file (--embed-chapters).",
      icon: <ListTree className="w-4 h-4 text-purple-400" />,
    },
    {
      key: "writeDescription",
      label: "Write Description File",
      
      icon: <FileCode className="w-4 h-4 text-amber-400" />,
    },
    {
      key: "writeInfoJson",
      label: "Write Full Info JSON",
   
      icon: <FileCode className="w-4 h-4 text-teal-400" />,
    },
    {
      key: "writeThumbnailFile",
      label: "Write Thumbnail Image File",
    
      icon: <Image className="w-4 h-4 text-indigo-400" />,
    },
    {
      key: "writeComments",
      label: "Write Video Comments",
      icon: <MessageSquare className="w-4 h-4 text-rose-400" />,
    },
  ];

  return (
    <div id="metadata-section" className="space-y-4 select-none">
      <div className="p-4 rounded-lg bg-neutral-900 border border-neutral-800 space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-neutral-300 uppercase font-mono tracking-wider">
            Metadata & File Tagging Options
          </label>
        
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
          {options.map((opt) => {
            const isChecked = metadataConfig[opt.key];
            return (
              <label
                key={opt.key}
                className={`p-3 rounded-lg border flex items-start space-x-3 cursor-pointer transition-all ${
                  isChecked
                    ? "bg-neutral-800/80 border-emerald-500 text-neutral-200"
                    : "bg-neutral-950/40 border-neutral-800 text-neutral-400 hover:border-neutral-700"
                }`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={(e) =>
                    updateMetadataConfig({ [opt.key]: e.target.checked })
                  }
                  className="mt-0.5 rounded border-neutral-700 bg-neutral-950 text-emerald-600 focus:ring-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    {opt.icon}
                    <span className="font-semibold text-neutral-200">
                      {opt.label}
                    </span>
                  </div>
                  {opt.hint && (
                    <p className="mt-1 text-[11px] leading-snug text-neutral-500">
                      {opt.hint}
                    </p>
                  )}
                </div>
              </label>
            );
          })}
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
