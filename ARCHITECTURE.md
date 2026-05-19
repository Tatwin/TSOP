# TASMAC POS - Architecture Guide

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   ELECTRON DESKTOP APP                    │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐             │
│  │  React   │  │ Express  │  │  SQLite   │             │
│  │ Frontend │◄─┤ Backend  ├──┤  (local)  │             │
│  │ (Vite)   │  │ (API)    │  │           │             │
│  └──────────┘  └──────────┘  └───────────┘             │
│                                    │                     │
│  ┌──────────────┐  ┌──────────────┼──────────────┐     │
│  │ Auto Backup  │  │  Firebase Sync Service      │     │
│  │ (6-hourly)   │  │  (push changes to cloud)   │     │
│  └──────────────┘  └──────────────┼──────────────┘     │
│                                    │                     │
└────────────────────────────────────┼─────────────────────┘
                                     │
                                     ▼
                          ┌─────────────────────┐
                          │  Firebase Firestore  │
                          │  (Cloud Database)    │
                          └──────────┬──────────┘
                                     │
                                     ▼
                          ┌─────────────────────┐
                          │   Web Dashboard     │
                          │  (Vercel/Firebase   │
                          │   Hosting)          │
                          │  READ-ONLY access   │
                          └─────────────────────┘
```

## Data Flow

### Desktop App (Primary - Read/Write)
1. User interacts with React frontend
2. React calls Express backend API (localhost:5000)
3. Express reads/writes to JSON file (data/store.json) OR SQLite
4. Changes are queued for Firebase sync
5. Sync service pushes changes to Firestore every 5 minutes

### Web Dashboard (Secondary - Read Only)
1. Web app reads from Firebase Firestore
2. Shows daily summaries, analytics, stock levels
3. Cannot modify data (all writes come from desktop only)

## Storage Layers

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Primary (Desktop) | SQLite via better-sqlite3 | Fast local storage, ACID transactions, survives restarts |
| Backup (Desktop) | JSON file (store.json) | Express API compatibility, legacy support |
| Cloud Mirror | Firebase Firestore | Web dashboard access, multi-device viewing |
| Auto Backup | SQLite .db copies | Scheduled backups, 7-day retention |

## Authentication

| Role | PIN | Desktop Access | Web Access |
|------|-----|---------------|------------|
| Admin | 1974 | Full (all features) | Full read |
| Operator | 1745 | Data entry + export | Read only |
| Viewer | (none) | Read only | Read only |

## Key Components

### Electron (`/electron/`)
- `main.js` - Main process: window, IPC handlers, lifecycle
- `preload.js` - Context bridge for secure IPC
- `src/database/` - SQLite schema + data access layer
- `src/backup/autoBackup.js` - Scheduled backup service
- `src/firebase/config.js` - Firebase Admin SDK setup
- `src/firebase/syncService.js` - Queue-based cloud sync

### Backend (`/backend/`)
- Express API server (runs standalone OR embedded in Electron)
- JSON file persistence (data/store.json)
- All routes work independently of Electron

### Frontend (`/frontend/`)
- React 18 + Vite
- Works with both Express API (web) and Electron IPC (desktop)
- Same UI for both desktop and web

## Running Modes

### Mode 1: Desktop App (Electron)
```bash
cd electron
npm install
npm start
```
- SQLite database in user's app data folder
- Express backend embedded as child process
- Firebase sync (optional, requires serviceAccount.json)
- Auto-backup every 6 hours

### Mode 2: Web App (Standalone)
```bash
# Backend
cd backend && npm install && npm run dev

# Frontend
cd frontend && npm install && npm run dev
```
- JSON file persistence (backend/data/store.json)
- No SQLite, no Electron
- Deploy to Vercel (frontend) + Render (backend)

### Mode 3: Web Dashboard (Firebase)
```bash
cd frontend && npm run build
firebase deploy
```
- Reads from Firebase Firestore (synced by desktop app)
- Read-only dashboard for remote monitoring

## Firebase Setup (Optional)

1. Create Firebase project at https://console.firebase.google.com
2. Enable Firestore Database
3. Generate Service Account key (Project Settings > Service Accounts)
4. Save as `electron/src/firebase/serviceAccount.json`
5. Enable sync: Settings > Firebase Sync > Enable

## Building Desktop App

```bash
cd electron

# Windows
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux

# All platforms
npm run build:all
```

Output: `dist-electron/` folder with installer

## Auto Backup Details

- Runs every 6 hours (configurable)
- Uses SQLite's built-in backup API (consistent snapshot)
- Keeps last 28 backups (7 days × 4/day)
- Auto-cleans older backups
- Manual backup always available from UI
- Stored in: `{userData}/backups/`

## Sync Queue Strategy

1. Every write to SQLite adds to `sync_queue` table
2. Sync service processes queue every 5 minutes
3. Failed items retry on next cycle
4. Successfully synced items marked and cleaned after 7 days
5. If offline, queue grows until reconnection
6. Firebase is OPTIONAL - app works 100% offline
