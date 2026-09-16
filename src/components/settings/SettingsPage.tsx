import React, { useState } from "react";
import {
  Settings,
  Folder,
  Sliders,
  Terminal,
  Film,
  Globe,
  Cookie,
  Shield,
  CheckCircle2,
  RefreshCw,
  Info,
} from "lucide-react";
import { useAppStore } from "../../store/useAppStore";
import { tauriService } from "../../services/tauriService";

export const SettingsPage: React.FC = () => {
  const { settings, updateSettings, refreshDependencies, addToast, paths } = useAppStore();
  const [activeTab, setActiveTab] = useState<
    "general" | "downloads"| "advanced"
  >("general");

  const [verifying, setVerifying] = useState(false);

 

  const handleBrowseFolder = async () => {
    try {
      const tauri = (window as any).__TAURI__;
      if (!tauri?.dialog) return;
      const selected = await tauri.dialog.open({
        directory: true,
        multiple: false,
        title: "Select Download Folder",
      });
      if (selected && typeof selected === "string") {
        updateSettings({ downloads: { ...settings.downloads, defaultFolder: selected } });
      }
    } catch {
      addToast({ title: "Folder Picker Error", message: "Could not open folder picker.", type: "warning" });
    }
  };



  const tabs: Array<{
    id: typeof activeTab;
    label: string;
    icon: React.ReactNode;
  }> = [
    { id: "general", label: "General", icon: <Settings className="w-3.5 h-3.5" /> },
    { id: "downloads", label: "Downloads", icon: <Sliders className="w-3.5 h-3.5" /> },
    { id: "advanced", label: "Network & Auth", icon: <Globe className="w-3.5 h-3.5" /> },
  ];

  return (
    <div id="settings-page" className="p-6 space-y-6 select-none max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
        <div>
          <h1 className="text-lg font-bold text-neutral-100 flex items-center space-x-2">
            <Settings className="w-5 h-5 text-emerald-400" />
            <span>Preferences & Engine Configuration</span>
          </h1>
          <p className="text-xs text-neutral-400 mt-0.5">
            Configure download directories, concurrency, and authentication cookies.
          </p>
        </div>
      </div>

      {/* Settings Navigation Tabs */}
      <div className="flex items-center space-x-1 border-b border-neutral-800 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center space-x-2 py-2 px-3.5 rounded text-xs font-medium transition-all shrink-0 ${
              activeTab === t.id
                ? "bg-neutral-800 text-neutral-100 font-semibold"
                : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900"
            }`}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      {activeTab === "general" && (
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-neutral-900 border border-neutral-800 space-y-4">
            <h3 className="text-xs font-semibold uppercase text-neutral-300 font-mono tracking-wider">
              Application Behavior
            </h3>

            {/* Default Folder */}
            <div>
              <label className="text-xs text-neutral-400 block mb-1">
                Default Download Directory:
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={settings.downloads.defaultFolder}
                  onChange={(e) =>
                    updateSettings({
                      downloads: { ...settings.downloads, defaultFolder: e.target.value },
                    })
                  }
                  className="flex-1 bg-neutral-950 border border-neutral-800 rounded px-3 py-2 text-xs text-neutral-200 font-mono focus:outline-none focus:border-emerald-500"
                />
                <button
                  onClick={handleBrowseFolder}
                  className="px-3 py-2 rounded bg-neutral-800 hover:bg-neutral-700 text-xs text-neutral-200 border border-neutral-700 flex items-center space-x-1.5"
                  title="Browse for folder"
                >
                  <Folder className="w-3.5 h-3.5" />
                  <span>Browse</span>
                </button>
              </div>

              {/* Recent / Favorite Folders */}
              {paths.favoriteFolders.length > 0 && (
                <div className="mt-2">
                  <span className="text-[10px] text-neutral-500 uppercase font-mono tracking-wider block mb-1.5">Recent Folders</span>
                  <div className="flex flex-wrap gap-1.5">
                    {paths.favoriteFolders.map((folder) => (
                      <button
                        key={folder}
                        onClick={() =>
                          updateSettings({ downloads: { ...settings.downloads, defaultFolder: folder } })
                        }
                        className={`px-2 py-1 rounded text-[10px] font-mono border transition-all truncate max-w-xs ${
                          settings.downloads.defaultFolder === folder
                            ? "bg-emerald-900/40 border-emerald-700 text-emerald-300"
                            : "bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-neutral-200"
                        }`}
                        title={folder}
                      >
                        {folder}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Clipboard Monitoring */}
            <div className="pt-2 border-t border-neutral-800">
              <label className="flex items-start space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.general.clipboardMonitoring}
                  onChange={(e) =>
                    updateSettings({
                      general: { ...settings.general, clipboardMonitoring: e.target.checked },
                    })
                  }
                  className="mt-0.5 rounded border-neutral-700 bg-neutral-950 text-emerald-600 focus:ring-0"
                />
                <div>
                  <span className="text-xs font-semibold text-neutral-200 block">
                    Monitor Clipboard for Supported URLs
                  </span>
                  <p className="text-[11px] text-neutral-400 leading-snug">
                    When you copy a YouTube, SoundCloud, or media URL in your browser, DropDL will prompt you to analyze it immediately.
                  </p>
                </div>
              </label>
            </div>

            {/* Notifications */}
            <div className="pt-2 border-t border-neutral-800">
              <label className="flex items-start space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.general.notifications}
                  onChange={(e) =>
                    updateSettings({
                      general: { ...settings.general, notifications: e.target.checked },
                    })
                  }
                  className="mt-0.5 rounded border-neutral-700 bg-neutral-950 text-emerald-600 focus:ring-0"
                />
                <div>
                  <span className="text-xs font-semibold text-neutral-200 block">
                    Desktop System Notifications
                  </span>
                  <p className="text-[11px] text-neutral-400 leading-snug">
                    Display native OS desktop notifications when downloads finish or encounter critical errors.
                  </p>
                </div>
              </label>
            </div>
          </div>
        </div>
      )}

      {activeTab === "downloads" && (
        <div className="space-y-4">
          {/* Download Folder */}
          <div className="p-4 rounded-lg bg-neutral-900 border border-neutral-800 space-y-3">
            <h3 className="text-xs font-semibold uppercase text-neutral-300 font-mono tracking-wider">
              Download Location
            </h3>
            <div>
              <label className="text-xs text-neutral-400 block mb-1">
                Default Download Folder:
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={settings.downloads.defaultFolder}
                  onChange={(e) =>
                    updateSettings({
                      downloads: { ...settings.downloads, defaultFolder: e.target.value },
                    })
                  }
                  placeholder="e.g. C:\Users\YourName\Downloads\DropDL"
                  className="flex-1 bg-neutral-950 border border-neutral-800 rounded px-3 py-2 text-xs text-neutral-200 font-mono focus:outline-none focus:border-emerald-500"
                />
                <button
                  onClick={handleBrowseFolder}
                  className="px-3 py-2 rounded bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-300 text-xs font-medium flex items-center space-x-1.5 transition-colors shrink-0"
                  title="Browse for folder"
                >
                  <Folder className="w-3.5 h-3.5" />
                  <span>Browse</span>
                </button>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-neutral-900 border border-neutral-800 space-y-4">
            <h3 className="text-xs font-semibold uppercase text-neutral-300 font-mono tracking-wider">
              Download Queue &amp; Network Bandwidth
            </h3>

            {/* Max Concurrent */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-neutral-400 block mb-1">
                  Concurrent Downloads Limit:
                </label>
                <select
                  value={settings.downloads.maxConcurrent}
                  onChange={(e) =>
                    updateSettings({
                      downloads: {
                        ...settings.downloads,
                        maxConcurrent: parseInt(e.target.value, 10),
                      },
                    })
                  }
                  className="w-full bg-neutral-950 border border-neutral-800 rounded px-2.5 py-1.5 text-xs text-neutral-200 font-mono"
                >
                  {[1, 2, 3, 4, 5, 8, 10].map((num) => (
                    <option key={num} value={num}>
                      {num} {num === 1 ? "task" : "concurrent tasks"}
                    </option>
                  ))}
                </select>
              </div>

              {/* Speed Limit */}
              <div>
                <label className="text-xs text-neutral-400 block mb-1">
                  Bandwidth Rate Limiting:
                </label>
                <select
                  value={settings.downloads.rateLimitKbps || 0}
                  onChange={(e) =>
                    updateSettings({
                      downloads: {
                        ...settings.downloads,
                        rateLimitKbps:
                          parseInt(e.target.value, 10) === 0
                            ? null
                            : parseInt(e.target.value, 10),
                      },
                    })
                  }
                  className="w-full bg-neutral-950 border border-neutral-800 rounded px-2.5 py-1.5 text-xs text-neutral-200 font-mono"
                >
                  <option value={0}>Unlimited Speed</option>
                  <option value={512}>512 KB/s</option>
                  <option value={1024}>1.0 MB/s</option>
                  <option value={2048}>2.0 MB/s</option>
                  <option value={5120}>5.0 MB/s</option>
                  <option value={10240}>10.0 MB/s</option>
                </select>
              </div>
            </div>

            {/* Overwrite mode */}
            <div className="pt-2 border-t border-neutral-800">
              <label className="text-xs text-neutral-400 block mb-1">
                Existing File Conflict Handling:
              </label>
              <div className="flex space-x-3 text-xs">
                {(["overwrite", "skip", "resume"] as const).map((mode) => (
                  <label key={mode} className="flex items-center space-x-1.5 cursor-pointer text-neutral-300">
                    <input
                      type="radio"
                      name="overwriteMode"
                      checked={settings.downloads.overwriteMode === mode}
                      onChange={() =>
                        updateSettings({
                          downloads: { ...settings.downloads, overwriteMode: mode },
                        })
                      }
                      className="text-emerald-600 bg-neutral-950 border-neutral-700"
                    />
                    <span className="capitalize">{mode} existing</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "advanced" && (
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-neutral-900 border border-neutral-800 space-y-4">
            <h3 className="text-xs font-semibold uppercase text-neutral-300 font-mono tracking-wider flex items-center space-x-1.5">
              <Globe className="w-3.5 h-3.5 text-emerald-400" />
              <span>Network Proxy & Authentication Cookies</span>
            </h3>

            {/* Cookies Source */}
            <div>
              <label className="text-xs text-neutral-400 block mb-1">
                Browser Cookies Extraction (--cookies-from-browser):
              </label>
              <div className="flex items-center space-x-2">
                <select
                  value={settings.advanced.cookiesSource || "none"}
                  onChange={(e) =>
                    updateSettings({
                      advanced: {
                        ...settings.advanced,
                        cookiesSource:
                          e.target.value === "none" ? null : e.target.value,
                      },
                    })
                  }
                  className="bg-neutral-950 border border-neutral-800 rounded px-2.5 py-1.5 text-xs text-neutral-200 font-mono focus:outline-none"
                >
                  <option value="none">Disabled (No cookies passed)</option>
                  <option value="chrome">Google Chrome</option>
                  <option value="firefox">Mozilla Firefox</option>
                  <option value="edge">Microsoft Edge</option>
                  <option value="safari">Apple Safari</option>
                  <option value="brave">Brave Browser</option>
                  <option value="file">Custom cookies.txt file...</option>
                </select>
              </div>
              <p className="text-[11px] text-neutral-400 mt-1">
                Allows downloading age-restricted videos, private member videos, and bypassing bot verification prompts.
              </p>
            </div>

            {/* Proxy */}
            <div className="pt-2 border-t border-neutral-800">
              <label className="text-xs text-neutral-400 block mb-1">
                Network Proxy (--proxy):
              </label>
              <input
                type="text"
                value={settings.advanced.proxy}
                onChange={(e) =>
                  updateSettings({
                    advanced: { ...settings.advanced, proxy: e.target.value },
                  })
                }
                placeholder="e.g. socks5://127.0.0.1:9050 or http://proxy.local:8080"
                className="w-full bg-neutral-950 border border-neutral-800 rounded px-3 py-2 text-xs text-neutral-200 font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Geo Bypass */}
            <div className="pt-2 border-t border-neutral-800">
              <label className="flex items-start space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.advanced.geoBypass}
                  onChange={(e) =>
                    updateSettings({
                      advanced: { ...settings.advanced, geoBypass: e.target.checked },
                    })
                  }
                  className="mt-0.5 rounded border-neutral-700 bg-neutral-950 text-emerald-600 focus:ring-0"
                />
                <div>
                  <span className="text-xs font-semibold text-neutral-200 block">
                    Geographic Restriction Bypass (--geo-bypass)
                  </span>
                  <p className="text-[11px] text-neutral-400 leading-snug">
                    Bypasses geographic video restrictions by spoofing X-Forwarded-For HTTP headers.
                  </p>
                </div>
              </label>
            </div>

            {/* Verbose Logs */}
            <div className="pt-2 border-t border-neutral-800">
              <label className="flex items-start space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.advanced.verboseLogs}
                  onChange={(e) =>
                    updateSettings({
                      advanced: { ...settings.advanced, verboseLogs: e.target.checked },
                    })
                  }
                  className="mt-0.5 rounded border-neutral-700 bg-neutral-950 text-emerald-600 focus:ring-0"
                />
                <div>
                  <span className="text-xs font-semibold text-neutral-200 block">
                    Enable Verbose Debug Output (--verbose)
                  </span>
                  <p className="text-[11px] text-neutral-400 leading-snug">
                    Captures full HTTP headers and extractor tracebacks into the Log Viewer for diagnosing extraction issues.
                  </p>
                </div>
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
