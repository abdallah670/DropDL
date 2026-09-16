import { create } from "zustand";
import {
  YtDlpMediaInfo,
  YtDlpFormat,
  DownloadTask,
  AppSettings,
  DependencyStatus,
  LogEntry,
  PlaylistInfo,
  NavTab,
} from "../types/ytdlp";
import { tauriService, ErrorTranslation } from "../services/tauriService";
import {
  loadPersistedState,
  savePersistedState,
  addFavoriteFolder,
  DEFAULT_PATHS,
  PersistedPaths,
} from "../services/persistenceService";

export type { NavTab };

/**
 * Task ids the user manually paused. Progress events for these tasks are
 * ignored (stale/buffered yt-dlp lines must not flip a paused task back to
 * "downloading"); cleared on resume/cancel/remove.
 */
const manuallyPaused = new Set<string>();

export interface SubtitleSettings {
  selectedLangs: string[];
  autoSubs: boolean;
  embedSubs: boolean;
  downloadSubFiles: boolean;
  format: "VTT" | "SRT" | "ASS";
}

export interface MetadataSettings {
  embedMetadata: boolean;
  embedThumbnail: boolean;
  writeDescription: boolean;
  writeInfoJson: boolean;
  writeThumbnailFile: boolean;
  writeComments: boolean;
  writeChapters: boolean;
}

interface AppStore {
  // Navigation
  activeNav: NavTab;
  setActiveNav: (tab: NavTab) => void;

  // Analysis / Download Page State
  inputUrl: string;
  setInputUrl: (url: string) => void;
  isAnalyzing: boolean;
  mediaInfo: YtDlpMediaInfo | null;
  activeMediaTab: "simple" | "formats" | "subtitles" | "metadata" | "command";
  setActiveMediaTab: (tab: "simple" | "formats" | "subtitles" | "metadata" | "command") => void;

  // Simple Mode Configuration
  simpleQuality: "best" | "2160p" | "1440p" | "1080p" | "720p" | "480p";
  setSimpleQuality: (q: "best" | "2160p" | "1440p" | "1080p" | "720p" | "480p") => void;
  mediaMode: "video-audio" | "audio-only" | "video-only";
  setMediaMode: (mode: "video-audio" | "audio-only" | "video-only") => void;
  outputContainer: "MP4" | "MKV" | "WebM" | "Original";
  setOutputContainer: (c: "MP4" | "MKV" | "WebM" | "Original") => void;
  audioExtractionFormat: "MP3" | "M4A" | "OPUS" | "FLAC" | "WAV";
  setAudioExtractionFormat: (f: "MP3" | "M4A" | "OPUS" | "FLAC" | "WAV") => void;
  audioQuality: "best" | "320" | "256" | "192" | "128";
  setAudioQuality: (q: "best" | "320" | "256" | "192" | "128") => void;

  // Advanced Formats Selection
  selectedVideoFormatId: string | null;
  setSelectedVideoFormatId: (id: string | null) => void;
  selectedAudioFormatId: string | null;
  setSelectedAudioFormatId: (id: string | null) => void;
  inspectingFormat: YtDlpFormat | null;
  setInspectingFormat: (fmt: YtDlpFormat | null) => void;
  comparedFormatIds: string[];
  toggleCompareFormat: (id: string) => void;
  clearComparedFormats: () => void;
  customSelectorFormula: string;
  setCustomSelectorFormula: (f: string) => void;

  // Subtitles & Metadata Options
  subtitlesConfig: SubtitleSettings;
  updateSubtitlesConfig: (partial: Partial<SubtitleSettings>) => void;
  metadataConfig: MetadataSettings;
  updateMetadataConfig: (partial: Partial<MetadataSettings>) => void;

  // Playlist Mode
  playlist: PlaylistInfo | null;
  selectedPlaylistIndices: number[];
  setPlaylist: (p: PlaylistInfo | null) => void;
  togglePlaylistVideo: (id: string) => void;
  togglePlaylistIndex: (index: number) => void;
  selectAllPlaylistVideos: (selected: boolean) => void;
  selectAllPlaylist: () => void;
  clearAllPlaylist: () => void;
  invertPlaylistSelection: () => void;
  selectPlaylistRange: (startIdx: number, endIdx: number) => void;
  enqueuePlaylistSelected: () => void;

  // Queue & History
  queue: DownloadTask[];
  history: DownloadTask[];
  logs: LogEntry[];
  clearHistory: () => void;
  removeHistoryItem: (id: string) => void;
  enqueueTask: (task: DownloadTask) => void;
  maybeStartNextQueued: () => void;
  clearLogs: () => void;
  addToast: (toast: { title: string; message?: string; body?: string; type?: "info" | "success" | "warning" }) => void;

  // Environment & Settings
  dependencies: DependencyStatus[];
  settings: AppSettings;
  updateSettings: (
    updater:
      | ((prev: AppSettings) => AppSettings)
      | Partial<{ [K in keyof AppSettings]?: Partial<AppSettings[K]> }>
  ) => void;

  // Modals & Popovers
  isFirstRun: boolean;
  setIsFirstRun: (v: boolean) => void;
  showDependencyModal: boolean;
  setShowDependencyModal: (v: boolean) => void;
  showShortcutsModal: boolean;
  setShowShortcutsModal: (v: boolean) => void;
  showTrayMenu: boolean;
  setShowTrayMenu: (v: boolean) => void;
  activeErrorModal: ErrorTranslation | null;
  setActiveErrorModal: (e: ErrorTranslation | null) => void;

  // Desktop Notifications & Clipboard
  activeNotification: { title: string; body: string; type?: "info" | "success" | "warning" } | null;
  showNotification: (title: string, body: string, type?: "info" | "success" | "warning") => void;
  dismissNotification: () => void;
  detectedClipboardUrl: string | null;
  setDetectedClipboardUrl: (url: string | null) => void;

  // Core Actions
  analyzeUrl: (urlToAnalyze?: string) => Promise<void>;
  enqueueCurrentDownload: () => void;
  enqueuePlaylistItems: (overrides?: {
    mediaMode?: "video" | "audio";
    quality?: string; // "best" | "1080p" | "720p" | "480p" (video) or "best" | "320" | "128" (audio)
    container?: string; // mp4 | webm | mkv (video) or mp3 | m4a | opus (audio)
    numberedPrefix?: boolean; // prefix filenames with the playlist index
  }) => void;
  pauseTask: (id: string) => void;
  resumeTask: (id: string) => void;
  cancelTask: (id: string) => void;
  cancelAll: () => void;
  removeTask: (id: string) => void;
  retryTask: (id: string) => void;
  retryAll: () => void;
  clearCompleted: () => void;
  pauseAll: () => void;
  resumeAll: () => void;
  addLog: (level: LogEntry["level"], text: string, taskId?: string) => void;
  refreshDependencies: () => Promise<void>;

  // Persistence
  paths: PersistedPaths;
  hasLoadedData: boolean;
  loadPersistedData: () => Promise<void>;
  persistNow: () => Promise<void>;
}

const DEFAULT_SETTINGS: AppSettings = {
  general: {
    language: "en-US",
    theme: "dark",
    startMinimized: false,
    clipboardMonitoring: true,
    showNotifications: true,
    playNotificationSound: true,
  },
  downloads: {
    defaultFolder: "~/Downloads",
    concurrentDownloads: 3,
    retries: 5,
    rateLimitKbps: 0,
    overwriteBehavior: "auto-rename",
  },
  ytdlp: {
    executablePath: "",
    detectedVersion: "Not detected",
    lastChecked: "",
    customArgs: "",
  },
  ffmpeg: {
    ffmpegPath: "",
    ffprobePath: "",
    detectedVersion: "Not detected",
    isAvailable: false,
  },
  advanced: {
    proxy: "",
    cookiesSource: "none",
    networkTimeoutSecs: 30,
    expertMode: false,
    verboseLogs: true,
  },
};

export const useAppStore = create<AppStore>((set, get) => ({
  activeNav: "download",
  setActiveNav: (tab) => set({ activeNav: tab }),

  inputUrl: "",
  setInputUrl: (url) => set({ inputUrl: url }),
  isAnalyzing: false,
  mediaInfo: null,
  activeMediaTab: "simple",
  setActiveMediaTab: (tab) => set({ activeMediaTab: tab }),

  simpleQuality: "1080p",
  setSimpleQuality: (q) => set({ simpleQuality: q }),
  mediaMode: "video-audio",
  setMediaMode: (m) => set({ mediaMode: m }),
  outputContainer: "MP4",
  setOutputContainer: (c) => set({ outputContainer: c }),
  audioExtractionFormat: "MP3",
  setAudioExtractionFormat: (f) => set({ audioExtractionFormat: f }),
  audioQuality: "320",
  setAudioQuality: (q) => set({ audioQuality: q }),

  selectedVideoFormatId: null,
  setSelectedVideoFormatId: (id) => set({ selectedVideoFormatId: id }),
  selectedAudioFormatId: null,
  setSelectedAudioFormatId: (id) => set({ selectedAudioFormatId: id }),
  inspectingFormat: null,
  setInspectingFormat: (fmt) => set({ inspectingFormat: fmt }),
  comparedFormatIds: [],
  toggleCompareFormat: (id) =>
    set((state) => {
      const exists = state.comparedFormatIds.includes(id);
      return {
        comparedFormatIds: exists
          ? state.comparedFormatIds.filter((x) => x !== id)
          : [...state.comparedFormatIds, id].slice(-4), // max 4 compare columns
      };
    }),
  clearComparedFormats: () => set({ comparedFormatIds: [] }),
  customSelectorFormula: "bv*[height<=1080]+ba/b",
  setCustomSelectorFormula: (f) => set({ customSelectorFormula: f }),

  subtitlesConfig: {
    selectedLangs: ["en"],
    autoSubs: false,
    embedSubs: true,
    downloadSubFiles: false,
    format: "VTT",
  },
  updateSubtitlesConfig: (partial) =>
    set((state) => ({ subtitlesConfig: { ...state.subtitlesConfig, ...partial } })),

  metadataConfig: {
    embedMetadata: true,
    embedThumbnail: true,
    writeDescription: false,
    writeInfoJson: false,
    writeThumbnailFile: false,
    writeComments: false,
    writeChapters: true,
  },
  updateMetadataConfig: (partial) =>
    set((state) => ({ metadataConfig: { ...state.metadataConfig, ...partial } })),

  playlist: null,
  selectedPlaylistIndices: [],
  setPlaylist: (p) => set({ playlist: p }),
  togglePlaylistVideo: (id) =>
    set((state) => {
      if (!state.playlist) return {};
      return {
        playlist: {
          ...state.playlist,
          entries: state.playlist.entries.map((item) =>
            item.id === id ? { ...item, selected: !item.selected } : item
          ),
        },
      };
    }),
  togglePlaylistIndex: (index) =>
    set((state) => {
      const exists = state.selectedPlaylistIndices.includes(index);
      return {
        selectedPlaylistIndices: exists
          ? state.selectedPlaylistIndices.filter((i) => i !== index)
          : [...state.selectedPlaylistIndices, index],
      };
    }),
  selectAllPlaylistVideos: (selected) =>
    set((state) => {
      if (!state.playlist) return {};
      return {
        playlist: {
          ...state.playlist,
          entries: state.playlist.entries.map((item) => ({ ...item, selected })),
        },
      };
    }),
  selectAllPlaylist: () =>
    set((state) => ({
      selectedPlaylistIndices: state.playlist?.entries.map((e) => e.index) || [],
    })),
  clearAllPlaylist: () =>
    set({ selectedPlaylistIndices: [] }),
  invertPlaylistSelection: () =>
    set((state) => {
      const all = state.playlist?.entries.map((e) => e.index) || [];
      return {
        selectedPlaylistIndices: all.filter(
          (i) => !state.selectedPlaylistIndices.includes(i)
        ),
      };
    }),
  selectPlaylistRange: (startIdx, endIdx) =>
    set((state) => {
      if (!state.playlist) return {};
      return {
        playlist: {
          ...state.playlist,
          entries: state.playlist.entries.map((item) => ({
            ...item,
            selected: item.index >= startIdx && item.index <= endIdx,
          })),
        },
      };
    }),
  enqueuePlaylistSelected: () => {
    get().enqueuePlaylistItems();
  },

  clearHistory: () => {
    set({ history: [] });
    get().persistNow();
  },
  removeHistoryItem: (id) => {
    set((state) => ({ history: state.history.filter((h) => h.id !== id) }));
    // Persist immediately so the deletion is durable even if hasLoadedData
    // or other effects race with it.
    get().persistNow();
  },
  enqueueTask: (task) =>
    set((state) => ({ queue: [task, ...state.queue] })),
  clearLogs: () => set({ logs: [] }),
  addToast: (toast) => {
    get().showNotification(toast.title, toast.message || toast.body || "", toast.type || "info");
  },

  queue: [],
  history: [],
  logs: [
    {
      id: "log-1",
      timestamp: new Date().toLocaleTimeString(),
      level: "info",
      text: "DropDL v1.0.0 desktop runtime booted successfully.",
    },
  ],
  dependencies: [],

  settings: DEFAULT_SETTINGS,
  updateSettings: (updater) =>
    set((state) => {
      if (typeof updater === "function") {
        const next = updater(state.settings);
        return { settings: next };
      }
      const u = updater as any;
      const nextSettings = {
        ...state.settings,
        ...u,
        general: { ...state.settings.general, ...(u.general || {}) },
        downloads: { ...state.settings.downloads, ...(u.downloads || {}) },
        ytdlp: { ...state.settings.ytdlp, ...(u.ytdlp || {}) },
        ffmpeg: { ...state.settings.ffmpeg, ...(u.ffmpeg || {}) },
        advanced: { ...state.settings.advanced, ...(u.advanced || {}) },
      };
      // If download folder changed, update paths tracker
      const newFolder = u.downloads?.defaultFolder;
      if (newFolder && newFolder !== state.settings.downloads.defaultFolder) {
        const favs = [newFolder, ...state.paths.favoriteFolders.filter((f) => f !== newFolder)].slice(0, 10);
        return {
          settings: nextSettings,
          paths: { lastDownloadFolder: newFolder, favoriteFolders: favs },
        };
      }
      return { settings: nextSettings };
    }),

  isFirstRun: false,
  setIsFirstRun: (v) => set({ isFirstRun: v }),
  showDependencyModal: false,
  setShowDependencyModal: (v) => set({ showDependencyModal: v }),
  showShortcutsModal: false,
  setShowShortcutsModal: (v) => set({ showShortcutsModal: v }),
  showTrayMenu: false,
  setShowTrayMenu: (v) => set({ showTrayMenu: v }),
  activeErrorModal: null,
  setActiveErrorModal: (e) => set({ activeErrorModal: e }),

  activeNotification: null,
  showNotification: (title, body, type = "info") => {
    set({ activeNotification: { title, body, type } });
    setTimeout(() => {
      if (get().activeNotification?.title === title) {
        set({ activeNotification: null });
      }
    }, 4500);
  },
  dismissNotification: () => set({ activeNotification: null }),
  detectedClipboardUrl: null,
  setDetectedClipboardUrl: (url) => set({ detectedClipboardUrl: url }),

  // Actions
  analyzeUrl: async (targetUrl) => {
    const url = targetUrl || get().inputUrl;
    if (!url.trim()) return;

    set({ isAnalyzing: true });
    get().addLog("info", `[yt-dlp] Analyzing media stream manifest for: ${url}`);

    try {
      const result = await tauriService.analyzeUrl(url);
      if (result.playlist) {
        set({ playlist: result.playlist, activeNav: "playlist" });
        get().addLog("info", `[yt-dlp] Playlist manifest resolved with ${result.playlist.entries.length} items`);
        get().showNotification("Playlist Detected", `Found ${result.playlist.video_count} videos in playlist: ${result.playlist.title}`);
      }
      if (result.media) {
        // Set default format selections based on returned formats
        const videoFormats = result.media.formats.filter((f) => f.vcodec && f.vcodec !== "none");
        const audioFormats = result.media.formats.filter((f) => f.acodec && f.acodec !== "none");

        const bestVideo = videoFormats.find((f) => f.height === 1080) || videoFormats[0];
        const bestAudio = audioFormats[0];

        set({
          mediaInfo: result.media,
          inputUrl: url,
          selectedVideoFormatId: bestVideo?.format_id || null,
          selectedAudioFormatId: bestAudio?.format_id || null,
          comparedFormatIds: result.media.formats.slice(0, 3).map((f) => f.format_id),
        });

        get().addLog("stdout", `[yt-dlp] Extracted ${result.media.formats.length} formats for "${result.media.title}"`);
        get().showNotification("Media Analyzed", `${result.media.formats.length} formats available for ${result.media.title.substring(0, 45)}...`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      get().addLog("error", `[yt-dlp] Analysis failed: ${msg}`);
      const translation = tauriService.translateError(msg);
      set({ activeErrorModal: translation });
    } finally {
      set({ isAnalyzing: false });
    }
  },

  enqueueCurrentDownload: () => {
    const {
      mediaInfo,
      mediaMode,
      simpleQuality,
      selectedVideoFormatId,
      selectedAudioFormatId,
      outputContainer,
      audioExtractionFormat,
      audioQuality,
      settings,
      activeMediaTab,
      customSelectorFormula,
    } = get();

    if (!mediaInfo) return;

    let formatSelector = "bv*+ba/b";
    let resLabel = "Best Quality";
    const mediaType: "video" | "audio" = mediaMode === "audio-only" ? "audio" : "video";

    if (activeMediaTab === "formats") {
      if (selectedVideoFormatId && selectedAudioFormatId) {
        formatSelector = `${selectedVideoFormatId}+${selectedAudioFormatId}`;
        resLabel = `Manual [${selectedVideoFormatId}+${selectedAudioFormatId}]`;
      } else if (selectedVideoFormatId) {
        formatSelector = selectedVideoFormatId;
        resLabel = `Video Only [${selectedVideoFormatId}]`;
      } else if (selectedAudioFormatId) {
        formatSelector = selectedAudioFormatId;
        resLabel = `Audio Only [${selectedAudioFormatId}]`;
      }
    } else {
      if (mediaMode === "audio-only") {
        formatSelector = "ba/b";
        resLabel = `Audio ${audioExtractionFormat} (${audioQuality === "best" ? "Best VBR" : audioQuality + " kbps"})`;
      } else if (mediaMode === "video-only") {
        if (simpleQuality === "best") {
          formatSelector = "bv*";
          resLabel = "Best Video Stream (No Audio)";
        } else {
          const h = simpleQuality.replace("p", "");
          formatSelector = `bv*[height<=${h}]`;
          resLabel = `${simpleQuality} Video (No Audio)`;
        }
      } else {
        // Video + Audio
        if (simpleQuality === "best") {
          formatSelector = "bv*+ba/b";
          resLabel = "Best Video + Audio";
        } else {
          const h = simpleQuality.replace("p", "");
          formatSelector = `bv*[height<=${h}]+ba/b`;
          resLabel = `${simpleQuality} + Best Audio`;
        }
      }
    }

    const taskId = "task-" + Date.now();
    const newTask: DownloadTask = {
      id: taskId,
      url: mediaInfo.webpage_url,
      title: mediaInfo.title,
      thumbnail: mediaInfo.thumbnail,
      mediaType,
      resolutionLabel: resLabel,
      formatSelector,
      container: mediaMode === "audio-only" ? audioExtractionFormat : outputContainer,
      destinationPath: settings.downloads.defaultFolder,
      status: "queued",
      progress: 0,
      downloadedBytes: 0,
      totalBytes: 0,
      speed: 0,
      etaSeconds: 0,
      logs: [`[${new Date().toLocaleTimeString()}] Task queued by user`],
      createdAt: Date.now(),
    };

    set((state) => ({
      queue: [newTask, ...state.queue],
      activeNav: "queue",
    }));

    get().showNotification("Download Queued", `"${mediaInfo.title.substring(0, 38)}..." added to queue`);
    get().addLog("info", `Queued download task: ${newTask.title}`);
    // Durably persist the new queued task (crash/restart safe)
    get().persistNow();

    // Respect the concurrentDownloads limit: only start if there's a free slot,
    // otherwise the task waits in the queue until another finishes.
    get().maybeStartNextQueued();
  },

  enqueuePlaylistItems: (overrides) => {
    const {
      playlist,
      settings,
      selectedPlaylistIndices,
      mediaMode,
      simpleQuality,
      audioQuality,
      audioExtractionFormat,
      outputContainer,
    } = get();
    if (!playlist) return;

    // The UI (checkboxes / Select All / range input) tracks the selection in
    // selectedPlaylistIndices — entry.selected is a legacy flag the toggles
    // never write, so filtering on it used to enqueue EVERY video regardless
    // of what the user picked.
    const selectedSet = new Set(selectedPlaylistIndices);
    const selectedEntries = playlist.entries.filter((e) => selectedSet.has(e.index));
    if (selectedEntries.length === 0) return;

    // Batch options chosen on the Playlist page take priority; fall back to
    // the current Download page selection otherwise.
    const batchMediaMode = overrides?.mediaMode ?? (mediaMode === "audio-only" ? "audio" : "video");
    const batchQuality = overrides?.quality ?? simpleQuality;
    const batchContainer = overrides?.container ?? (batchMediaMode === "audio" ? audioExtractionFormat : outputContainer);

    // Playlist items inherit the current format selection; otherwise the
    // container / audio-format choice would be ignored for batch downloads.
    const mediaType: "video" | "audio" = batchMediaMode === "audio" ? "audio" : "video";
    let formatSelector = "bv*+ba/b";
    let resolutionLabel = "Best Video + Audio";
    if (batchMediaMode === "audio") {
      formatSelector = "ba/b";
      resolutionLabel = `Audio ${batchContainer} (${audioQuality === "best" ? "Best VBR" : audioQuality + " kbps"})`;
    } else if (batchQuality !== "best") {
      formatSelector = `bv*[height<=${batchQuality.replace("p", "")}]+ba/b`;
      resolutionLabel = `${batchQuality} + Best Audio`;
    }
    const container = batchContainer;

    const numberedPrefix = overrides?.numberedPrefix ?? false;

    const newTasks: DownloadTask[] = selectedEntries.map((entry, idx) => ({
      id: "pl-task-" + Date.now() + "-" + idx,
      url: entry.url,
      title: entry.title,
      thumbnail: entry.thumbnail,
      mediaType,
      resolutionLabel,
      formatSelector,
      container,
      // Optional numbered filenames (01 - Title.mp4) using the playlist index.
      // The template is relative so the -P destination folder still applies.
      ...(numberedPrefix
        ? { outputTemplate: `${String(entry.index).padStart(2, "0")} - %(title)s.%(ext)s` }
        : {}),
      // Sanitize for a valid folder name while PRESERVING non-Latin scripts
      // (Arabic, Chinese, ...): only strip characters Windows forbids in
      // filenames, not every non-ASCII character.
      destinationPath: `${settings.downloads.defaultFolder}/${playlist.title
        .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
        .replace(/^\.+/, "")
        .trim()
        .slice(0, 100) || "Playlist"}`,
      status: "queued",
      progress: 0,
      downloadedBytes: 0,
      // Unknown until yt-dlp reports it; a fake 75 MB placeholder would show
      // bogus sizes in the queue UI.
      totalBytes: 0,
      speed: 0,
      etaSeconds: 0,
      logs: [`[${new Date().toLocaleTimeString()}] Playlist item added to batch`],
      createdAt: Date.now() + idx,
    }));

    set((state) => ({
      queue: [...newTasks, ...state.queue],
      activeNav: "queue",
    }));

    get().showNotification("Playlist Enqueued", `Added ${selectedEntries.length} items from ${playlist.title}`);

    // Auto start respecting concurrency limit
    if (newTasks.length > 0) {
      get().maybeStartNextQueued();
      // Durably persist the batch (crash/restart safe)
      get().persistNow();
    }
  },

  pauseTask: (id) => {
    manuallyPaused.add(id);
    tauriService.pauseDownload(id);
    set((state) => ({
      queue: state.queue.map((t) =>
        t.id === id ? { ...t, status: "paused", speed: 0, etaSeconds: 0, postProcessingStep: undefined } : t
      ),
    }));
    // Persist the paused state so the task survives an app restart
    get().persistNow();
  },

  maybeStartNextQueued: () => {
    const { queue, settings } = get();
    const limit = Math.max(1, settings.downloads.concurrentDownloads || 3);
    const active = queue.filter(
      (t) =>
        t.status === "downloading" ||
        t.status === "processing" ||
        t.status === "merging" ||
        t.status === "analyzing"
    ).length;
    const slots = limit - active;
    if (slots <= 0) return;
    const next = queue.filter((t) => t.status === "queued").slice(0, slots);
    next.forEach((t) => get().resumeTask(t.id));
  },

  resumeTask: (id) => {
    const task = get().queue.find((t) => t.id === id);
    if (!task) return;

    manuallyPaused.delete(id);

    // Clear any stale phase note ("Part 2 of 2", "Merging...") left by a
    // previous run so resume starts with a clean status line.
    set((state) => ({
      queue: state.queue.map((t) =>
        t.id === id
          ? { ...t, status: "downloading" as const, speed: 0, etaSeconds: 0, postProcessingStep: undefined }
          : t
      ),
    }));

    tauriService.startDownload(
      task,
      (updated) => {
        // Ignore stale/buffered events for a manually paused task — only an
        // explicit resume may flip it back to "downloading".
        if (manuallyPaused.has(id)) return;
        set((state) => ({
          queue: state.queue.map((t) => (t.id === id ? { ...t, ...updated } : t)),
        }));
      },
      (logLine) => {
        set((state) => ({
          queue: state.queue.map((t) =>
            t.id === id ? { ...t, logs: [...t.logs, logLine] } : t
          ),
        }));
        get().addLog("stdout", logLine, id);
      },
      (final) => {
        // Merge the final probed size / file path from the completion payload
        // (the Rust side probes the finished file with ffprobe before emitting
        // download-complete) so completed tasks show real bytes, not 0 B.
        const finalUpdate: Partial<DownloadTask> = { status: "completed" as const, progress: 100 };
        if (typeof final?.downloadedBytes === "number" && final.downloadedBytes > 0) {
          finalUpdate.downloadedBytes = final.downloadedBytes;
        }
        if (typeof final?.totalBytes === "number" && final.totalBytes > 0) {
          finalUpdate.totalBytes = final.totalBytes;
        }
        if (final?.filePath) {
          finalUpdate.filePath = final.filePath;
        }
        const completedTask = get().queue.find((t) => t.id === id);
        if (completedTask) {
          get().showNotification("Download Complete", `"${completedTask.title}" is ready.`);
          const finalTask: DownloadTask = {
            ...completedTask,
            ...finalUpdate,
            status: "completed",
            progress: 100,
            completedAt: Date.now(),
          };
          set((state) => ({
            queue: state.queue.map((t) => (t.id === id ? finalTask : t)),
            history: state.history.some((h) => h.id === id)
              ? state.history
              : [finalTask, ...state.history],
          }));
        }
        // A slot freed up — start the next queued task
        get().maybeStartNextQueued();
      },
      (err) => {
        get().addLog("error", `Task failed: ${err}`, id);
        set((state) => ({
          queue: state.queue.map((t) => (t.id === id ? { ...t, status: "failed" as const } : t)),
        }));
        get().maybeStartNextQueued();
      }
    );
  },

  cancelTask: (id) => {
    manuallyPaused.delete(id);
    tauriService.cancelDownload(id);
    set((state) => ({
      queue: state.queue.map((t) =>
        t.id === id
          ? { ...t, status: "cancelled", speed: 0, etaSeconds: 0, postProcessingStep: undefined }
          : t
      ),
    }));
  },

  removeTask: (id) => {
    manuallyPaused.delete(id);
    tauriService.cancelDownload(id);
    set((state) => ({
      queue: state.queue.filter((t) => t.id !== id),
    }));
    get().persistNow();
  },

  clearCompleted: () => {
    set((state) => ({
      queue: state.queue.filter((t) => t.status !== "completed" && t.status !== "cancelled"),
    }));
  },

  cancelAll: () => {
    // Cancel every active download (kills its yt-dlp process) and every
    // still-queued task in one go.
    get().queue.forEach((t) => {
      if (t.status !== "completed" && t.status !== "cancelled" && t.status !== "failed") {
        if (t.status !== "queued") {
          tauriService.cancelDownload(t.id);
        }
      }
    });
    set((state) => ({
      queue: state.queue.map((t) =>
        t.status !== "completed" && t.status !== "cancelled" && t.status !== "failed"
          ? { ...t, status: "cancelled" as const, speed: 0, etaSeconds: 0, postProcessingStep: undefined }
          : t
      ),
    }));
    // Free any concurrency slots the worker thinks are occupied.
    get().maybeStartNextQueued();
    get().persistNow();
  },

  retryTask: (id) => {
    const task = get().queue.find((t) => t.id === id);
    if (!task) return;
    // Never restart a task that is still alive.
    if (["downloading", "processing", "merging", "analyzing"].includes(task.status)) return;
    // Reset the counters for a clean progress bar; yt-dlp resumes from any
    // existing .part file so already-downloaded data is not fetched again.
    set((state) => ({
      queue: state.queue.map((t) =>
        t.id === id
          ? { ...t, status: "queued" as const, progress: 0, speed: 0, etaSeconds: 0, postProcessingStep: undefined }
          : t
      ),
    }));
    // Start immediately (bypasses the concurrency worker so an explicit retry
    // is never starved by other queued items).
    get().resumeTask(id);
    get().persistNow();
  },

  retryAll: () => {
    const retryable = get().queue.filter(
      (t) => t.status === "failed" || t.status === "cancelled"
    );
    if (retryable.length === 0) return;
    set((state) => ({
      queue: state.queue.map((t) =>
        t.status === "failed" || t.status === "cancelled"
          ? { ...t, status: "queued" as const, progress: 0, speed: 0, etaSeconds: 0, postProcessingStep: undefined }
          : t
      ),
    }));
    // Re-queue everything, then let the concurrency worker start up to N.
    get().maybeStartNextQueued();
    get().persistNow();
  },

  pauseAll: () => {
    get().queue.forEach((t) => {
      if (t.status === "downloading") {
        get().pauseTask(t.id);
      }
    });
  },

  resumeAll: () => {
    // Resume paused tasks directly; queued tasks go through the concurrency worker
    get().queue
      .filter((t) => t.status === "paused")
      .forEach((t) => get().resumeTask(t.id));
    get().maybeStartNextQueued();
  },

  addLog: (level, text, taskId) => {
    const newEntry: LogEntry = {
      id: "log-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
      timestamp: new Date().toLocaleTimeString(),
      level,
      text,
      taskId,
    };
    set((state) => ({
      logs: [...state.logs.slice(-200), newEntry],
    }));
  },

  refreshDependencies: async () => {
    const deps = await tauriService.checkDependencies();
    
    // Also sync the detected versions into settings for SettingsPage to display
    const ytDlpStatus = deps.find((d) => d.name === "yt-dlp");
    const ffmpegStatus = deps.find((d) => d.name.toLowerCase() === "ffmpeg");
    
    set((state) => ({
      dependencies: deps,
      settings: {
        ...state.settings,
        ytdlp: {
          ...state.settings.ytdlp,
          detectedVersion: ytDlpStatus?.version || "Not detected",
          // Write back what was actually probed so settings never show a
          // version with a blank path / stale lastChecked again.
          executablePath: ytDlpStatus?.installed ? ytDlpStatus.path || "" : "",
          lastChecked: new Date().toISOString(),
        },
        ffmpeg: {
          ...state.settings.ffmpeg,
          isAvailable: ffmpegStatus?.installed || false,
          detectedVersion: ffmpegStatus?.version || "Not found",
          ffmpegPath: ffmpegStatus?.installed ? ffmpegStatus.path || "" : "",
          // ffprobe ships in the same sidecar bundle as ffmpeg
          ffprobePath: ffmpegStatus?.installed ? ffmpegStatus.path || "" : "",
        },
      },
    }));
  },

  // Persistence
  paths: DEFAULT_PATHS,
  hasLoadedData: false,

  loadPersistedData: async () => {
    const saved = await loadPersistedState();
    if (!saved) {
      set({ hasLoadedData: true });
      return;
    }
    set((state) => ({
      settings: saved.settings ?? state.settings,
      history: saved.history ?? [],
      paths: saved.paths ?? DEFAULT_PATHS,
      // Restore the persisted queue. Live statuses were demoted to "paused" by
      // the migration, so the user can resume them (yt-dlp keeps .part files).
      queue: saved.queue ?? [],
      hasLoadedData: true,
    }));
    // Tasks that were still waiting in line before the app closed go back
    // through the concurrency worker, so a restored batch keeps downloading
    // without the user having to press Resume All.
    get().maybeStartNextQueued();
  },

  persistNow: async () => {
    const { settings, history, paths, queue, hasLoadedData } = get();
    if (!hasLoadedData) return; // Prevent overwriting on startup
    await savePersistedState({
      settings,
      history: history.slice(0, 200).map((h) => ({ ...h, logs: [] })), // cap at 200, strip logs
      paths,
      // Every non-terminal task is durable state. Live statuses (downloading,
      // processing, merging, analyzing) can't survive a restart, so they are
      // demoted to "paused" — the yt-dlp .part files let the user resume them
      // (Queue → Resume All) instead of silently losing the batch. Cancelled
      // tasks are kept too, so "Retry All" still works after a restart.
      queue: queue
        .filter((t) => t.status !== "completed")
        .slice(0, 200)
        .map((t) => ({
          ...t,
          logs: [],
          status:
            t.status === "queued" ||
            t.status === "paused" ||
            t.status === "failed" ||
            t.status === "cancelled"
              ? t.status
              : ("paused" as const),
        })),
    });
  },
}));
