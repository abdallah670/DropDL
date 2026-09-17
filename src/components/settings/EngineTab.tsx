import React, { useState, useEffect } from "react";
import { Cpu, CheckCircle2, XCircle, RefreshCw, Download, Loader2, ShieldCheck } from "lucide-react";
import { useAppStore } from "../../store/useAppStore";
import { tauriService } from "../../services/tauriService";

/**
 * "Engine" settings tab: bundled yt-dlp / FFmpeg versions and a safe updater
 * for the yt-dlp binary (downloaded release is verified before swapping in).
 */
export const EngineTab: React.FC = () => {
  const { dependencies, refreshDependencies, addToast } = useAppStore();
  const [checking, setChecking] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<{
    currentVersion: string;
    latestVersion: string;
    updateAvailable: boolean;
  } | null>(null);

  useEffect(() => {
    if (dependencies.length === 0) void refreshDependencies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCheckUpdate = async () => {
    setChecking(true);
    try {
      const info = await tauriService.checkYtDlpUpdate();
      setUpdateInfo(info);
      addToast({
        title: info.updateAvailable ? "Update Available" : "Up to Date",
        message: info.updateAvailable
          ? `yt-dlp ${info.latestVersion} is available (installed: ${info.currentVersion}).`
          : `yt-dlp ${info.currentVersion} is the latest release.`,
        type: info.updateAvailable ? "info" : "success",
      });
    } catch (e: any) {
      addToast({
        title: "Update Check Failed",
        message: e?.toString() || "Could not reach github.com to compare versions.",
        type: "warning",
      });
    } finally {
      setChecking(false);
    }
  };

  const handleUpdate = async () => {
    setUpdating(true);
    try {
      const newVersion = await tauriService.updateYtDlp();
      addToast({
        title: "yt-dlp Updated",
        message: `Engine updated to ${newVersion}. It is used from the next download onward.`,
        type: "success",
      });
      setUpdateInfo((prev) => (prev ? { ...prev, currentVersion: newVersion, updateAvailable: false } : prev));
      await refreshDependencies();
    } catch (e: any) {
      // The Rust backend validates the downloaded binary before swapping it
      // in, so a failure never leaves a broken yt-dlp behind.
      addToast({
        title: "Update Failed",
        message: e?.toString() || "The download could not be validated. Your existing yt-dlp is untouched.",
        type: "warning",
      });
    } finally {
      setUpdating(false);
    }
  };

  const icon = (ok: boolean) =>
    ok ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-red-400" />;

  return (
    <div className="space-y-4">
      {/* Dependency status */}
      <div className="p-4 rounded-lg bg-neutral-900 border border-neutral-800 space-y-3">
        <h3 className="text-xs font-semibold uppercase text-neutral-300 font-mono tracking-wider flex items-center space-x-1.5">
          <Cpu className="w-3.5 h-3.5" />
          <span>Bundled Engine</span>
        </h3>
        {dependencies.length === 0 ? (
          <p className="text-[11px] text-neutral-500">Checking bundled binaries…</p>
        ) : (
          <div className="space-y-2">
            {dependencies.map((d) => (
              <div key={d.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2">
                  {icon(d.installed)}
                  <span className="text-neutral-200 font-semibold">{d.name}</span>
                  {d.version && <span className="font-mono text-neutral-400">{d.version}</span>}
                </div>
                <span className="text-[10px] text-neutral-500">{d.installed ? "ready" : "missing"}</span>
              </div>
            ))}
          </div>
        )}
        <button
          onClick={() => void refreshDependencies()}
          className="text-[11px] text-neutral-400 hover:text-neutral-200 flex items-center space-x-1"
        >
          <RefreshCw className="w-3 h-3" />
          <span>Re-check</span>
        </button>
      </div>

      {/* yt-dlp updater */}
      <div className="p-4 rounded-lg bg-neutral-900 border border-neutral-800 space-y-3">
        <h3 className="text-xs font-semibold uppercase text-neutral-300 font-mono tracking-wider">
          yt-dlp Updates
        </h3>
        <p className="text-[11px] text-neutral-400 leading-snug">
          yt-dlp releases new versions frequently to keep up with website changes. DropDL compares your installed
          version against the latest GitHub release. The update is downloaded to a temporary location and verified
          with <span className="font-mono">yt-dlp --version</span> before replacing the current binary — if the
          download is corrupted or interrupted, your existing yt-dlp is left untouched.
        </p>

        {updateInfo && (
          <div className="text-[11px] font-mono text-neutral-400 space-y-0.5">
            <div>Installed: <span className="text-neutral-200">{updateInfo.currentVersion || "unknown"}</span></div>
            <div>Latest: <span className="text-neutral-200">{updateInfo.latestVersion}</span></div>
          </div>
        )}

        <div className="flex items-center space-x-2">
          <button
            onClick={handleCheckUpdate}
            disabled={checking || updating}
            className="px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 text-xs font-medium text-neutral-200 border border-neutral-700 flex items-center space-x-1.5"
          >
            {checking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            <span>Check for Updates</span>
          </button>

          {updateInfo?.updateAvailable && (
            <button
              onClick={handleUpdate}
              disabled={updating}
              className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-xs font-semibold text-white flex items-center space-x-1.5"
            >
              {updating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              <span>Update to {updateInfo.latestVersion}</span>
            </button>
          )}
        </div>
      </div>

      {/* Local-first reassurance */}
      <div className="p-4 rounded-lg bg-neutral-900/60 border border-neutral-800 flex items-start space-x-2">
        <ShieldCheck className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
        <p className="text-[11px] text-neutral-400 leading-snug">
          Update checks contact <span className="font-mono">api.github.com</span> only, and only when you press
          "Check for Updates". No URLs, cookies, history, or download data are ever sent anywhere — DropDL
          processes everything locally.
        </p>
      </div>
    </div>
  );
};
