import React from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { useAppStore } from "../../store/useAppStore";

export const NotificationToast: React.FC = () => {
  const { activeNotification, dismissNotification } = useAppStore();

  if (!activeNotification) return null;

  return (
    <div
      id="desktop-notification-toast"
      className="fixed bottom-5 right-5 z-50 max-w-sm w-full bg-neutral-900 border border-neutral-700 text-neutral-100 rounded-lg shadow-2xl p-3.5 flex items-start space-x-3 animate-in fade-in slide-in-from-bottom-3 duration-200 select-none"
    >
      <div className="shrink-0 pt-0.5">
        {activeNotification.type === "success" && (
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
        )}
        {activeNotification.type === "warning" && (
          <AlertCircle className="w-5 h-5 text-amber-400" />
        )}
        {(!activeNotification.type || activeNotification.type === "info") && (
          <Info className="w-5 h-5 text-sky-400" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold text-neutral-200 tracking-tight">
            {activeNotification.title}
          </h4>
          <span className="text-[10px] text-neutral-400 font-mono">DropDL</span>
        </div>
        <p className="text-xs text-neutral-300 mt-1 leading-relaxed break-words">
          {activeNotification.body}
        </p>
      </div>

      <button
        onClick={dismissNotification}
        className="shrink-0 p-1 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded transition-colors"
        title="Dismiss Notification"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
