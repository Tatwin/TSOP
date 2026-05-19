# Building TASMAC POS Desktop App

## Prerequisites

- Node.js 18+ (LTS recommended)
- npm or yarn
- Windows: Visual Studio Build Tools (for better-sqlite3 native compilation)
- macOS: Xcode Command Line Tools
- Linux: build-essential, python3

## Quick Build (Windows)

```bash
# 1. Install all dependencies
cd electron
npm install

# 2. Build the frontend first
cd ../frontend
npm install
npm run build

# 3. Build the installer
cd ../electron
npm run build:win
```

Output: `dist-electron/TASMAC POS 1745-2.0.0-win-x64.exe` (NSIS installer)

## Build Commands

| Command | Output | Description |
|---------|--------|-------------|
| `npm run build:win` | NSIS installer + Portable | Windows x64 + ia32 |
| `npm run build:win-portable` | Portable .exe only | No install needed |
| `npm run build:mac` | .dmg | macOS x64 + arm64 (Apple Silicon) |
| `npm run build:linux` | AppImage + .deb | Linux x64 |
| `npm run build:all` | All platforms | Full cross-platform build |
| `npm run pack` | Unpacked directory | For testing (fast) |

## Development

```bash
# Terminal 1: Start frontend dev server
cd frontend
npm run dev

# Terminal 2: Start Electron in dev mode
cd electron
npm run dev
```

In dev mode:
- Frontend loads from Vite dev server (localhost:5173)
- Hot reload works
- DevTools open automatically
- Backend runs embedded in Electron process

## Native Module Rebuilding

If `better-sqlite3` fails to load after Electron version change:

```bash
cd electron
npm run rebuild
```

Or manually:
```bash
npx electron-rebuild -f -w better-sqlite3
```

## Installer Features

### Windows NSIS Installer:
- Custom installation directory
- Desktop shortcut (TASMAC POS 1745)
- Start Menu shortcut
- Auto-creates Documents/TSOP_Backups folder
- Uninstaller (keeps user data!)
- Registry entries for proper uninstall

### Windows Portable:
- Single .exe file
- Runs from any location (USB, Desktop)
- Data stored in `%APPDATA%/tasmac-pos-desktop`
- No admin rights needed

## Auto-Updater

The app checks GitHub Releases for updates:
1. Publishes to: `github.com/Tatwin/TSOP/releases`
2. Creates a release with tag `v2.0.0`
3. Uploads built installer as release asset
4. App auto-detects and downloads update

To publish an update:
```bash
# Bump version in package.json
# Then build and publish
npm run build:win
# Upload .exe to GitHub Release
```

## User Data Locations

| OS | Path |
|----|------|
| Windows | `%APPDATA%\tasmac-pos-desktop\` |
| macOS | `~/Library/Application Support/tasmac-pos-desktop/` |
| Linux | `~/.config/tasmac-pos-desktop/` |

Contents:
- `tasmac-pos.db` - SQLite database
- `backups/` - Auto-backup .db files
- `logs/` - Application logs

## Troubleshooting

### "better-sqlite3 was compiled against a different Node.js version"
```bash
npm run rebuild
```

### "App shows white screen on start"
- Ensure frontend was built: `cd frontend && npm run build`
- Check `frontend/dist/index.html` exists

### "Cannot find module" errors in production build
- Check `extraResources` in package.json includes all needed files
- Verify `asar` is not packaging native modules incorrectly

### Building on another machine
1. Clone the repo
2. `npm run install:all` (from root)
3. `cd electron && npm run rebuild`
4. `npm run build:win`
