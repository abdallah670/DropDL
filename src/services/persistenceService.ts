
import { AppSettings } from "../types/ytdlp";
import { DownloadTask } from "../types/ytdlp";

export interface PersistedPaths {
  /** Most recently used download folder */
  lastDownloadFolder: string;
  /** User-added favorite folders */
  favoriteFolders: string[];
}

export interface PersistedState {
  version: number;
  settings: AppSettings | null;
  history: DownloadTask[];
  paths: PersistedPaths;
}

const CURRENT_VERSION = 1;
const CONFIG_FILENAME = "config.json";

/** Resolve the AppData dir via Tauri path API */
async function getConfigPath(): Promise<string | null> {
  try {
    const tauri = (window as any).__TAURI__;
    if (!tauri?.path?.appDataDir) return null;
    const appDataDir: string = await tauri.path.appDataDir();
    // Tauri's path.join util
    return tauri.path.join
      ? await tauri.path.join(appDataDir, CONFIG_FILENAME)
      : `${appDataDir}/${CONFIG_FILENAME}`;
  } catch {
    return null;
  }
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

/** Read and parse the persisted state from disk. Returns null on any failure. */
export async function loadPersistedState(): Promise<PersistedState | null> {
  try {
    const tauri = (window as any).__TAURI__;

    // Preferred path: native Rust command (bypasses fs-plugin scope entirely)
    if (tauri?.invoke) {
      try {
        const result = await tauri.invoke("load_config");
        if (result) return validateParsed(result);
        // File doesn't exist yet — first run
        return null;
      } catch (err) {
        console.warn("[PersistenceService] Native load_config failed:", err);
      }
    }

    if (!tauri?.fs?.readTextFile) {
      // Non-Tauri runtime (browser preview) — fall back to localStorage
      const raw = readWebFallback();
      if (!raw) return null;
      return validateParsed(JSON.parse(raw));
    }

    const configPath = await getConfigPath();
    if (!configPath) return readWebFallback() ? validateParsed(JSON.parse(readWebFallback()!)) : null;

    const raw = await tauri.fs.readTextFile(configPath);
    return validateParsed(JSON.parse(raw));
  } catch {
    // File doesn't exist yet — first run
    return null;
  }
}

/** Validate a parsed config object against the expected schema shape. */
function validateParsed(parsed: any): PersistedState | null {
  if (!parsed || typeof parsed !== "object") return null;

  // Basic version check — if the schema changed, migrate instead of dropping data
  if (parsed.version !== CURRENT_VERSION) {
    console.warn(
      `[PersistenceService] Config version ${parsed.version} != ${CURRENT_VERSION} — salvaging known fields.`
    );
  }

  return {
    version: CURRENT_VERSION,
    settings: parsed.settings ?? null,
    history: Array.isArray(parsed.history) ? parsed.history : [],
    paths: {
      lastDownloadFolder:
        typeof parsed.paths?.lastDownloadFolder === "string" ? parsed.paths.lastDownloadFolder : "",
      favoriteFolders: Array.isArray(parsed.paths?.favoriteFolders)
        ? parsed.paths.favoriteFolders.filter((f: unknown) => typeof f === "string")
        : [],
    },
  };
}

/** Serialize and write the current state to disk (atomic: tmp file + rename). */
export async function savePersistedState(state: Omit<PersistedState, "version">): Promise<void> {
  const payload: PersistedState = {
    version: CURRENT_VERSION,
    ...state,
  };
  const raw = JSON.stringify(payload, null, 2);

  try {
    const tauri = (window as any).__TAURI__;

    // Preferred path: native Rust command (bypasses fs-plugin scope entirely)
    if (tauri?.invoke) {
      try {
        await tauri.invoke("save_config", { state: payload });
        return;
      } catch (err) {
        console.warn("[PersistenceService] Native save_config failed:", err);
      }
    }

    if (!tauri?.fs?.writeTextFile) {
      // Non-Tauri runtime (browser preview) — fall back to localStorage
      if (!writeWebFallback(raw)) {
        console.warn("[PersistenceService] localStorage unavailable — state not persisted.");
      }
      return;
    }

    const configPath = await getConfigPath();
    if (!configPath) return;

    // Ensure the appDataDir exists before trying to write to it!
    const appDataDir = await tauri.path.appDataDir();
    await tauri.fs.createDir(appDataDir, { recursive: true });

    // Atomic write: write to a temp file, then rename over the real one.
    // If rename isn't available, fall back to a direct write.
    const tmpPath = `${configPath}.tmp`;
    await tauri.fs.writeTextFile(tmpPath, raw);
    if (tauri.fs.renameFile) {
      try {
        await tauri.fs.renameFile(tmpPath, configPath);
      } catch (renameErr) {
        console.warn("[PersistenceService] Atomic rename failed, writing directly:", renameErr);
        await tauri.fs.writeTextFile(configPath, raw);
        await tauri.fs.removeFile?.(tmpPath).catch?.(() => {});
      }
    } else {
      await tauri.fs.writeTextFile(configPath, raw);
    }
  } catch (e) {
    console.error("[PersistenceService] Failed to save state:", e);
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
