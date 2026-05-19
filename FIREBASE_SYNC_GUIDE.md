# Firebase Sync & Backup Guide - TASMAC POS

## Overview

This guide explains how to set up **bidirectional data sync** between the Desktop App (SQLite) and Web Dashboard (Firebase Firestore), including consistent backups and delayed data propagation.

---

## Architecture: How Data Flows

```
┌────────────────────────────────────────────────────────────────┐
│                     DESKTOP APP (Source of Truth)                │
│                                                                  │
│   User Action → Express API → SQLite Database                   │
│                                    │                             │
│                                    ▼                             │
│                         ┌─────────────────────┐                 │
│                         │    SYNC QUEUE TABLE  │                 │
│                         │  (pending changes)   │                 │
│                         └──────────┬──────────┘                 │
│                                    │                             │
│                         Every 5 minutes (configurable)           │
│                                    │                             │
│                         ┌──────────▼──────────┐                 │
│                         │   SYNC SERVICE      │                 │
│                         │  (processes queue)   │                 │
│                         └──────────┬──────────┘                 │
│                                    │                             │
└────────────────────────────────────┼─────────────────────────────┘
                                     │
                                     │ Push (Firebase Admin SDK)
                                     ▼
                          ┌─────────────────────┐
                          │  FIREBASE FIRESTORE  │
                          │   (Cloud Mirror)     │
                          └──────────┬──────────┘
                                     │
                                     │ Read (Firestore SDK)
                                     ▼
                          ┌─────────────────────┐
                          │   WEB DASHBOARD     │
                          │   (Read-Only)       │
                          └─────────────────────┘
```

### Key Principle: Desktop is Source of Truth

- **Desktop App** = READ + WRITE (primary data entry happens here)
- **Web Dashboard** = READ ONLY (view data synced from desktop)
- **Firebase** = Mirror/Cache (not the primary database)

---

## Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Add Project"**
3. Enter project name: `tasmac-pos-1745`
4. Disable Google Analytics (not needed)
5. Click **Create Project**

---

## Step 2: Enable Firestore Database

1. In Firebase Console → **Build** → **Firestore Database**
2. Click **Create Database**
3. Choose **Production mode**
4. Select region: `asia-south1` (Mumbai - closest to Coimbatore)
5. Click **Enable**

---

## Step 3: Generate Service Account Key

This is how the desktop app authenticates with Firebase (server-to-server, no user login needed).

1. Firebase Console → **Project Settings** (gear icon)
2. Go to **Service Accounts** tab
3. Click **"Generate New Private Key"**
4. A JSON file downloads — this is your service account key

### Save the key:

```bash
# Copy downloaded file to:
cp ~/Downloads/your-project-firebase-adminsdk-xxxxx.json \
   TSOP/electron/src/firebase/serviceAccount.json
```

> **SECURITY:** Never commit this file to git. It's already in `.gitignore`.

---

## Step 4: Deploy Firestore Security Rules

From your project root:

```bash
# Install Firebase CLI (one-time)
npm install -g firebase-tools

# Login to Firebase
firebase login

# Deploy rules
firebase deploy --only firestore:rules
```

The rules (`firestore.rules`) ensure:
- Web dashboard can READ data (if authenticated)
- Only the desktop app (Admin SDK) can WRITE data
- No unauthorized access

---

## Step 5: Enable Sync in Desktop App

### Option A: In-App Settings
1. Open Desktop App
2. Go to **Manage** → **Settings** tab
3. Toggle **"Enable Firebase Sync"** = ON
4. Sync starts automatically

### Option B: Manual Setting
In `electron/src/database/`, the setting `firebaseSyncEnabled` controls sync:
```
Settings → firebaseSyncEnabled = "true"
```

---

## Step 6: Web Dashboard Setup (Firebase Hosting)

### Configure Firebase for Web:

```bash
# Initialize Firebase Hosting
firebase init hosting

# When asked:
# - Public directory: frontend/dist
# - Single-page app: Yes
# - Overwrite index.html: No
```

### Build and Deploy:

```bash
# Build frontend
cd frontend && npm run build

# Deploy to Firebase Hosting
cd .. && firebase deploy --only hosting
```

Your web dashboard will be live at: `https://tasmac-pos-1745.web.app`

### Web App Firebase Config:

Create `frontend/src/firebase.js`:

```javascript
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "tasmac-pos-1745.firebaseapp.com",
  projectId: "tasmac-pos-1745",
  storageBucket: "tasmac-pos-1745.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
```

> Get these values from: Firebase Console → Project Settings → General → Your Apps → Web App

---

## How the Sync Queue Works

### Every Write Creates a Queue Entry

When you save daily entries on the desktop:

```
1. User clicks "Save"
2. Data written to SQLite (immediate, local)
3. Queue entry created in sync_queue table:
   {
     table_name: "daily_entries",
     record_id: "2026-05-19",
     operation: "UPSERT",
     data: { ... full entry data ... },
     synced: 0,
     created_at: "2026-05-19T18:30:00"
   }
```

### Sync Service Processes Queue

Every 5 minutes, the sync service:

```
1. Read all rows where synced = 0 (limit 50)
2. For each item:
   a. Push to Firebase Firestore
   b. If success → mark synced = 1
   c. If fail → leave for next cycle (retry)
3. Clean items synced > 7 days ago
```

### Why 5-Minute Delay?

**Data changed immediately doesn't reflect instantly** — this is by design:

| Reason | Explanation |
|--------|-------------|
| **Batch efficiency** | Fewer Firebase writes = lower cost + better performance |
| **Error recovery** | If save fails mid-entry, partial data doesn't reach cloud |
| **Offline resilience** | Queue accumulates when offline, syncs when back online |
| **Consistency** | Daily entry has multiple saves (opening stock, entries, denomination) — sync only the final state |
| **Cost control** | Firebase charges per read/write — batching reduces bills |

### Force Immediate Sync

If you need instant sync (e.g., end of day):
- In the app: **Settings → Firebase Sync → Force Sync Now**
- Or via code: `syncService.forceSync()`

---

## Backup Strategy

### Automatic Backups (Desktop)

| Setting | Default | Description |
|---------|---------|-------------|
| `autoBackupEnabled` | `true` | Enable/disable auto backup |
| `autoBackupIntervalHours` | `6` | Hours between backups |
| Max backups kept | `28` | 7 days × 4 backups/day |

**Backup uses SQLite's native backup API** — creates a consistent snapshot even while writes are happening.

### Backup Flow:

```
Every 6 hours:
1. SQLite .backup() → data/backups/backup_2026-05-19T12-00-00_auto.db
2. Count auto backups
3. If > 28, delete oldest
4. Log to audit_logs table
```

### Manual Backup

From the app: **Backup & Restore → Create Backup Now**

### Restore from Backup

1. Select backup from list
2. System creates a "pre-restore" safety backup first
3. Current DB is replaced with backup
4. App restarts with restored data

---

## Ensuring Data Consistency

### Problem: Desktop and Web Show Different Data

This is **intentional**. The sync delay means:

| Time | Desktop | Firebase/Web |
|------|---------|-------------|
| 18:30 | User saves daily entry | Not yet synced |
| 18:35 | Next sync cycle runs | Data pushed to Firestore |
| 18:35+ | Both show same data | ✓ Consistent |

### If You Need Real-Time Sync

Change sync interval to 1 minute:
```
Settings → autoSyncIntervalMinutes → 1
```

But be aware of Firebase quota costs.

### Conflict Resolution

Since desktop is the **only writer**:
- No conflicts possible (web is read-only)
- Last write from desktop always wins
- Each sync item has a timestamp for ordering

---

## Monitoring Sync Status

### In Desktop App:

The notification bell shows:
- 🟢 "Sync Active" — Firebase connected, queue empty
- 🟡 "5 items pending" — Waiting for next sync cycle
- 🔴 "Sync offline" — Firebase unreachable (queue accumulating)

### In Settings:

```
Firebase Sync Status:
├── Connected: ✓
├── Last Sync: 2026-05-19 18:35:00
├── Pending Items: 0
├── Total Pushed: 847
├── Failed: 0
└── Queue Size: 0
```

---

## Firebase Collections Structure

```
Firestore
├── dailySummaries/
│   ├── 2026-05-19 { date, totalSales, totalPurchase, totalClValue, totalBottles, posAmount, ... }
│   ├── 2026-05-18 { ... }
│   └── ...
├── dailyEntries/
│   ├── 2026-05-19 { entries: [...], metadata: {...}, invoices: [...] }
│   └── ...
├── denominations/
│   ├── 2026-05-19 { notes: {...}, coins, totalCash }
│   └── ...
├── products/
│   └── (full product catalog, synced periodically)
└── settings/
    └── shopInfo { shopNo, name, address }
```

---

## Troubleshooting

### "Firebase sync disabled"
- Check `electron/src/firebase/serviceAccount.json` exists
- Ensure settings has `firebaseSyncEnabled = true`

### "Sync failed" errors
- Check internet connection
- Verify Firebase project is active (not suspended)
- Check Firestore quotas (free tier: 50K reads/day, 20K writes/day)

### Web dashboard shows old data
- Check desktop app sync status
- Force sync from desktop
- Verify Firestore has the expected documents

### Data mismatch between desktop and web
- Desktop is always correct (source of truth)
- Wait for next sync cycle (5 min)
- Force sync if urgent

---

## Cost Estimation (Firebase Free Tier)

| Resource | Free Limit | Typical Usage (1 shop) |
|----------|-----------|----------------------|
| Firestore Reads | 50,000/day | ~500/day (well within) |
| Firestore Writes | 20,000/day | ~50/day (daily entries + summaries) |
| Storage | 1 GB | ~5 MB (years of data) |
| Hosting | 10 GB transfer/month | ~100 MB (dashboard is tiny) |

**One shop will never exceed the free tier.**

---

## Summary

| Component | Role | Writes | Reads |
|-----------|------|--------|-------|
| SQLite (Desktop) | Primary database | ✅ | ✅ |
| Firebase Firestore | Cloud mirror | ✅ (from desktop sync only) | ✅ |
| Web Dashboard | Remote viewing | ❌ (read-only) | ✅ |
| Auto Backup | Safety net | N/A | N/A |

The system is designed so that:
1. **Desktop works 100% offline** — no Firebase dependency
2. **Web shows synced data** — with intentional 5-min delay
3. **Backups happen automatically** — every 6 hours
4. **No data loss is possible** — SQLite + backups + cloud mirror = triple redundancy
