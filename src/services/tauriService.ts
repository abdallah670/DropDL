import {
  YtDlpMediaInfo,
  YtDlpFormat,
  DownloadTask,
  DependencyStatus,
  AppSettings,
  PlaylistInfo,
} from "../types/ytdlp";

export interface CommandOptions {
  url: string;
  formatSelector: string;
  outputTemplate?: string;
  mergeOutputFormat?: string;
  embedThumbnail?: boolean;
  embedMetadata?: boolean;
  writeDescription?: boolean;
  writeInfoJson?: boolean;
  writeThumbnailFile?: boolean;
  writeComments?: boolean;
  embedChapters?: boolean;
  writeSubtitles?: boolean;
  writeAutoSubs?: boolean;
  embedSubtitles?: boolean;
  subLanguage?: string;
  subFormat?: string;
  extractAudio?: boolean;
  audioFormat?: string;
  audioQuality?: string;
  rateLimitKbps?: number;
  proxy?: string;
  cookiesSource?: string;
  customArgs?: string;
  destinationPath?: string;
}

export interface ErrorTranslation {
  title: string;
  message: string;
  actionLabel?: string;
  actionTarget?: "settings-cookies" | "settings-ytdlp" | "settings-network" | "url";
  rawError: string;
}

class TauriService {
  private activeIntervals: Map<string, any> = new Map();
  private activeUnlisteners: Map<string, Array<() => void>> = new Map();

  private removeListeners(taskId: string): void {
    const unlisteners = this.activeUnlisteners.get(taskId);
    if (unlisteners) {
      unlisteners.forEach((fn) => {
        try { fn(); } catch { /* already gone */ }
      });
      this.activeUnlisteners.delete(taskId);
    }
  }

  /**
   * Check if running inside native Tauri or Electron desktop environment
   */
  isNativeApp(): boolean {
    return (
      typeof window !== "undefined" &&
      Boolean((window as any).__TAURI__ || (window as any).electronAPI)
    );
  }

  /**
   * Check system dependencies (yt-dlp, ffmpeg, ffprobe)
   */
  async checkDependencies(): Promise<DependencyStatus[]> {
    if (this.isNativeApp() && (window as any).__TAURI__) {
      try {
        const nativeResults = await (window as any).__TAURI__.invoke("check_dependencies");
        if (Array.isArray(nativeResults) && nativeResults.length > 0) {
          return nativeResults;
        }
      } catch (err) {
        console.warn("Tauri check_dependencies error:", err);
      }
    }

    return [];
  }

  /**
   * Download a dependency via Rust backend
   */
  async downloadDependency(name: string): Promise<void> {
    if (this.isNativeApp() && (window as any).__TAURI__) {
      await (window as any).__TAURI__.invoke("download_dependency", { name });
    }
  }

  /**
   * Analyze media URL using native yt-dlp --dump-json or browser fallback
   */
  async analyzeUrl(url: string, network?: { proxy?: string; cookiesSource?: string | null; cookiesFilePath?: string }): Promise<{ media?: YtDlpMediaInfo; playlist?: PlaylistInfo }> {
    const cleanUrl = url.trim();

    if (this.isNativeApp() && (window as any).__TAURI__) {
      const result = await (window as any).__TAURI__.invoke("analyze_url", {
        url: cleanUrl,
        proxy: network?.proxy || null,
        cookiesSource: network?.cookiesSource || null,
        cookiesFile: network?.cookiesFilePath || null,
      });
      if (result) return result;
      throw new Error("Native yt-dlp analysis returned empty result");
    }

    throw new Error("DropDL must be run inside the Tauri desktop shell to analyze and download media.");
  }

  /**
   * Translates raw yt-dlp errors to user-friendly messages
   */
  translateError(raw: string): ErrorTranslation {
    const lower = raw.toLowerCase();

    // --- Cancelled by the user (not a failure) ---
    if (
      lower.includes("cancelled") ||
      lower.includes("canceled") ||
      lower.includes("killed") ||
      lower.includes("terminated by user")
    ) {
      return {
        title: "Download Cancelled",
        message: "You stopped this download. The partial file was kept so you can resume it later.",
        rawError: raw,
      };
    }

    // --- Invalid/unsupported option passed to the engine ---
    // Happens when a custom argument (or an option the installed yt-dlp build
    // no longer supports) is rejected before the download even starts.
    if (lower.includes("no such option") || lower.includes("unrecognized arguments")) {
      const flag = /no such option:\s*(\S+)/i.exec(raw)?.[1] ?? "that argument";
      return {
        title: "Unsupported Download Option",
        message: `The engine rejected ${flag}. This is usually an outdated/incorrect custom argument or an option not supported by the installed yt-dlp version. Try updating yt-dlp in Settings → Engine, or clear your custom arguments.`,
        actionLabel: "Open Engine Settings",
        actionTarget: "settings-ytdlp",
        rawError: raw,
      };
    }

    // --- Cookie extraction failed ---
    // Chrome/Edge/Brave lock their cookie database while running, and recent
    // Chromium builds use app-bound encryption that blocks yt-dlp entirely.
    if (
      lower.includes("could not copy chrome cookie database") ||
      lower.includes("cookie database") ||
      (lower.includes("cookie") &&
        (lower.includes("could not") ||
          lower.includes("failed to decrypt") ||
          lower.includes("unable to decrypt") ||
          lower.includes("not found") ||
          lower.includes("no such")))
    ) {
      return {
        title: "Could Not Read Browser Cookies",
        message:
          "DropDL could not read the selected browser's cookie database. The browser is usually still running (it locks the file), or the profile is encrypted. Close that browser completely and retry, or export a cookies.txt file and select “Custom cookies.txt file” instead. Cookies stay on your disk — nothing is uploaded.",
        actionLabel: "Configure Browser Cookies",
        actionTarget: "settings-cookies",
        rawError: raw,
      };
    }

    if (lower.includes("sign in to confirm you're not a bot") || lower.includes("bot verification")) {
      return {
        title: "Authentication Required",
        message: "This website requires authentication or detected automated bot traffic. You can export or configure browser cookies in Settings to bypass this.",
        actionLabel: "Configure Browser Cookies",
        actionTarget: "settings-cookies",
        rawError: raw,
      };
    }

    if (lower.includes("video unavailable") || lower.includes("private video")) {
      return {
        title: "Restricted Media",
        message: "This video is either marked private, region-locked by the uploader, or removed by the platform.",
        actionLabel: "Check URL",
        actionTarget: "url",
        rawError: raw,
      };
    }

    if (lower.includes("ffmpeg not found") || lower.includes("ffprobe not found")) {
      return {
        title: "FFmpeg Dependency Missing",
        message: "Merging audio and video streams requires FFmpeg. Please verify that FFmpeg is installed or set the custom binary path in Settings.",
        actionLabel: "Open FFmpeg Settings",
        actionTarget: "settings-ytdlp",
        rawError: raw,
      };
    }

    if (lower.includes("http error 403") || lower.includes("forbidden")) {
      return {
        title: "Access Forbidden (HTTP 403)",
        message: "The media CDN token has expired or is geoblocked. Re-analyzing the URL or enabling a proxy can resolve token expiration.",
        actionLabel: "Check Network & Proxy",
        actionTarget: "settings-network",
        rawError: raw,
      };
    }

    if (
      lower.includes("http error 429") ||
      lower.includes("too many requests") ||
      lower.includes("rate-limit") ||
      lower.includes("rate limit")
    ) {
      return {
        title: "Rate Limited (HTTP 429)",
        message:
          "The website is temporarily throttling DropDL. Wait a few minutes and retry; " +
          "lowering concurrent downloads and setting a speed limit also helps.",
        actionLabel: "Check Network & Proxy",
        actionTarget: "settings-network",
        rawError: raw,
      };
    }

    if (
      lower.includes("not available in your country") ||
      lower.includes("blocked in your country") ||
      lower.includes("geo restriction") ||
      lower.includes("geo-restrict") ||
      (lower.includes("proxy") && lower.includes("country"))
    ) {
      return {
        title: "Geo-Restricted Content",
        message:
          "This video is blocked in your region. Try enabling a proxy or the " +
          "geo-restriction bypass in Settings → Network & Auth, then retry.",
        actionLabel: "Check Network & Proxy",
        actionTarget: "settings-network",
        rawError: raw,
      };
    }

    if (
      lower.includes("no space left") ||
      lower.includes("not enough space") ||
      lower.includes("disk full") ||
      lower.includes("no space on device") ||
      lower.includes("winerror 112")
    ) {
      return {
        title: "Disk Full",
        message:
          "There is not enough free space on the destination drive. Free up space or " +
          "pick another download folder, then retry — the partial file can be resumed.",
        actionLabel: "Open Download Settings",
        actionTarget: "settings-network",
        rawError: raw,
      };
    }

    if (
      lower.includes("permission denied") ||
      lower.includes("access is denied") ||
      lower.includes("winerror 5") ||
      lower.includes("operation not permitted")
    ) {
      return {
        title: "Permission Denied",
        message:
          "DropDL could not write to the destination folder. Check that the folder " +
          "exists, is writable, and is not protected (e.g. a system folder), then retry.",
        actionLabel: "Open Download Settings",
        actionTarget: "settings-network",
        rawError: raw,
      };
    }

    if (
      lower.includes("unable to connect") ||
      lower.includes("failed to connect") ||
      lower.includes("connection refused") ||
      lower.includes("connection reset") ||
      lower.includes("timed out") ||
      lower.includes("getaddrinfo") ||
      lower.includes("name resolution") ||
      lower.includes("network is unreachable") ||
      lower.includes("temporary failure")
    ) {
      return {
        title: "Network Failure",
        message:
          "DropDL could not reach the website. Check your internet connection and — if " +
          "one is configured — your proxy, then retry.",
        actionLabel: "Check Network & Proxy",
        actionTarget: "settings-network",
        rawError: raw,
      };
    }

    if (
      lower.includes("unsupported url") ||
      lower.includes("unsupported site") ||
      lower.includes("no video formats found") ||
      lower.includes("no suitable") && lower.includes("extractor")
    ) {
      return {
        title: "Unsupported Website",
        message:
          "yt-dlp does not support this URL yet. Double-check the link (a direct video " +
          "page works best) and try updating yt-dlp in Settings → Engine.",
        actionLabel: "Check URL",
        actionTarget: "url",
        rawError: raw,
      };
    }

    if (
      lower.includes("is not a valid url") ||
      lower.includes("invalid url") ||
      lower.includes("does not look like a url")
    ) {
      return {
        title: "Invalid URL",
        message:
          "This does not look like a valid media link. Paste a full http(s) URL to a " +
          "video or playlist page.",
        actionLabel: "Check URL",
        actionTarget: "url",
        rawError: raw,
      };
    }

    return {
      title: "Download Error",
      message: "yt-dlp encountered an unexpected response while processing this media.",
      rawError: raw,
    };
  }

  /**
   * Builds an accurate yt-dlp command string for transparency and preview
   */
  buildYtDlpCommand(opts: CommandOptions): string {
    const parts: string[] = ["yt-dlp"];

    // Format selection
    if (opts.extractAudio) {
      parts.push("-x");
      if (opts.audioFormat) {
        parts.push(`--audio-format ${opts.audioFormat.toLowerCase()}`);
      }
      if (opts.audioQuality && opts.audioQuality !== "best") {
        parts.push(`--audio-quality ${opts.audioQuality.replace(/\D/g, "")}k`);
      }
    } else if (opts.formatSelector) {
      parts.push(`-f "${opts.formatSelector}"`);
    }

    // Merge container
    if (!opts.extractAudio && opts.mergeOutputFormat && opts.mergeOutputFormat !== "original") {
      parts.push(`--merge-output-format ${opts.mergeOutputFormat.toLowerCase()}`);
    }

    // Metadata options
    if (opts.embedThumbnail) parts.push("--embed-thumbnail");
    if (opts.embedMetadata) parts.push("--embed-metadata");
    if (opts.writeDescription) parts.push("--write-description");
    if (opts.writeInfoJson) parts.push("--write-info-json");
    if (opts.writeThumbnailFile) parts.push("--write-thumbnail");
    if (opts.writeComments) parts.push("--write-comments");
    if (opts.embedChapters) parts.push("--embed-chapters");

    // Subtitles
    if (opts.writeSubtitles || opts.embedSubtitles || opts.writeAutoSubs) {
      if (opts.subLanguage) {
        parts.push(`--sub-langs "${opts.subLanguage}"`);
      }
      if (opts.writeSubtitles) parts.push("--write-subs");
      if (opts.writeAutoSubs) parts.push("--write-auto-subs");
      if (opts.embedSubtitles) parts.push("--embed-subs");
      if (opts.subFormat) parts.push(`--sub-format ${opts.subFormat.toLowerCase()}`);
    }

    // Rate limiting
    if (opts.rateLimitKbps && opts.rateLimitKbps > 0) {
      parts.push(`--limit-rate ${opts.rateLimitKbps}K`);
    }

    // Proxy
    if (opts.proxy && opts.proxy.trim()) {
      parts.push(`--proxy "${opts.proxy.trim()}"`);
    }

    // Cookies
    if (opts.cookiesSource && opts.cookiesSource !== "none") {
      parts.push(`--cookies-from-browser ${opts.cookiesSource}`);
    }

    // Custom arguments
    if (opts.customArgs && opts.customArgs.trim()) {
      parts.push(opts.customArgs.trim());
    }

    // Output template
    const outTpl = opts.outputTemplate || "%(title)s.%(ext)s";
    if (opts.destinationPath) {
      parts.push(`-P "${opts.destinationPath}"`);
    }
    parts.push(`-o "${outTpl}"`);

    // Target URL
    parts.push(`"${opts.url || "https://..."}"`);

    return parts.join(" \\\n  ");
  }

  /**
   * Evaluates standard codec compatibility rating
   */
  getCodecCompatibility(codec?: string, container?: string): { rating: "Excellent" | "Good" | "Modern" | "Fair"; notes: string } {
    const c = (codec || "").toLowerCase();
    const cont = (container || "").toLowerCase();

    if (c.includes("avc") || c.includes("h264") || c.includes("mp4a") || c.includes("aac")) {
      return {
        rating: "Excellent",
        notes: "Universal compatibility across all hardware, smart TVs, Apple, and legacy players.",
      };
    }
    if (c.includes("vp9") || c.includes("opus") || cont.includes("webm")) {
      return {
        rating: "Good",
        notes: "Supported by modern browsers, YouTube, Android, and newer macOS/Windows versions.",
      };
    }
    if (c.includes("av01") || c.includes("av1")) {
      return {
        rating: "Modern",
        notes: "Next-gen compression. Best bandwidth savings; requires modern GPU or fast CPU for 4K.",
      };
    }
    if (c.includes("hevc") || c.includes("h265")) {
      return {
        rating: "Good",
        notes: "High efficiency, requires HEVC video codec support installed on Windows / Apple OS.",
      };
    }
    return {
      rating: "Fair",
      notes: "Standard web media format. Merging or remuxing supported with FFmpeg.",
    };
  }

  /**
   * Executes download via native Tauri backend or runs simulation in browser
   */
  async startDownload(
    task: DownloadTask,
    onProgress: (updated: Partial<DownloadTask>) => void,
    onLog: (logText: string) => void,
    onComplete: (final?: { downloadedBytes?: number; totalBytes?: number; filePath?: string }) => void,
    onError: (err: string) => void
  ): Promise<void> {
    if (this.isNativeApp() && (window as any).__TAURI__) {
      const tauri = (window as any).__TAURI__;
      onLog(`[${new Date().toLocaleTimeString()}] [yt-dlp native] Starting native subprocess for ${task.url}`);
      
      if (tauri.event && tauri.event.listen) {
        // Unregister any previous listeners for this task (e.g. after pause/resume)
        const prev = this.activeUnlisteners.get(task.id);
        if (prev) {
          prev.forEach((fn) => {
            try { fn(); } catch { /* already gone */ }
          });
        }

        // IMPORTANT: await listener registration BEFORE spawning yt-dlp.
        // Tauri's listen() is async (it registers the callback with the Rust
        // event system); invoking start_download first meant early progress
        // events — and under load even the final size event — were emitted
        // before any listener existed, so tasks showed 100% / 0 B downloaded.
        const [unlistenProgress, unlistenLog, unlistenComplete] = await Promise.all([
          tauri.event.listen(`download-progress-${task.id}`, (e: any) => {
            if (!e.payload) return;
            const p = e.payload;
            const update: Partial<DownloadTask> = {};
            if (p.status !== undefined)             update.status = p.status;
            if (p.progress !== undefined)           update.progress = Math.min(100, Math.round(p.progress * 10) / 10);
            if (p.downloadedBytes !== undefined)    update.downloadedBytes = p.downloadedBytes;
            if (p.totalBytes !== undefined && p.totalBytes > 0) update.totalBytes = p.totalBytes;
            if (p.fileSizeBytes !== undefined)      update.fileSizeBytes = p.fileSizeBytes;
            if (p.filePath !== undefined)           update.filePath = p.filePath;
            if (p.speed !== undefined)              update.speed = p.speed;
            if (p.etaSeconds !== undefined)         update.etaSeconds = p.etaSeconds;
            if (p.postProcessingStep !== undefined) update.postProcessingStep = p.postProcessingStep;
            onProgress(update);
          }),
          tauri.event.listen(`download-log-${task.id}`, (e: any) => {
            if (e.payload) onLog(e.payload);
          }),
          // Real completion is signaled by the Rust backend when yt-dlp
          // terminates, NOT when start_download returns (it returns immediately
          // after spawning). The payload carries the probed final size/path.
          tauri.event.listen(`download-complete-${task.id}`, (e: any) => {
            this.removeListeners(task.id);
            const ok = e?.payload?.ok !== false;
            if (ok) {
              onComplete({
                downloadedBytes: e?.payload?.downloadedBytes,
                totalBytes: e?.payload?.totalBytes ?? e?.payload?.fileSizeBytes,
                filePath: e?.payload?.filePath,
              });
            } else {
              onError(e?.payload?.message || "Download process failed");
            }
          }),
        ]);
        this.activeUnlisteners.set(task.id, [unlistenProgress, unlistenLog, unlistenComplete]);
      }

      tauri.invoke("start_download", { task })
        .catch((err: any) => {
          this.removeListeners(task.id);
          onError(err?.toString() || "Native process failed");
        });
      return;
    }

    onError("DropDL must be run inside the Tauri desktop shell to download media.");
  }

  pauseDownload(taskId: string): void {
    // Simulation-mode cleanup (no-op in native mode)
    const interval = this.activeIntervals.get(taskId);
    if (interval) {
      window.clearInterval(interval);
      this.activeIntervals.delete(taskId);
    }

    // Native: kill the yt-dlp process (Rust keeps the partial file for resume)
    const tauri = (window as any).__TAURI__;
    if (tauri?.invoke) {
      tauri.invoke("pause_download", { taskId }).catch(() => {});
    }
  }

  cancelDownload(taskId: string): void {
    // Simulation-mode cleanup (no-op in native mode)
    const interval = this.activeIntervals.get(taskId);
    if (interval) {
      window.clearInterval(interval);
      this.activeIntervals.delete(taskId);
    }
    const timeout = this.activeIntervals.get(taskId + "_init");
    if (timeout) {
      window.clearTimeout(timeout);
      this.activeIntervals.delete(taskId + "_init");
    }

    // Native: kill the yt-dlp process tree. NOTE: do NOT also invoke
    // pause_download here — the two Rust commands raced each other: pause set
    // the stop flag to "paused" and emitted a "paused" status event that could
    // arrive after "cancelled", leaving tasks stuck as Paused after Cancel All.
    const tauri = (window as any).__TAURI__;
    if (tauri?.invoke) {
      tauri
        .invoke("cancel_download", { taskId })
        .catch(() => {})
        .finally(() => {
          // Stop listening only after the Rust command has run, so the final
          // "cancelled" status event is still received.
          this.removeListeners(taskId);
        });
    } else {
      this.removeListeners(taskId);
    }
  }

  /**
   * Check whether a newer bundled yt-dlp release exists.
   * Returns { currentVersion, latestVersion, updateAvailable }.
   */
  async checkYtDlpUpdate(): Promise<{ currentVersion: string; latestVersion: string; updateAvailable: boolean }> {
    if (this.isNativeApp() && (window as any).__TAURI__) {
      return (window as any).__TAURI__.invoke("check_ytdlp_update");
    }
    throw new Error("DropDL must be run inside the Tauri desktop shell.");
  }

  /**
   * Download and install the latest yt-dlp release into the app-data folder.
   * The running binary is validated before it is swapped in; a failed or
   * corrupt download never replaces a working executable.
   */
  async updateYtDlp(): Promise<string> {
    if (this.isNativeApp() && (window as any).__TAURI__) {
      return (window as any).__TAURI__.invoke("update_ytdlp");
    }
    throw new Error("DropDL must be run inside the Tauri desktop shell.");
  }

  /**
   * Open a finished file with the OS default application.
   */
  async openFile(path: string): Promise<void> {
    if (this.isNativeApp() && (window as any).__TAURI__) {
      await (window as any).__TAURI__.invoke("open_file", { path });
    }
  }

  /**
   * System clipboard inspection
   */
  async checkClipboard(): Promise<string | null> {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text && (text.startsWith("http://") || text.startsWith("https://"))) {
          return text.trim();
        }
      }
    } catch {
      // Permission might be denied in iframe or unfocused window
    }
    return null;
  }
}

export const tauriService = new TauriService();
