import React, { useState } from "react";
import { AlertCircle, ChevronDown, ChevronUp, Copy, Check, ExternalLink, X } from "lucide-react";
import { useAppStore } from "../../store/useAppStore";

export const ErrorDialog: React.FC = () => {
  const { activeErrorModal, setActiveErrorModal, setActiveNav } = useAppStore();
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!activeErrorModal) return null;

  const handleCopyRaw = () => {
    navigator.clipboard.writeText(activeErrorModal.rawError);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAction = () => {
    if (activeErrorModal.actionTarget === "settings-cookies") {
      setActiveErrorModal(null);
      setActiveNav("settings");
    } else if (activeErrorModal.actionTarget === "settings-ytdlp") {
      setActiveErrorModal(null);
      setActiveNav("settings");
    } else if (activeErrorModal.actionTarget === "settings-network") {
      setActiveErrorModal(null);
      setActiveNav("settings");
    } else {
      setActiveErrorModal(null);
    }
  };

  return (
    <div
      id="error-dialog-overlay"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={() => setActiveErrorModal(null)}
    >
      <div
        id="error-dialog"
        className="w-full max-w-lg bg-neutral-900 border border-red-900/60 rounded-lg shadow-2xl p-5 text-neutral-200 select-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between pb-3 border-b border-neutral-800">
          <div className="flex items-start space-x-3">
            <div className="p-2 rounded bg-red-950/60 border border-red-800/80 text-red-400">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-neutral-100">
                {activeErrorModal.title}
              </h3>
              <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                {activeErrorModal.message}
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveErrorModal(null)}
            className="p-1 text-neutral-400 hover:text-white rounded hover:bg-neutral-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Technical Details Accordion */}
        <div className="mt-4">
          <button
            onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
            className="flex items-center justify-between w-full px-3 py-2 rounded bg-neutral-950/60 hover:bg-neutral-800/60 border border-neutral-800 text-xs text-neutral-300 font-mono transition-colors"
          >
            <span>Technical Details (Raw yt-dlp Trace)</span>
            {showTechnicalDetails ? (
              <ChevronUp className="w-3.5 h-3.5 text-neutral-400" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
            )}
          </button>

          {showTechnicalDetails && (
            <div className="mt-2 p-3 rounded bg-neutral-950 border border-neutral-800 font-mono text-[11px] text-red-300/90 max-h-48 overflow-y-auto relative">
              <pre className="whitespace-pre-wrap leading-relaxed break-all">
                {activeErrorModal.rawError}
              </pre>
              <button
                onClick={handleCopyRaw}
                className="absolute top-2 right-2 flex items-center space-x-1 px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px] border border-neutral-700"
                title="Copy raw error"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? "Copied" : "Copy"}</span>
              </button>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-5 pt-3 border-t border-neutral-800 flex items-center justify-between">
          <button
            onClick={() => setActiveErrorModal(null)}
            className="px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-xs text-neutral-300 transition-colors"
          >
            Dismiss
          </button>

          {activeErrorModal.actionLabel && (
            <button
              onClick={handleAction}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-xs font-medium text-white transition-colors"
            >
              <span>{activeErrorModal.actionLabel}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
