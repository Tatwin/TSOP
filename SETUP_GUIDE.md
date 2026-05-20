# TASMAC POS - Setup & Running Guide

## Quick Start

```bash
# 1. Install dependencies
cd backend && npm install
cd ../frontend && npm install

# 2. Delete old database (if PINs not working)
# Delete: backend/data/tasmac.db, tasmac.db-wal, tasmac.db-shm

# 3. Start backend
cd backend && npm run dev

# 4. Start frontend (in another terminal)
cd frontend && npm run dev
```

Backend runs at: http://localhost:5000
Frontend runs at: http://localhost:5173

---

## Login PINs

| Role | PIN | Access Level |
|------|-----|-------------|
| **Admin** | `1974` | Full access - manage users, backup, products, everything |
| **Operator** | `1745` | Data entry, save, export - no user/backup management |
| **Viewer** | *(no PIN needed)* | Click "Continue without PIN" on login page |

---

## What Happens When You Run `npm run dev` in Backend

```bash
cd backend
npm run dev   # which runs: node src/index.js
```

### Startup Sequence:

```
1. [Database] SQLite initialized at backend/data/tasmac.db
   - Creates tasmac.db file if it doesn't exist
   - Creates 10 tables (users, products, daily_entries, etc.)
   - Seeds default users (Admin PIN 1974, Operator PIN 1745)
   - Enables WAL mode for performance
   - Runs integrity check

2. [Startup] Database status: healthy
   - Checks if DB is corrupted
   - Auto-repairs or restores from backup if needed

3. TASMAC POS Backend v2.0 running on port 5000
   - Express server listening on http://localhost:5000
   - All API routes available
   - Auto-backup timer starts (30-min intervals)
```

### What's Actually Running:

| Service | What It Does | Where |
|---------|-------------|-------|
| **Express Server** | HTTP API for frontend | Port 5000 |
| **SQLite Database** | Stores ALL data | `backend/data/tasmac.db` |
| **Auto Backup** | Creates .db copies every 30 min | `backend/data/backups/` |
| **Audit Logger** | Tracks all changes | Inside SQLite |
| **Notifications** | Generates alerts | Computed on-demand |

---

## SQLite Database

### Location
```
backend/data/tasmac.db       ← Main database file
backend/data/tasmac.db-wal   ← Write-Ahead Log (performance)
backend/data/tasmac.db-shm   ← Shared memory (performance)
```

### What's Inside (Tables)

| Table | Purpose |
|-------|---------|
| `users` | Admin/Operator accounts with PINs |
| `staff` | Salesmen and supervisors list |
| `products` | Product catalog (if customized) |
| `categories` | Product categories |
| `daily_entries` | Daily sales data (JSON per date) |
| `denominations` | Cash denomination data per date |
| `audit_logs` | Every action tracked (who/what/when) |
| `pending_sync` | Queue for Firebase sync |
| `backups` | Backup history metadata |
| `settings` | App configuration |

### How Data is Stored

Daily entries and denominations are stored as **JSON text** in SQLite:
```sql
-- Each date = one row with all data in JSON
daily_entries:
  date: "2026-05-20"
  data: '{"entries":[...],"metadata":{},"posAmount":500,...}'
```

This gives the best of both worlds:
- **SQLite reliability** (ACID, crash-safe, WAL mode)
- **Flexible JSON structure** (same as old store.json format)

### If Database Gets Corrupted

The system auto-recovers:
1. Detects corruption on startup (integrity check)
2. Attempts repair (dump + reimport)
3. If repair fails, restores from latest backup
4. Creates crash-recovery backup before any repair

### Manual Reset

If PINs stop working or data seems wrong:
```bash
# Delete the database (will be recreated fresh)
rm backend/data/tasmac.db
rm backend/data/tasmac.db-wal
rm backend/data/tasmac.db-shm

# Restart backend
cd backend && npm run dev
```

Fresh database will have:
- Admin (PIN: 1974)
- Supervisor (PIN: 1745)
- Default staff list
- Default settings

---

## Firebase (Optional - For Web Dashboard)

### Firebase is NOT Required

The app works **100% without Firebase**. Firebase is only needed if you want:
- Remote web dashboard access (from phone/another PC)
- Cloud backup of data

### Current Status Without Firebase

```
[Firebase] No service account found. Cloud sync disabled.
[Firebase] App will continue in offline-only mode.
```

This is NORMAL. The app works perfectly.

### How to Enable Firebase (Later, When Needed)

See `FIREBASE_SYNC_GUIDE.md` for full instructions. Summary:

1. Create Firebase project at console.firebase.google.com
2. Enable Firestore Database
3. For **desktop sync**: Download service account key → save as `electron/src/firebase/serviceAccount.json`
4. For **web dashboard**: Add to `frontend/.env`:
   ```
   VITE_FIREBASE_PROJECT_ID=your-project-id
   VITE_FIREBASE_API_KEY=your-key
   VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   ```
5. Install Firebase SDK: `cd frontend && npm install firebase`

### What Firebase Does (When Enabled)

```
Desktop App saves data → SQLite (immediate, local)
                       → Sync Queue (pending_sync table)
                       
Every 5 minutes:
  Sync Service reads queue → pushes to Firebase Firestore
                           → marks items as synced

Web Dashboard reads from Firebase Firestore (read-only)
```

**Data flow is ONE-WAY: Desktop → Firebase → Web**
Web dashboard can NEVER modify data.

---

## Backups

### Automatic Backups

- Created every **30 minutes** automatically
- Uses `VACUUM INTO` (safe even during active writes)
- Stored in: `backend/data/backups/`
- Keeps last **20** auto-backups (older ones auto-deleted)

### Manual Backup

From the app: **Backup & Restore** page → "Create Backup Now"

Or via API:
```bash
curl -X POST http://localhost:5000/api/backup/create \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"label": "my-backup"}'
```

### Restore from Backup

From the app: **Backup & Restore** page → select backup → "Restore"

---

## API Endpoints (for reference)

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/auth/login` | POST | No | Login with PIN |
| `/api/daily-entry/:date` | GET | No | Get entries for a date |
| `/api/daily-entry/:date` | POST | Yes | Save entries |
| `/api/denomination/:date` | GET | No | Get denomination |
| `/api/denomination/:date` | POST | Yes | Save denomination |
| `/api/products` | GET | No | List all products |
| `/api/dashboard/today` | GET | No | Today's summary |
| `/api/dashboard/analytics` | GET | No | 30-day analytics |
| `/api/dashboard/top-days` | GET | No | Top 5 sales days |
| `/api/audit/logs` | GET | No | Activity logs |
| `/api/backup/list` | GET | Yes | List backups |
| `/api/backup/create` | POST | Yes | Create backup |
| `/api/notifications` | GET | No | Active alerts |
| `/api/health` | GET | No | System health |

---

## Troubleshooting

### "Invalid PIN" for 1974 or 1745

**Cause:** SQLite database was created with old PIN data.

**Fix:**
```bash
rm backend/data/tasmac.db backend/data/tasmac.db-wal backend/data/tasmac.db-shm
# Restart backend
```

### "Cannot find module 'better-sqlite3'"

The backend uses system `sqlite3` CLI (not the npm package). It should work on any system with `sqlite3` installed.

Check: `sqlite3 --version`

If not installed:
- **Windows:** Download from https://sqlite.org/download.html (add to PATH)
- **Mac:** Already included (`brew install sqlite3`)
- **Linux:** `sudo apt install sqlite3`

### "Port 5000 already in use"

Another process is using port 5000. Kill it or change the port:
```bash
# Change port
PORT=5001 node src/index.js

# Or find and kill the process
# Windows:
netstat -ano | findstr :5000
taskkill /PID <pid> /F

# Mac/Linux:
lsof -i :5000
kill -9 <pid>
```

### Frontend shows "Network Error" or "Failed to fetch"

Make sure the backend is running on port 5000:
```bash
curl http://localhost:5000/api/health
# Should return: {"status":"ok",...}
```

### "CORS error" in browser console

The backend allows all origins by default. If you see CORS errors, make sure you're accessing the frontend via `http://localhost:5173` (not `file://`).

---

## File Structure Summary

```
TSOP/
├── backend/
│   ├── data/
│   │   ├── tasmac.db          ← SQLite database (all data)
│   │   ├── tasmac.db-wal      ← WAL file (auto-created)
│   │   ├── backups/           ← Auto & manual backups
│   │   └── store.json         ← Legacy (migrated to SQLite)
│   ├── src/
│   │   ├── index.js           ← Express server entry point
│   │   ├── middleware/
│   │   │   ├── auth.js        ← JWT + RBAC
│   │   │   └── security.js    ← Rate limit, headers, validation
│   │   ├── routes/            ← All API endpoints
│   │   └── services/
│   │       ├── database.js    ← SQLite operations (883 lines)
│   │       ├── fileStore.js   ← Wrapper (same API as before)
│   │       ├── auditService.js← Audit logging
│   │       └── reliability.js ← Health checks, repair
│   └── package.json
├── frontend/
│   ├── src/                   ← React app
│   └── package.json
├── electron/                  ← Desktop app (for later)
│   ├── main.js               ← Electron main process
│   └── package.json
├── ARCHITECTURE.md            ← System design docs
├── FIREBASE_SYNC_GUIDE.md     ← Firebase setup guide
└── SETUP_GUIDE.md             ← This file
```
