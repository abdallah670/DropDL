# DropDL Mobile App Plan

Goal: ship DropDL on Android & iOS in addition to the existing Tauri desktop app, reusing the
existing React + Vite + Zustand frontend (`src/`) and Rust backend (`src-tauri/`) as much as possible.

> **Last updated** after the desktop hardening pass (commits `458addf`, `97868a5`, `03fbb66`):
> sectioned persistence, real queue persistence/restore, progress/cancel/retry fixes, playlist
> batch selection + quality/container, and the sidebar queue counter. Items marked **[DONE]**
> already landed on desktop — they were the prerequisites for mobile, so the remaining mobile gap
> is smaller than when this plan was first written.
>
> Also folded in from a verified build + repo audit: **§7 Repo Hygiene** (952 of 1033 tracked files
> are build artifacts; `.git` is 267.5 MB) and **§8 Build Commands** (measured release MSI 141.5 MB,
> ~4m 09s). §4's reference to §7 now resolves.

## 1. Current State

- Frontend: React 19 + TypeScript + Tailwind 4 + Zustand (`src/`).
- Desktop: still **Tauri v1.5** — `tauri` / `tauri-build` 1.5, `@tauri-apps/api` ^1.5.6,
  `@tauri-apps/cli` ^1.6.3, `withGlobalTauri: true`. The Rust backend exposes 11
  `#[tauri::command]`s and spawns yt-dlp / ffmpeg / ffprobe sidecars (`src-tauri/bin/`).
- Persistence (**[DONE]**, changed since this plan was written): no longer a single `config.json`.
  The app-data dir holds three independent files (`src/services/persistenceService.ts` +
  `src-tauri/src/main.rs`):

  | File | Contents | Cap |
  |------|----------|-----|
  | `settings.json` | `AppSettings` + folder `paths` | — |
  | `history.json` | completed tasks | 200 |
  | `queue.json` | pending / paused / failed / cancelled tasks | 200 |

  All three are written atomically per file (`.json.tmp` → rename) through allowlisted section
  names, with per-section change detection, so a queue progress tick no longer rewrites history.
  Legacy `config.json` is migrated section-by-section, then archived to `config.json.bak`.
- The download **queue is now persisted and restored** on launch: live statuses
  (`downloading` / `processing` / `merging` / `analyzing`) are demoted to `paused` so yt-dlp
  resumes from existing `.part` files; `queued` / `paused` / `failed` / `cancelled` survive as-is.
- History entries carry `filePath` plus the final byte counts (from the Rust completion event).
- Native calls still go through `window.__TAURI__` directly — **22 call sites across 7 files**
  (`tauriService.ts` 11, `UrlInputSection.tsx` 4, `persistenceService.ts` 2,
  `SimpleQualitySelector.tsx` 2, `HistoryPage.tsx` 1, `QueuePage.tsx` 1, `SettingsPage.tsx` 1).
  No `src/services/platform/` abstraction exists yet → **largest remaining prep item**.
- Release builds work locally on Windows: `npx tauri build` yields a **~141.5 MB MSI** (the sidecar
  binaries dominate that size). CI does not exist yet.

## 2. Architecture Decision

**Recommended: Tauri v2 mobile.** Tauri 2 supports iOS/Android with one Rust backend and one
webview UI shared across desktop/Android/iOS.

| Option            | Code reuse | Notes                                                |
|-------------------|-----------|-------------------------------------------------------|
| Tauri v2 (chosen) | ~90%      | v1 → v2 migration required; mobile plugins for fs/http/etc |
| Capacitor         | ~70% UI   | Native layer in JS plugins; needs companion server for yt-dlp |
| React Native      | ~10%      | Full rewrite of UI + Rust logic — rejected            |

Key constraint: **yt-dlp/ffmpeg cannot run as free subprocess binaries on mobile.**

- **Android**: bundle `ffmpeg` per-ABI (arm64-v8a, armeabi-v7a, x86_64) and run yt-dlp via a
  bundled Python runtime (Chaquopy) **or** port extraction to Rust (`rustypipe`).
- **iOS**: App Store builds cannot spawn downloaded binaries → compile ffmpeg as a static
  library and implement extraction in Rust (`rustypipe`), or offer a server-relay mode.

## 3. Phases

### Phase 0 — Prep (1 week)
- [x] **[DONE]** Persistence hardened and split into three atomic files; legacy `config.json`
      migrated per section and archived; localStorage fallback for non-Tauri runtimes.
- [x] **[DONE]** Queue survives restarts — the biggest data-loss gap for mobile, where the OS kills
      backgrounded apps aggressively.
- [ ] Create `src/services/platform/` abstraction with `desktop` / `mobile` / `web` implementations.
- [ ] Replace all 22 direct `window.__TAURI__` call sites (7 files — see §1) with that abstraction.
- [ ] Upgrade `@tauri-apps/api`, `@tauri-apps/cli`, and the `tauri` crate to 2.x; turn off
      `withGlobalTauri` (all current native calls go through custom commands, which map cleanly).

### Phase 1 — Desktop regression check (3 days)
- [ ] Verify desktop build / analyze / download / persistence still work after the v2 migration.
- [ ] Confirm all three data files (`settings.json`, `history.json`, `queue.json`) are written on
      first launch, and that a legacy `config.json` migrates and is archived to `config.json.bak`.
- [ ] Re-verify cancel / retry and process-tree kill after v2: desktop uses
      `taskkill /PID <pid> /T /F`, which has no mobile equivalent (Phase 3).

### Phase 2 — Mobile scaffolding (1 week)
- [ ] Rust targets: `aarch64-linux-android`, `armv7-linux-androideabi`, `aarch64-apple-ios`, `x86_64-apple-ios`.
- [ ] `tauri android init` / `tauri ios init`; bundle identifier `com.dropdl.app`.
- [ ] Configure v2 capabilities/permissions: fs (app data only), http, notifications, clipboard,
      share-target (receive URLs shared from other apps).
- [ ] Responsive layout pass: bottom tab navigation on phones, sidebar on tablets/desktop.

### Phase 3 — Native engine on mobile (2–3 weeks)
- [ ] Android: bundle ffmpeg per ABI; yt-dlp strategy (Chaquopy Python or `rustypipe` in Rust).
- [ ] iOS: static ffmpeg + `rustypipe` extraction (App Store-safe).
- [ ] Background downloads: Android foreground service; iOS background `URLSession` (limits apply).
- [ ] Progress: reuse existing `download-progress-{id}` / `download-log-{id}` event names.
- [ ] Storage: app sandbox; Android SAF + iOS Files picker for user-chosen destinations.

### Phase 4 — UI adaptation (2 weeks)
- [ ] Touch targets ≥ 44px; safe-area insets (notch / home indicator).
- [ ] Mobile simplified flow: URL → quality presets → download.
- [ ] Notification-permission UX for download-complete alerts.

### Phase 5 — Polish & release (1–2 weeks)
- [x] **[DONE]** Desktop release build verified locally: `npx tauri build --bundles msi`
      (release profile, ~141.5 MB MSI). The NSIS bundle targets the same sidecars.
- [ ] CI: GitHub Actions — `tauri android build` (AAB), `tauri ios build` (IPA), desktop builds.
- [ ] Signing: Play Store AAB + keystore; TestFlight → App Store.
- [ ] Store assets: icons (`tauri icon`), screenshots.

## 4. Risks

- yt-dlp is effectively blocked in iOS App Store builds → server-relay mode is the fallback.
- ffmpeg per-ABI binaries add ~30–80 MB per app, and the **measured** desktop MSI is already
  141.5 MB because of the sidecars. Treat install/download size as a first-class constraint on
  mobile — consider a "fetch the engine on first run" flow instead of bundling all ABIs.
- iOS background-download time limits may cap long downloads. Queue persistence now at least
  survives the app being killed, which this plan previously could not rely on.
- Tauri v2 migration may surface plugin permission changes requiring desktop retesting. The
  persistence layer is the most exposed area, but it talks to **custom Rust commands** rather than
  `fs`-plugin scope config, so it should port more cleanly than the original `config.json` design.
- The repo carries hygiene problems that will confuse CI/packaging until fixed: **952 of 1033
  tracked files are build artifacts** (`.git` is 267.5 MB), plus two committed duplicates and
  tracked scratch files (see §7).

## 5. Persisted Data Schema — finish before Phase 2

Mobile amplifies persistence gaps (backgrounded apps are killed, per-platform storage dirs), and the
schema changed shape since this plan was first written: it is now **three files instead of one
`config.json`**. Settle the remaining items before scaffolding so mobile starts from a fixed schema.

### Landed since this plan was written

- [x] Split persistence into `settings.json` / `history.json` / `queue.json` (`version: 2`), atomic
      per-file writes, allowlisted section names, per-section change detection.
- [x] Persist the active `queue` (previously dropped on restart). Live statuses are demoted to
      `paused`; `queued` / `paused` / `failed` / `cancelled` are restored verbatim, so **Retry All**
      works after a restart without re-pasting the URL.
- [x] `filePath` on history/queue entries (from the Rust `download-complete` payload) — this is the
      hook the mobile *Open file* / *Share sheet* flow needs.
- [x] Real migration instead of a logged warning: `migrateLegacyConfig()` migrates per section and
      `archive_legacy_config()` renames the old `config.json` to `config.json.bak`.
- [x] Write back `ytdlp.executablePath` / `lastChecked` and `ffmpeg.ffmpegPath` / `ffprobePath`
      from the actual dependency probe (no more version-with-blank-path).

### Still open

- [ ] `settings.downloads.defaultContainer` + `defaultAudioFormat` are **declared in
      `src/types/ytdlp.ts` but never populated or read**: `DEFAULT_SETTINGS` omits both, and the
      Playlist page keeps its own local `batchContainer` / `audioContainer` state defaulting to
      `mp4` / `mp3`. Wire them up (or drop the fields) so the last-used container/format persists.
- [ ] Collapse the three folder sources into one: `settings.downloads.defaultFolder` (still the
      hardcoded literal `"~/Downloads"`), `paths.lastDownloadFolder`, and
      `paths.favoriteFolders[0]`. `updateSettings` already mirrors folder changes into
      `paths.lastDownloadFolder` + `favoriteFolders` — that mirroring is the duplication to remove.
- [ ] Decide the bundle identifier (below) and add its one-time data migration.
- [ ] Decide whether each file keeps an independent `version: 2` or they share one schema version,
      and whether `history`/`queue` caps stay at 200 on mobile (16 GB devices).

### Bundle identifier — resolve before scaffolding

Desktop currently ships `com.dropdl.desktop` (`src-tauri/tauri.conf.json`), which is also the
app-data directory name holding `settings.json` / `history.json` / `queue.json` + `bin/`. This plan
proposes `com.dropdl.app` for mobile. The identifier determines the app-data directory, so a
mismatch means two settings stores and no carry-over between platforms. **Pick one id** (renaming
desktop is the cleaner long-term choice) and add the one-time migration that moves the three files.

### Platform-correct data location (already handled by `appDataDir()`)

| Platform | Data location |
|----------|---------------|
| Windows  | `%APPDATA%\<bundle-id>\{settings,history,queue}.json` |
| Android  | app-private `filesDir` |
| iOS      | `Application Support` |

## 6. Robustness Fixes Already Landed

- yt-dlp prints approximate totals as `of ~  44.31MiB`; the lone `~` token previously parsed to 0
  so the UI showed `0 B`. Totals now take the first token that parses to a real size.
- Container / audio-codec is whitelisted in `start_download`; unknown or stale values fall back to
  yt-dlp defaults instead of emitting an invalid flag.
- `load_config` tolerates a UTF-8 BOM (a hand-edited file previously failed with
  `expected value at line 1 column 1`).
- Playlist/batch downloads now inherit the current container + quality selection instead of
  hardcoding `MP4` / `1080p`.
- Cancel kills the **whole process tree** (`taskkill /PID <pid> /T /F` on Windows, with a `kill()`
  fallback), so ffmpeg and yt-dlp's own worker children no longer keep downloading after Cancel.
  An early-cancel race is fixed too: after registering the child, the download task re-checks the
  stop flag and kills it immediately instead of running to completion.
- Cancel no longer races itself: the JS layer used to invoke `pause_download` **and**
  `cancel_download` back to back, and the last status event won — which left all but the first task
  stuck as *Paused*. Cancel now sends a single command, and listeners are torn down only after the
  Rust command returns.
- Progress is no longer reported as `0 B`: `startDownload` awaits listener registration before
  spawning yt-dlp (events used to fire before a listener existed), and the `download-complete`
  payload's final `downloadedBytes` / `totalBytes` / `filePath` are merged into the task and history.
- Cancelled/failed tasks can be retried: per-task retry (runs immediately, bypassing the concurrency
  worker) and **Retry All** (re-queues everything failed/cancelled through the worker). yt-dlp
  resumes from existing `.part` files.
- Playlist analysis uses `--flat-playlist` first, falling back to full extraction only for single
  videos: a 10-video playlist went from **17.8 s → 2.7 s**.
- Playlist batch selection downloads **only the checked videos** (the enqueue path previously
  filtered on a legacy per-entry flag the checkboxes never wrote, so it grabbed every video), and the
  queue auto-save is a **throttle** rather than a debounce — a debounce is reset by every progress
  tick and could never fire during an active download.

## 7. Repo Hygiene — fix before CI (Phase 5)

Verified against the working tree; each item blocks or inflates CI.

- **Build artifacts are committed.** **952 of 1033 tracked files** live under `src-tauri/target/`
  (487 MB on disk); `.git` is **267.5 MB**. `.gitignore` never excludes `src-tauri/target/`, so every
  CI checkout pulls a quarter-gigabyte of stale binaries and rebuilds surface hundreds of spurious
  diffs. Add `src-tauri/target/` and untrack it.
- **Duplicate `Cargo.toml` at the repo root.** The real manifest is `src-tauri/Cargo.toml`; a
  byte-identical copy at the root made cargo treat the repo root as a workspace with no targets:
  `failed searching for potential workspace` / `no targets specified in the manifest`, which blocked
  every `cargo check` / `cargo build`. It is currently renamed to `Cargo.toml.duplicate-backup`
  (committed) so builds work — delete it.
- **Duplicate `icons/`.** 17 files at the repo root duplicate `src-tauri/icons/` (~3 MB). Tauri reads
  `src-tauri/icons/` per `tauri.conf.json`, so the root copy is dead weight; `tauri icon` should
  target one location only.
- **Scratch files are tracked**: `build_log.txt` and `flat_test.json` (plus untracked
  `build_release_log.txt`). `.gitignore` covers `*.log` but not `*.txt` build logs.
- **The cargo target dir is machine-specific** (see §8) — a hardcoded `%TEMP%` path in a committed
  config will not work on CI or another developer's machine.
- Note: the earlier stray `src/types/persistenceService.ts` (unimported duplicate of
  `src/services/persistenceService.ts`) has already been removed.

## 8. Appendix — Build Commands (verified on Windows)

| Goal | Command | Output |
|------|---------|--------|
| Dev, hot reload | `npm run desktop:dev` | dev window |
| Frontend only | `npm run build` / `npm run lint` (`tsc --noEmit`) | `dist/` |
| Debug installer (fast) | `npx tauri build --debug --bundles msi` | `%TEMP%\dropdl-target\debug\bundle\msi\DropDL_1.0.0_x64_en-US.msi` |
| Release installer | `npx tauri build` / `npm run desktop:build` | `%TEMP%\dropdl-target\release\bundle\{msi,nsis}\…` |
| Release, MSI only | `npx tauri build --bundles msi` | skips the slow NSIS step |

Measured on this machine: release `Finished \`release\` profile in 4m 09s`; MSI **141.5 MB** (debug
MSI re-bundles in well under a minute). `--bundles msi` is the fast path — the NSIS `-setup.exe`
spends several extra minutes compressing the same payload.

**Cargo builds to `%TEMP%`, not `src-tauri/target`.** `src-tauri/.cargo/config.toml` pins
`target-dir = "C:/Users/HP/AppData/Local/Temp/dropdl-target"`. That explains both why artifacts land
outside the repo and why the committed `src-tauri/target/` is stale (§7). Make it relative
(`target-dir = "target"`) or drop the file so other machines and CI work.

**Why the installers are large:** the bundled sidecars total ~330 MB uncompressed — `ffmpeg` 156.7 MB,
`ffprobe` 156.5 MB, `yt-dlp` 17 MB (`src-tauri/bin/`). MSI and NSIS bundle the same sidecars; either
installs the same app.
