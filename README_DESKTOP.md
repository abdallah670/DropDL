# DropDL — Desktop yt-dlp & FFmpeg Studio

## 1. Why Was It Simulated in the Browser?
A standard web browser runs in a sandbox: websites cannot execute terminal commands (`yt-dlp` or `ffmpeg`) or write arbitrary files directly to your hard drive (`C:\Downloads` or `/Users/...`).

Because of this security boundary, **in the browser preview DropDL runs a realistic simulation fallback** so you can preview the complete UI, inspect formats, test filters, preview exact command arguments, and configure settings.

**When running as a Desktop App**, DropDL detects the desktop runtime and **directly executes `yt-dlp` and `FFmpeg`** on your machine via native IPC process spawning.

---

## 2. How to Build the Native Desktop App (.exe, .dmg, or Linux App)

DropDL is pre-configured with **Tauri** (Rust-based, ultra-lightweight ~15MB executable with near-zero RAM usage).

### Step 1: Install Prerequisites (One-time)
1. **Node.js**: [https://nodejs.org](https://nodejs.org) (v18 or newer)
2. **Rust**: [https://rustup.rs](https://rustup.rs)
   - Windows: run `rustup-init.exe`
   - macOS / Linux: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
3. **yt-dlp & FFmpeg** installed on your system PATH:
   - **Windows**: `winget install yt-dlp` and `winget install Gyan.FFmpeg`
   - **macOS**: `brew install yt-dlp ffmpeg`
   - **Linux**: `sudo apt install yt-dlp ffmpeg`

### Step 2: Run in Desktop Development Mode
Export or clone this project folder, open a terminal in the folder, and run:
```bash
npm install
npm run desktop:dev
```
A native desktop window will launch, connected directly to your system's `yt-dlp` and `ffmpeg` binaries!

### Step 3: Build the Final Installer
To produce the release installer (`.exe` / `.msi` on Windows, `.dmg` on macOS, `.deb`/`AppImage` on Linux):
```bash
npm run desktop:build
```
The output installers will be in:
`src-tauri/target/release/bundle/`

---

## 3. Alternative: Electron (Pure Node.js)
If you prefer not to install Rust, you can also wrap the same React build in Electron:
```bash
npm install -D electron electron-builder
```
In Electron's `main.js`, spawn commands using `child_process.spawn("yt-dlp", args)`.
