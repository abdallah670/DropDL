export type MediaType = "video" | "audio" | "muxed";

export interface YtDlpFormat {
  format_id: string;
  format_note?: string;
  ext: string;
  protocol?: string;
  acodec?: string; // e.g. "mp4a.40.2", "opus", "none"
  vcodec?: string; // e.g. "avc1.640028", "vp09.00.41.08", "av01.0.08M.08", "none"
  width?: number;
  height?: number;
  fps?: number;
  rows?: number;
  columns?: number;
  fragments?: Array<{ url: string; duration: number }>;
  resolution?: string; // e.g. "1920x1080", "audio only"
  aspect_ratio?: number;
  filesize?: number;
  filesize_approx?: number;
  tbr?: number; // total bitrate in kbit/s
  vbr?: number; // video bitrate
  abr?: number; // audio bitrate
  asr?: number; // audio sample rate in Hz
  audio_channels?: number;
  dynamic_range?: string; // "SDR", "HDR10", "HLG"
  format?: string;
  language?: string;
  container?: string;
  is_dash?: boolean;
}

export interface YtDlpSubtitle {
  ext: string;
  url?: string;
  name?: string;
}

export interface YtDlpMediaInfo {
  id: string;
  title: string;
  webpage_url: string;
  extractor: string;
  extractor_key: string;
  uploader?: string;
  uploader_id?: string;
  uploader_url?: string;
  channel?: string;
  channel_id?: string;
  channel_follower_count?: number;
  duration?: number;
  view_count?: number;
  like_count?: number;
  upload_date?: string;
  description?: string;
  thumbnail?: string;
  thumbnails?: Array<{ url: string; id?: string; width?: number; height?: number }>;
  formats: YtDlpFormat[];
  subtitles?: Record<string, YtDlpSubtitle[]>;
  automatic_captions?: Record<string, YtDlpSubtitle[]>;
  is_live?: boolean;
  age_limit?: number;
  playlist_title?: string;
  playlist_id?: string;
  playlist_index?: number;
  playlist_count?: number;
}

export interface PlaylistVideoItem {
  id: string;
  index: number;
  title: string;
  duration?: number;
  url: string;
  thumbnail?: string;
  uploader?: string;
  isAvailable: boolean;
  selected: boolean;
}

export interface PlaylistInfo {
  id: string;
  title: string;
  uploader?: string;
  video_count: number;
  entries: PlaylistVideoItem[];
}

export type DownloadStatus =
  | "queued"
  | "analyzing"
  | "downloading"
  | "paused"
  | "processing"
  | "merging"
  | "completed"
  | "failed"
  | "cancelled";

export interface DownloadTask {
  id: string;
  url: string;
  title: string;
  thumbnail?: string;
  mediaType: "video" | "audio";
  resolutionLabel: string;
  formatSelector: string;
  container: string;
  destinationPath: string;
  // Optional yt-dlp output filename template (relative to destinationPath),
  // e.g. "01 - %(title)s.%(ext)s" for numbered playlist batches.
  outputTemplate?: string;
  status: DownloadStatus;
  progress: number; // 0 to 100
  downloadedBytes: number;
  totalBytes: number;
  speed: number; // bytes/sec
  etaSeconds: number;
  currentFragment?: number;
  totalFragments?: number;
  postProcessingStep?: string;
  logs: string[];
  errorMessage?: string;
  originalError?: string;
  createdAt: number;
  completedAt?: number;
  fileSizeBytes?: number;
  /** Absolute path of the finished output file (set on completion). */
  filePath?: string;
}

export type NavTab = "download" | "formats" | "queue" | "history" | "playlist" | "settings" | "logs";

export interface AppSettings {
  general: {
    language: string;
    theme: "dark" | "light" | "system";
    startMinimized: boolean;
    clipboardMonitoring: boolean;
    showNotifications: boolean;
    playNotificationSound: boolean;
    notifications?: boolean;
  };
  downloads: {
    defaultFolder: string;
    concurrentDownloads: number;
    maxConcurrent?: number;
    retries: number;
    rateLimitKbps: number | null; // null or 0 for unlimited
    overwriteBehavior: "overwrite" | "auto-rename" | "skip" | "resume";
    overwriteMode?: "overwrite" | "auto-rename" | "skip" | "resume";
    /** Container preselected for new downloads ("MP4" | "MKV" | "WebM" | "Original"). */
    defaultContainer?: string;
    /** Audio codec preselected for audio-only downloads (lowercase: "mp3" | "m4a" | ...). */
    defaultAudioFormat?: string;
  };
  ytdlp: {
    executablePath: string;
    binaryPath?: string;
    detectedVersion: string;
    lastChecked: string;
    customArgs: string;
  };
  ffmpeg: {
    ffmpegPath: string;
    binaryPath?: string;
    ffprobePath: string;
    probePath?: string;
    detectedVersion: string;
    isAvailable: boolean;
  };
  advanced: {
    proxy: string;
    cookiesSource: "none" | "chrome" | "firefox" | "edge" | "safari" | "brave" | "file" | string | null;
    cookiesFilePath?: string;
    networkTimeoutSecs: number;
    expertMode: boolean;
    verboseLogs: boolean;
    geoBypass?: boolean;
  };
}

export interface DependencyStatus {
  name: string;
  installed: boolean;
  version?: string;
  path?: string;
  required: boolean;
  description: string;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: "info" | "stdout" | "stderr" | "warning" | "error" | "debug" | "warn";
  text?: string;
  message?: string;
  source?: string;
  taskId?: string;
}
