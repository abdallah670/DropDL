<div align="center">

# DropDL

**A desktop GUI for `yt-dlp` and FFmpeg** — download videos, audio and entire playlists with a
real download queue, live progress, and a fully bundled engine.

![Platform](https://img.shields.io/badge/platform-Windows%2010%2F11%20x64-0078D6?logo=windows)
![License](https://img.shields.io/badge/license-MIT-green)
![Tauri](https://img.shields.io/badge/Tauri-v1.5-24C8DB?logo=tauri)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)

</div>

---

## ⬇️ Download & Install (Windows)

Grab one of these from the [**Releases**](../../releases) page:

| File | Size | What it is |
|------|------|------------|
| **`DropDL_1.0.0_x64_en-US.msi`** | 141.5 MB | **Recommended.** Standard Windows installer. Installs to `C:\Program Files\DropDL` and adds a Start Menu entry. Requires admin permission (UAC prompt). |
| `DropDL_1.0.0_x64-setup.exe` | 108 MB | The same app packaged as an NSIS installer — smaller download, friendlier for per-user installs. |

**Both installers are complete** — the download engine (`yt-dlp`, `FFmpeg`, `FFprobe`) is packed
inside them. You do **not** need to install Python, `yt-dlp`, or FFmpeg yourself, and you do not
need to edit your `PATH`.

### Steps

1. Download either installer from the Releases page.
2. Run it and follow the prompts (the MSI asks for admin rights).
3. Launch **DropDL** from the Start Menu.
4. Open **Settings → Dependencies** — `yt-dlp` and `FFmpeg` should both show as detected, with a
   version number. If they say *"Not found"*, the install did not complete correctly.

> **Windows SmartScreen:** release builds are not code-signed, so Windows may show
> *"Windows protected your PC"*. Click **More info → Run anyway**. You can verify the download
> against the SHA-256 checksum published in the release notes.

### Requirements

- Windows 10 or 11, 64-bit
- [WebView2 runtime](https://developer.microsoft.com/microsoft-edge/webview2/) — already present on
  Windows 11 and virtually all up-to-date Windows 10 systems
- ~350 MB of free disk space after installation
---

## ✨ Features

### Download
- Paste a video or playlist URL and get metadata, thumbnail, uploader, duration and view count.
- **Quality presets** — best available, 2160p, 1440p, 1080p, 720p, 480p — or pick exact streams in
  the advanced format explorer.
- **Audio-only mode** — MP3, M4A, Opus, FLAC or WAV (via FFmpeg), with bitrate/quality choice
  (Best VBR, 320, 256, 192, 128 kbps).
- **Container choice** — MP4, WebM or MKV, with an optional "index prefixes" mode that names
  playlist files `01 - Title.mp4`, `02 - …`.
- **Filename presets** — Title, Title + Uploader, Uploader + Title, Title + Date, Playlist № + Title,
  or an advanced custom yt-dlp output template with live preview. Windows-invalid characters are
  stripped automatically and path traversal is rejected.
- **Subtitles** — manual and/or automatic (generated) subtitles, chosen languages or all available,
  SRT/VTT/ASS formats, embed into the video or save as separate files. Embedding is not supported
  for WebM; DropDL warns you instead of failing silently.
- **Metadata & thumbnails** — embed metadata, embed/download thumbnail, write description,
  info JSON, comments and chapters (yt-dlp/FFmpeg do the work, nothing is re-implemented).
- Live progress with percentage, downloaded/total bytes, speed and ETA.

### Playlists
- Whole-playlist analysis in a few seconds (uses yt-dlp's flat-playlist manifest rather than
  fetching full metadata for every video).
- Video list with thumbnails, durations and uploaders; select individually, use a range
  (`1-3, 5, 8-10`), *Select all* / *Invert*.
- **Batch quality & container** applied to exactly the videos you ticked.
- **Only the selected videos are queued** — never the whole playlist.

### Queue
- Configurable **concurrent downloads**; the rest wait their turn.
- Pause / resume individual tasks, cancel a task, **Cancel All**, **Retry** one, **Retry All**,
  **Retry Failed**, reorder the queue (move up/down), and clear completed.
- Cancelling kills the whole process tree (`yt-dlp` **and** its `ffmpeg` children), so downloads
  really stop.
- Completed tasks show the real file size and a **Show in folder** action (final size is verified
  with FFprobe, so it is correct even when yt-dlp only reports an approximate total).
- **The queue survives restarts.** Tasks still in progress are restored as *paused*; press
  *Resume* and yt-dlp continues from the existing `.part` files instead of re-downloading.

### History, logs and settings
- **History** of finished downloads with size, time and destination path, plus **Open file**,
  **Copy URL**, **Download again**, **Show in folder** and per-item removal. History never stores
  cookies or credentials.
- Friendly **error categories** — invalid URL, video unavailable, private/age-restricted,
  authentication required, geo-restriction, rate limited, network failure, FFmpeg failure and more —
  each explaining what happened, why, and what to try. The raw yt-dlp output stays available in the
  per-task log view.
- **Logs** page with per-task yt-dlp output for troubleshooting.
- **Settings** for theme, language, notifications, clipboard monitoring, default folder,
  concurrency, retries, overwrite behaviour, default container/audio format, and binary paths.
- **Network & Auth** — proxy (http/https/socks4/socks5, validated), download speed limit
  (Unlimited / KB/s / MB/s), cookies from a browser profile or a Netscape cookies.txt file.
  Cookies stay on your disk and are never uploaded or logged.
- **Settings → Engine** shows the bundled yt-dlp/FFmpeg versions, checks for yt-dlp updates and can
  install the latest official release safely: the download is validated with `--version` before it
  replaces anything, and a failed update can never corrupt the working binary.
- **Settings → Dependencies** verifies the bundled engine and reports versions.

### Privacy
Everything runs locally. No account, no telemetry, no server in the middle — DropDL only drives
`yt-dlp`/FFmpeg on your own machine and writes files where you tell it to.
---

## 🗂️ Where DropDL stores its data

All state lives in the app-data folder `%APPDATA%\com.dropdl.desktop\`:

| File | Contents |
|------|----------|
| `settings.json` | App settings and folder paths |
| `history.json` | Completed downloads (path, size, time) |
| `queue.json` | Work still in the queue (waiting, paused, failed, cancelled) |


Each file is written atomically (temp file + rename), so an interrupted write cannot corrupt your
queue or history. Your download queue is restored on the next launch.

---

## 🔧 Build from source

### Prerequisites

- **Node.js** 18+ — [nodejs.org](https://nodejs.org)
- **Rust** (stable) — [rustup.rs](https://rustup.rs)
- **Microsoft C++ Build Tools** — "Desktop development with C++" workload
  (see [Tauri prerequisites](https://tauri.app/v1/guides/getting-started/prerequisites))
- WebView2 runtime (see above)

### Download engine

Source clones and CI runners fetch the engine (~330 MB total) instead of
committing it — GitHub rejects single files over 100 MB on a normal push.
Download, then rename **exactly** as follows in `src-tauri/bin/`:

| File in `src-tauri/bin/` | Version as of v1.0.0 | Get it from |
|---|---|---|
| `yt-dlp-x86_64-pc-windows-msvc.exe` (17 MB) | 2026.08.19 | [yt-dlp releases](https://github.com/yt-dlp/yt-dlp/releases) → `yt-dlp.exe`, renamed |
| `ffmpeg-x86_64-pc-windows-msvc.exe` (157 MB) | N-126537 (2026-09-13) | [gyan.dev FFmpeg builds](https://www.gyan.dev/ffmpeg/builds/) → `ffmpeg-git-full.7z` → `bin\ffmpeg.exe`, renamed |
| `ffprobe-x86_64-pc-windows-msvc.exe` (157 MB) | N-126537 (2026-09-13) | Same archive → `bin\ffprobe.exe`, renamed |

```powershell
# from the repo root, verify the engine is in place:
Get-ChildItem src-tauri\bin\*.exe
.\src-tauri\bin\yt-dlp-x86_64-pc-windows-msvc.exe --version
```

Tauri picks these up through `externalBin` in `src-tauri/tauri.conf.json` and installs them next
to the app — that is what makes the installers ~141 MB.

### Commands

```bash
npm install            # once

npm run dev            # frontend only, in a browser (no downloads — UI preview)
npm run desktop:dev    # full app in a native window, with hot reload

npm run desktop:build  # release build + installers
```

Useful build variants:

```bash
npx tauri build --debug                    # debug build, much faster to compile
npx tauri build --bundles msi              # skip the NSIS installer step
npx tauri build --debug --bundles msi      # fastest way to get an installable test MSI
npm run lint                               # TypeScript check only (tsc --noEmit)
```

### Where the installers are written

```
<target-dir>/release/bundle/msi/DropDL_1.0.0_x64_en-US.msi
<target-dir>/release/bundle/nsis/DropDL_1.0.0_x64-setup.exe
```

`<target-dir>` defaults to `src-tauri/target/`. **Note:** this repository currently pins a custom
target directory in `src-tauri/.cargo/config.toml`:

```toml
[build]
target-dir = "C:/Users/{User}/AppData/Local/Temp/dropdl-target"
```

That path is machine-specific. On your own machine delete that file (or point it at a local
folder) so cargo builds into the default `src-tauri/target/` — otherwise the build will fail if
`C:\Users\{User}` is not writable.

The first release build takes several minutes (dependency compilation plus ~330 MB of sidecars to
package). Debug builds are dramatically faster.

---

## DropDL v1.1.0

### What's new in 1.1.0
- **Every option is now real**: subtitles, metadata, thumbnails, chapters, proxy, cookies, speed
  limit, overwrite mode and audio bitrate are all passed to yt-dlp/FFmpeg (previously some settings
  existed in the UI without reaching the download engine).
- yt-dlp **update checker** and safe self-update (Settings → Engine) with validation and rollback.
- **Filename presets** and custom output templates with live preview.
- Queue **reordering**, **Retry Failed**, and richer history actions (Open file, Copy URL,
  Download again).
- Expanded friendly **error categories** and per-download network/auth context (proxy and cookies
  are applied at analysis time too).

## DropDL v1.0.0

Downloads for Windows 10/11 (64-bit):

- `DropDL_1.0.0_x64_en-US.msi` (141.5 MB) — recommended
- `DropDL_1.0.0_x64-setup.exe` (108 MB) — smaller, per-user install

Both installers include yt-dlp, FFmpeg and FFprobe — no extra setup required.

SHA-256:
  <checksum>  DropDL_1.0.0_x64_en-US.msi
  <checksum>  DropDL_1.0.0_x64-setup.exe
```

Generate the checksums with:

```powershell
Get-FileHash .\DropDL_1.0.0_x64_en-US.msi   -Algorithm SHA256
Get-FileHash .\DropDL_1.0.0_x64-setup.exe  -Algorithm SHA256
```

Notes:
- Each asset must be under GitHub's 2 GB per-file limit — at 141.5 MB you are far below it. (That
  limit applies to *Release* assets; files committed into the repository should stay far smaller,
  which is exactly why installers belong in a Release rather than in the repo.)
- Attach the files to the Release itself; never commit an installer to the repository, or every
  clone drags ~250 MB of binaries through Git history forever. `.gitignore` now explicitly excludes
  `*.msi` and `DropDL_*-setup.exe`, so an installer sitting next to your working copy can no longer
  be committed by accident.
- The `version` in `src-tauri/tauri.conf.json` (`1.0.0`) determines the installer filenames — bump it
  for each release and keep the Release tag in step (`v1.0.0`).
- GitHub will not let you re-upload an asset with a name that already exists in that Release. Bump
  the version, or delete the old asset first.

---

## 🧱 Tech stack

| Layer | Technology |
|-------|------------|
| UI | React 19, TypeScript 5.8, Tailwind CSS 4, Zustand (state), lucide-react (icons) |
| Shell | Tauri v1.5 (Rust) with a single webview |
| Engine | `yt-dlp` + `FFmpeg`/`FFprobe`, bundled as Tauri sidecars and spawned as child processes |
| Build | Vite 6, Cargo |
| Persistence | Three atomic JSON files in the OS app-data folder, with a `localStorage` fallback for browser preview |

---

## ⚠️ Known limitations

- **Windows only.** macOS and Linux bundles are not configured yet.
- Installers are **unsigned** (SmartScreen warning on first run).
- Advanced settings such as proxy, cookies source and speed limits are stored in the UI but are
  **not yet passed to the download engine**.
- Some sites require login or cookies that DropDL does not yet provide, so `yt-dlp` may report that
  a video is unavailable.

---

## ⚖️ Legal

DropDL is a front end for [yt-dlp](https://github.com/yt-dlp/yt-dlp) and
[FFmpeg](https://ffmpeg.org/). It does not host, index or redistribute any media. Use it only for
content you are entitled to download, and respect the terms of service of any site you use and the
copyright laws that apply to you. The authors are not responsible for how this tool is used.

---

## 📄 License

MIT (see `license` in `src-tauri/Cargo.toml`). Bundled `yt-dlp` and FFmpeg binaries keep their own
licenses — FFmpeg in particular is distributed under LGPL/GPL terms.
