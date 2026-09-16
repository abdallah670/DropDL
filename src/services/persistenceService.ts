
import { AppSettings } from "../types/ytdlp";
import { DownloadTask } from "../types/ytdlp";

export interface PersistedPaths {
  /** Most recently used download folder */
  lastDownloadFolder: string;
  /** User-added favorite folders */
  favoriteFolders: string[];
}

/** The whole persisted app state, assembled from the per-section files. */
export interface PersistedState {
  version: number;
  settings: AppSettings | null;
  history: DownloadTask[];
  paths: PersistedPaths;
  /** Resumable tasks (queued/paused/failed/cancelled) restored on next launch. */
  queue: DownloadTask[];
}

const CURRENT_VERSION = 2;
const HISTORY_CAP = 200;
const QUEUE_CAP = 200;

/**
 * Sectioned persistence — one file per part of the app state, all inside the
 * OS app-data dir:
 *
 *   settings.json — app settings + folder paths (small, rarely changes)
 *   history.json  — completed downloads (large, written on completion only)
 *   queue.json    — pending/paused/failed/cancelled tasks (written often)
 *
 * Splitting them means a queue progress tick no longer re-serialises the whole
 * 200-entry history every second, and a damaged history file can never take
 * the download queue down with it.
 */
export const DATA_FILES = {
  settings: "settings.json",
  history: "history.json",
  queue: "queue.json",
} as const;

export type DataSection = keyof typeof DATA_FILES;

/** Pre-split single-file layout, migrated to the split files on first launch. */
const LEGACY_CONFIG_FILENAME = "config.json";

/** Statuses that survive a restart as-is (everything else is dropped/demoted). */
const RESUMABLE_STATUSES = new Set(["queued", "paused", "failed", "cancelled"]);

/** Normalise a task list read from disk (shared by the files + legacy config). */
function normalizeTasks(raw: unknown): DownloadTask[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (t) => t && typeof t === "object" && typeof t.id === "string" && typeof t.url === "string"
    )
    .map((t: any) => ({
      ...t,
      // logs are verbose runtime noise, not durable state
      logs: [],
      speed: 0,
      etaSeconds: 0,
      postProcessingStep: undefined,
    })) as DownloadTask[];
}

function normalizeHistory(raw: unknown): DownloadTask[] {
  return normalizeTasks(raw).slice(0, HISTORY_CAP);
}

/**
 * Queue contents kept across restarts. Runtime-only statuses (downloading,
 * processing, merging, analyzing) become "paused" because yt-dlp keeps `.part`
 * files and resumes from them. Completed tasks are dropped (they live in
 * history), while cancelled/failed tasks are kept as-is so "Retry All" still
 * works after a restart instead of forcing the user to re-paste the URL.
 */
function normalizeQueue(raw: unknown): DownloadTask[] {
  return normalizeTasks(raw)
    .filter((t) => t.status !== "completed")
    .slice(0, QUEUE_CAP)
    .map((t) => ({
      ...t,
      status: RESUMABLE_STATUSES.has(t.status) ? t.status : ("paused" as const),
    }));
}

function normalizePaths(raw: any): PersistedPaths {
  return {
    lastDownloadFolder:
      typeof raw?.lastDownloadFolder === "string" ? raw.lastDownloadFolder : "",
    favoriteFolders: Array.isArray(raw?.favoriteFolders)
      ? raw.favoriteFolders.filter((f: unknown) => typeof f === "string")
      : [],
  };
}

/** Assemble the full state from the split files (any of them may be missing). */
function assembleState(settingsPart: any, historyPart: any, queuePart: any): PersistedState {
  return {
    version: CURRENT_VERSION,
    settings: (settingsPart?.settings as AppSettings) ?? null,
    paths: normalizePaths(settingsPart?.paths),
    history: normalizeHistory(historyPart?.history),
    queue: normalizeQueue(queuePart?.queue),
  };
}

/**
 * Convert a legacy single-file config.json (ANY previous version) into the
 * current shape: v1 had no persisted queue, runtime statuses are demoted and
 * logs are stripped.
 */
function migrateLegacyConfig(parsed: any): PersistedState {
  if (!parsed || typeof parsed !== "object") return assembleState(null, null, null);
  if (parsed.version !== CURRENT_VERSION) {
    console.warn(
      `[PersistenceService] Migrating config version ${parsed.version} → ${CURRENT_VERSION}.`
    );
  }
  return assembleState(parsed, parsed, parsed);
}

/** In-memory fallback for non-Tauri runtimes (plain browser preview). */
const WEB_STORAGE_KEY = "dropdl.config";

function readWebFallback(): string | null {
  try {
    return window.localStorage.getItem(WEB_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeWebFallback(raw: string): boolean {
  try {
    window.localStorage.setItem(WEB_STORAGE_KEY, raw);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read the persisted state from disk (settings.json + history.json +
 * queue.json). Returns null when nothing has ever been saved.
 */
export async function loadPersistedState(): Promise<PersistedState | null> {
  const tauri = (window as any).__TAURI__;

  if (tauri?.invoke) {
    try {
      const [settingsPart, historyPart, queuePart] = await Promise.all([
        tauri.invoke("load_data_file", { name: "settings" }),
        tauri.invoke("load_data_file", { name: "history" }),
        tauri.invoke("load_data_file", { name: "queue" }),
      ]);

      const state = assembleState(settingsPart, historyPart, queuePart);
      const isFirstRun =
        settingsPart == null && historyPart == null && queuePart == null;

      // Legacy single config.json: migrate whatever section has no file of its
      // own yet (this also covers a partial migration, e.g. settings.json was
      // written but queue.json wasn't — the saved batch is still recovered).
      // A damaged legacy file must not take the split files down with it.
      let legacy: any = null;
      try {
        legacy = await tauri.invoke("load_config");
      } catch (err) {
        console.warn(
          `[PersistenceService] Legacy ${LEGACY_CONFIG_FILENAME} could not be read ` +
            `(ignored, split data files are used):`,
          err
        );
      }
      if (legacy) {
        const migrated = migrateLegacyConfig(legacy);
        if (settingsPart == null) {
          state.settings = migrated.settings;
          state.paths = migrated.paths;
        }
        if (historyPart == null) state.history = migrated.history;
        if (queuePart == null) state.queue = migrated.queue;

        console.info(
          `[PersistenceService] Migrating legacy ${LEGACY_CONFIG_FILENAME} to split data files ` +
            `(settings, history, queue)…`
        );
        await savePersistedState(state);
        try {
          await tauri.invoke("archive_legacy_config");
        } catch (err) {
          console.warn("[PersistenceService] Could not archive legacy config.json:", err);
        }
        return state;
      }

      if (isFirstRun) return null;
      // Sections written so far, with the not-yet-written ones empty.
      return state;
    } catch (err) {
      console.warn("[PersistenceService] Native load failed:", err);
      return null;
    }
  }

  // Non-Tauri runtime (browser preview) — single localStorage blob.
  const raw = readWebFallback();
  if (!raw) return null;
  try {
    return migrateLegacyConfig(JSON.parse(raw));
  } catch {
    return null;
  }
}

/**
 * Last payload written per section, so unchanged sections are skipped. Queue
 * progress ticks fire saves frequently; without this the (much larger) history
 * file would be rewritten on every tick.
 */
const lastWritten = new Map<DataSection, string>();

/**
 * Serialize and write the state — one file per section, each written
 * atomically on the Rust side (tmp file + rename).
 */
export async function savePersistedState(state: Omit<PersistedState, "version">): Promise<void> {
  const tauri = (window as any).__TAURI__;

  if (tauri?.invoke) {
    const sections: { section: DataSection; payload: Record<string, unknown> }[] = [
      {
        section: "settings",
        payload: { version: CURRENT_VERSION, settings: state.settings, paths: state.paths },
      },
      { section: "history", payload: { version: CURRENT_VERSION, history: state.history } },
      { section: "queue", payload: { version: CURRENT_VERSION, queue: state.queue } },
    ];

    for (const { section, payload } of sections) {
      const raw = JSON.stringify(payload);
      if (lastWritten.get(section) === raw) continue; // this section didn't change
      try {
        await tauri.invoke("save_data_file", { name: section, value: payload });
        lastWritten.set(section, raw);
      } catch (err) {
        console.warn(`[PersistenceService] Failed to save ${DATA_FILES[section]}:`, err);
      }
    }
    return;
  }

  // Non-Tauri runtime (browser preview): keep everything under one key.
  const raw = JSON.stringify({ version: CURRENT_VERSION, ...state }, null, 2);
  if (!writeWebFallback(raw)) {
    console.warn("[PersistenceService] localStorage unavailable — state not persisted.");
  }
}

/** Add a folder path to the favorites list and persist. */
export async function addFavoriteFolder(
  folder: string,
  currentPaths: PersistedPaths
): Promise<PersistedPaths> {
  const updated: PersistedPaths = {
    ...currentPaths,
    lastDownloadFolder: folder,
    favoriteFolders: [
      folder,
      ...currentPaths.favoriteFolders.filter((f) => f !== folder),
    ].slice(0, 10), // keep at most 10 favorites
  };
  return updated;
}

export const DEFAULT_PATHS: PersistedPaths = {
  lastDownloadFolder: "",
  favoriteFolders: [],
};
