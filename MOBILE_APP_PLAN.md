# DropDL Mobile App Plan

Goal: ship DropDL on Android & iOS in addition to the existing Tauri desktop app, reusing the
existing React + Vite + Zustand frontend (`src/`) and Rust backend (`src-tauri/`) as much as possible.

## 1. Current State

- Frontend: React 19 + TypeScript + Tailwind 4 + Zustand (`src/`).
- Desktop: Tauri v1 (`src-tauri/`), Rust backend spawns yt-dlp / ffmpeg / ffprobe sidecars.
- Persistence: `config.json` in the OS app-data dir (`src/services/persistenceService.ts`),
  atomic write + localStorage fallback for non-Tauri runtimes.
- Native calls go through `window.__TAURI__` (`src/services/tauriService.ts`,
  `persistenceService.ts`) — needs a platform abstraction layer.

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
- [ ] Create `src/services/platform/` abstraction with `desktop` / `mobile` / `web` implementations.
- [ ] Remove all direct `window.__TAURI__` usage; import from `@tauri-apps/api`.
- [ ] Upgrade `@tauri-apps/api`, `@tauri-apps/cli`, and the `tauri` crate to 2.x; turn off `withGlobalTauri`.
- [ ] Persistence already hardened (atomic write, validation, salvage migration, web fallback).

### Phase 1 — Desktop regression check (3 days)
- [ ] Verify desktop build / analyze / download / persistence still work after v2 migration.
- [ ] Confirm `config.json` is written on first launch (fs scope now includes `$APPDATA`).

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
- [ ] CI: GitHub Actions — `tauri android build` (AAB), `tauri ios build` (IPA), desktop builds.
- [ ] Signing: Play Store AAB + keystore; TestFlight → App Store.
- [ ] Store assets: icons (`tauri icon`), screenshots.

## 4. Risks

- yt-dlp is effectively blocked in iOS App Store builds → server-relay mode is the fallback.
- ffmpeg per-ABI binaries add ~30–80 MB per app.
- iOS background-download time limits may cap long downloads.
- Tauri v2 migration may surface plugin permission changes requiring desktop retesting.

## 5. Config Schema v2 — do this BEFORE Phase 2

Mobile amplifies existing `config.json` gaps. Migrating once (rather than once for desktop and
again for mobile) keeps a single schema history.

- [ ] Add `filePath` to each history entry (needed for *Open file* / *Share sheet* on mobile).
- [ ] Persist the active `queue` — it is dropped on restart today, so a paused task is lost.
- [ ] Add `settings.downloads.defaultContainer` + `defaultAudioFormat` (no "always MP4" default today).
- [ ] Write back `ytdlp.executablePath` / `lastChecked` and `ffmpeg.ffmpegPath` / `ffprobePath`
      (a version is stored alongside a blank path today).
- [ ] Collapse the three folder sources (`settings.downloads.defaultFolder`,
      `paths.lastDownloadFolder`, `paths.favoriteFolders[0]`) into one source of truth.
- [ ] Add a real `migrate(fromVersion, data)` step — a version mismatch only logs a warning today.

### Bundle identifier — resolve before scaffolding

Desktop uses `com.dropdl.desktop` (`src-tauri/tauri.conf.json`) while this plan proposes
`com.dropdl.app`. The identifier determines the app-data directory (`config.json`, `bin/`), so a
mismatch means two settings stores and no carry-over between platforms. Pick one id and add a
one-time migration.

### Platform-correct config location (already handled by `appDataDir()`)

| Platform | `config.json` location                              |
|----------|-----------------------------------------------------|
| Windows  | `%APPDATA%\<bundle-id>\config.json`                 |
| Android  | app-private `filesDir`                              |
| iOS      | `Application Support`                               |

## 6. Robustness Fixes Already Landed

- yt-dlp prints approximate totals as `of ~  44.31MiB`; the lone `~` token previously parsed to 0
  so the UI showed `0 B`. Totals now take the first token that parses to a real size.
- Container / audio-codec is whitelisted in `start_download`; unknown or stale values fall back to
  yt-dlp defaults instead of emitting an invalid flag.
- `load_config` tolerates a UTF-8 BOM (a hand-edited file previously failed with
  `expected value at line 1 column 1`).
- Playlist/batch downloads now inherit the current container + quality selection instead of
  hardcoding `MP4` / `1080p`.
