# TASMAC POS - Shop No. 1745

**Point of Sale & Inventory Management System for TASMAC Shop No. 1745, Alandurai, Coimbatore (North)**

A production-grade hybrid desktop + web application for daily sales tracking, stock management, denomination counting, invoice management, holiday calendar, and business analytics.

---

## Architecture

```
Electron Desktop App (PRIMARY)
├── React 18 + Vite (Frontend UI)
├── Express.js (Embedded Backend API)
├── SQLite via better-sqlite3 (Local Database)
├── Auto Backup (every 30 min, VACUUM INTO)
├── Firebase Sync (optional, queue-based)
└── NSIS Installer + Portable Build

Web Dashboard (SECONDARY - read only)
└── Firebase Firestore → Analytics access
```

**Desktop is the source of truth.** Web dashboard is for remote monitoring only.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Axios |
| Backend | Express.js, JWT, xlsx-js-style |
| Database | SQLite (better-sqlite3), WAL mode |
| Desktop | Electron, electron-builder |
| Cloud Sync | Firebase Admin SDK (optional) |
| Auth | PIN-based, RBAC (admin/operator/viewer) |

---

## Features

### Core Operations
- **Daily Sales Entry** — Sequential card-based entry (cases/bottles per product)
- **Table Mode** — Bulk edit all products at once
- **Opening Stock** — Auto-pulls previous working day's closing stock (skips holidays)
- **Stock Return to Depot** — Track bottles returned
- **Purchase Invoice** — Multi-invoice with code-based product lookup
- **Denomination Counter** — Cash counting with POS/digital payment
- **Device vs Manual Comparison** — Verify billing machine totals
- **Download as Excel** — Styled export with green headers, colored categories

### Holiday & Calendar Management
- **Sales Calendar** — Monthly grid showing daily sales totals per day
- **Holiday Marking** — Admin & Operator can mark any date as a government holiday
- **Holiday Reasons** — Record reason (e.g. Republic Day, Pongal, Dry Day)
- **Visual Indicators** — Green = sales day, Red = holiday, with amount/reason labels
- **Stock Carry-Forward** — On holidays, previous working day's closing stock automatically becomes the next working day's opening stock
- **Monthly Summary** — Total sales, working days, holiday count, average per day
- **Remove Holiday** — Unmark a date if marked by mistake

### Product Management
- **Add/Edit/Delete Products** — Persisted to backend database (survives navigation)
- **Add/Edit/Delete Categories** — Dynamic categories with bottles-per-case
- **Staff Management** — Salesmen and supervisors CRUD
- **Hide/Show Products** — Toggle visibility without deleting
- **Numeric Code Field** — Code input accepts only numbers
- **Dynamic Filter Dropdown** — Shows all categories including newly added ones

### Business Intelligence
- **Dashboard** — KPIs with growth %, today vs yesterday, weekly/monthly comparison
- **Analytics** — 30-day sales trend, category breakdown, top products, top 5 days
- **Inventory Intelligence** — Reorder suggestions, fast-moving, dead stock, anomalies
- **Notifications** — Low stock, cash mismatch, missing entries, sales spikes

### Enterprise Features
- **SQLite Database** — Survives restarts, WAL mode, ACID transactions
- **RBAC** — Admin (PIN: 1974), Operator (PIN: 1745), Viewer (no PIN)
- **Audit Logs** — Every action tracked with who/what/when/previous/new values
- **Auto Backup** — Every 30 min via VACUUM INTO, 20 max retention
- **Global Search** — Ctrl+K to search products, pages, categories
- **Keyboard Shortcuts** — Ctrl+K (search), Ctrl+S (save), Enter navigation
- **Error Boundaries** — Graceful error handling with recovery UI
- **Security** — Rate limiting, brute force protection, input validation, security headers

### Hybrid Desktop + Web
- **Electron App** — Express embedded in-process (no separate server)
- **Firebase Sync** — Queue-based, 5-min interval, offline-resilient
- **Web Dashboard** — Read-only analytics from Firestore
- **NSIS Installer** — One-click install, desktop shortcuts, portable build
- **Auto-Updater** — Updates from GitHub Releases

---

## Quick Start

### Web Mode (Development)

```bash
# Install dependencies
cd backend && npm install
cd ../frontend && npm install

# Start backend (Terminal 1)
cd backend && npm run dev
# → http://localhost:5000

# Start frontend (Terminal 2)
cd frontend && npm run dev
# → http://localhost:5173
```

### Desktop Mode (Electron)

```bash
cd electron && npm install
npm run dev
```

### Login

| Role | PIN | Access |
|------|-----|--------|
| Admin | `1974` | Full access (all features + manage users/backup) |
| Operator | `1745` | Data entry, export, mark holidays |
| Viewer | *(no PIN)* | Read-only (view data, calendar, dashboard) |

---

## Project Structure

```
TSOP/
├── backend/                    # Express API
│   ├── data/
│   │   ├── tasmac.db          # SQLite database (all data)
│   │   └── backups/           # Auto & manual backups
│   ├── src/
│   │   ├── index.js           # Server entry (embeddable)
│   │   ├── middleware/
│   │   │   ├── auth.js        # JWT + RBAC (3 roles, 16 permissions)
│   │   │   └── security.js    # Rate limit, headers, validation
│   │   ├── routes/
│   │   │   ├── auth.js        # Login, user CRUD
│   │   │   ├── dailyEntry.js  # Daily sales CRUD + opening stock (skips holidays)
│   │   │   ├── denomination.js# Cash denomination
│   │   │   ├── dashboard.js   # Analytics, comparisons, intelligence
│   │   │   ├── products.js    # Product/staff/category CRUD
│   │   │   ├── holidays.js    # Holiday marking/removal with audit
│   │   │   ├── export.js      # Styled Excel export
│   │   │   ├── backup.js      # Backup/restore/download
│   │   │   ├── audit.js       # Activity logs
│   │   │   └── notifications.js # Alert system
│   │   └── services/
│   │       ├── database.js    # SQLite via better-sqlite3
│   │       ├── fileStore.js   # API wrapper (drop-in)
│   │       ├── auditService.js# Audit logging
│   │       └── reliability.js # Health checks, repair
│   └── package.json
├── frontend/                   # React + Vite
│   ├── src/
│   │   ├── pages/
│   │   │   ├── DailyEntry.jsx # Main entry (sequential/table/stock return)
│   │   │   ├── InvoicePage.jsx# Purchase invoice management
│   │   │   ├── Dashboard.jsx  # BI dashboard with KPIs
│   │   │   ├── Analytics.jsx  # Charts and insights
│   │   │   ├── Calendar.jsx   # Holiday calendar + daily sales view
│   │   │   ├── ActivityLogs.jsx# Audit trail viewer
│   │   │   ├── BackupRestore.jsx# Backup management
│   │   │   └── ManageProducts.jsx# Products/staff/categories
│   │   ├── components/
│   │   │   ├── Layout.jsx     # Sidebar + header + search
│   │   │   ├── GlobalSearch.jsx# Ctrl+K search modal
│   │   │   ├── NotificationBell.jsx# Alert dropdown
│   │   │   ├── ToastNotification.jsx# Toast system
│   │   │   ├── ErrorBoundary.jsx# Error handling
│   │   │   ├── DenominationCounter.jsx
│   │   │   ├── CaseAbstract.jsx
│   │   │   └── InvoiceSection.jsx
│   │   └── context/AuthContext.jsx
│   └── package.json
├── electron/                   # Desktop app
│   ├── main.js                # Electron main process
│   ├── preload.js             # IPC bridge
│   ├── src/
│   │   ├── database/          # SQLite schema (Electron-specific)
│   │   ├── backup/autoBackup.js
│   │   └── firebase/          # Sync service + config
│   └── package.json
├── ARCHITECTURE.md             # System design
├── FIREBASE_SYNC_GUIDE.md      # Firebase setup guide
├── SETUP_GUIDE.md              # How to run everything
└── README.md                   # This file
```

---

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/login` | No | Login with PIN |
| GET | `/api/daily-entry/:date` | No | Get daily entries |
| POST | `/api/daily-entry/:date` | Yes | Save daily entries |
| POST | `/api/daily-entry/:date/opening-stock` | Yes | Save opening stock |
| POST | `/api/daily-entry/:date/stock-return` | Yes | Save stock returns |
| POST | `/api/daily-entry/:date/purchases` | Yes | Save invoices |
| GET | `/api/daily-entry/range/:start/:end` | No | Get entries for date range |
| GET | `/api/denomination/:date` | No | Get denomination |
| POST | `/api/denomination/:date` | Yes | Save denomination |
| GET | `/api/products` | No | List products + categories |
| POST | `/api/products` | Yes | Add new product |
| PUT | `/api/products/:id/rate` | Yes | Update product rate |
| PUT | `/api/products/:id/status` | Yes | Toggle product visibility |
| POST | `/api/products/categories` | Yes | Add category |
| PUT | `/api/products/categories/:key` | Yes | Edit category |
| DELETE | `/api/products/categories/:key` | Yes | Delete category |
| GET | `/api/products/staff` | No | Get staff list |
| POST | `/api/products/staff` | Yes | Add staff member |
| PUT | `/api/products/staff/:index` | Yes | Edit staff member |
| DELETE | `/api/products/staff/:index` | Yes | Delete staff member |
| GET | `/api/holidays` | No | List all holidays |
| GET | `/api/holidays/:year/:month` | No | Holidays for a month |
| POST | `/api/holidays` | Yes | Mark date as holiday |
| DELETE | `/api/holidays/:date` | Yes | Remove holiday |
| GET | `/api/holidays/check/:date` | No | Check if date is holiday |
| GET | `/api/dashboard/today` | No | Today's summary |
| GET | `/api/dashboard/analytics` | No | 30-day analytics |
| GET | `/api/dashboard/comparison` | No | Growth comparisons |
| GET | `/api/dashboard/top-days` | No | Top 5 sales days |
| GET | `/api/dashboard/inventory-intelligence` | No | Reorder/dead stock |
| POST | `/api/export/daily` | Yes | Download Excel |
| GET | `/api/audit/logs` | No | Activity logs |
| GET | `/api/backup/list` | Yes | List backups |
| POST | `/api/backup/create` | Yes | Create backup |
| GET | `/api/notifications` | No | Active alerts |
| GET | `/api/health` | No | System health |

---

## Holiday System

When a date is marked as a holiday:
1. The date appears as a **red cell** in the Calendar with the reason displayed
2. The opening stock logic **skips holidays** when looking back for previous closing stock
3. This means: if you close on Friday with 100 bottles, mark Saturday as holiday, then Monday's opening stock will correctly show 100 bottles (Friday's closing)
4. Both **Admin** and **Operator** roles can mark/remove holidays
5. All holiday changes are audit-logged

---

## Data Storage

- **Primary:** SQLite (`backend/data/tasmac.db`) — WAL mode, auto-backup
- **Legacy:** JSON file (`backend/data/store.json`) — auto-migrated to SQLite on first run
- **Backups:** `backend/data/backups/` — .db files via VACUUM INTO
- **Cloud:** Firebase Firestore (optional mirror for web dashboard)

---

## Building Desktop Installer

```bash
cd electron
npm install
npm run build:win        # Windows NSIS installer
npm run build:win-portable  # Portable .exe (no install)
npm run build:mac        # macOS .dmg
npm run build:linux      # Linux AppImage
```

See `electron/BUILD.md` for detailed instructions.

---

## Documentation

| File | Description |
|------|-------------|
| `SETUP_GUIDE.md` | How to run, troubleshoot, PINs |
| `ARCHITECTURE.md` | System design, data flow diagrams |
| `FIREBASE_SYNC_GUIDE.md` | Firebase setup, sync mechanism |
| `electron/BUILD.md` | Desktop build instructions |

---

## Color Palette

| Color | Hex | Usage |
|-------|-----|-------|
| Green | `#0E6633` | Primary, headers, success, sales days |
| Red | `#D92426` | Danger, errors, holidays, negative values |
| White | `#FFFFFF` | Cards, backgrounds |
| Light Gray | `#F4F6F4` | Body background, subtle fills |
| Dark Green | `#1E291E` | Sidebar, dark text |

---

## Contact

- **Shop:** TASMAC Shop No. 1745
- **Address:** SF NO-1101/1A, Siruvani Main Road, Near H.P Petrol Bunk, Alandurai, Coimbatore-(North) -641101
- **Mobile:** 99429 10707, 99422 10707
