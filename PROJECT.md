# 1745 POS - TASMAC Point of Sale System

## What is this?

A complete daily sales tracking and reporting system for **TASMAC Shop No. 1745** (Tamil Nadu State Marketing Corporation), located at Alandurai, Coimbatore (North). Built as a Progressive Web App for mobile-first use by shop staff during and after business hours.

---

## Architecture

```
Frontend (React 18 + Vite)        Backend (Express.js)
========================          ====================
/frontend                         /backend
  React SPA                         REST API
  React Router v6                   JWT Auth (PIN-based)
  Axios HTTP client                 File-based JSON persistence
  PWA (service worker)              xlsx-js-style for Excel export
                                    data/store.json (persistent storage)

[Browser] ---> [Vite Dev Proxy /api] ---> [Express :5000]
           OR
[Browser] ---> [Vercel Rewrite /api] ---> [Render Backend]
```

---

## Key Features

### 1. PIN-Based Authentication
- Single PIN (`1745`) for the shop
- JWT token stored in localStorage, 24h expiry
- View-only mode available without PIN (GET routes are public)
- PIN only required for saving/editing (POST/PUT routes)

### 2. Daily Sales Entry (Core Feature)
- **Sequential Mode**: One product at a time, Enter key advances, mobile-optimized
- **Table Mode**: Spreadsheet-like view for all products at once
- **Opening Stock Mode**: Enter/edit opening stock for all products
- **Summary Mode**: Case abstract grouped by category
- Only shows products that have opening stock or purchases (active products)
- Calculates: Closing Stock = Cases * CaseSize + Bottles, Sales = Total - ClosingStock, SalesAmt = Sales * Rate

### 3. Midnight Date Handling
- If current time is between 12:00 AM and 4:00 AM, the system defaults to YESTERDAY's date
- Uses LOCAL timezone (not UTC) to avoid off-by-one errors with IST (+5:30)
- This is because TASMAC shops close at midnight and staff finish data entry after closing

### 4. File-Based Persistence
- All data saved to `backend/data/store.json`
- Writes synchronously on every save for data safety
- Structure: `{ dailyEntries: { "YYYY-MM-DD": {...} }, denominations: { "YYYY-MM-DD": {...} } }`
- Survives server restarts (unlike in-memory storage)

### 5. Dashboard
- Auto-loads today's sales summary on page mount
- Falls back to last 7 days if today has no data
- Shows: Total Sales, Total Purchase, Closing Stock Value, Cash Collected
- Monthly view with date range API
- Current stock view for any date

### 6. Analytics
- Fetches last 30 days of real data from `/api/daily-entry/range/`
- Daily sales bar chart, category breakdown pie chart
- Top 10 best sellers, items not sold in 30 days
- Monthly summary with average per day

### 7. Excel Export (Styled)
- Uses `xlsx-js-style` for colorful output
- Color scheme: Green (#0E6633) headers, Dark (#1E291E) category rows, Red (#D92426) totals
- Auto-fit column widths based on content length
- AutoFilter enabled on data columns (filter by purchased, sold, closing stock)
- Sections: Product data, POS/Digital, Device vs Manual, Denomination, Daily Summary
- Borders between all sections

### 8. Denomination Counter
- Count notes (500, 200, 100, 50, 20, 10) and coins
- Auto-calculates total cash
- Validates: Cash + POS amount should equal Total Sales
- Shows mismatch warning if not balanced

### 9. Device vs Manual Comparison
- Enter device readings (sales bottles, closing bottles, sales value, closing value)
- Auto-compares with manual calculations
- Shows difference and match/mismatch status

### 10. POS / Digital Payment
- Separate field for card/GPay/digital payment amount
- Remittance = Total Sales - POS Amount

---

## Product Catalog

- **54 products** pre-loaded across 15 categories
- Categories: 180ml/375ml/720ml/1000ml for Brandy, Whiskey, Rum, Wine, Vodka & Gin + Beer variants
- Each category has a specific `bottlesPerCase` (48, 24, 12, or 9)
- Rates are pre-configured per product

---

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/auth/login | No | PIN login, returns JWT |
| GET | /api/auth/me | Yes | Verify token |
| GET | /api/daily-entry/range/:start/:end | No | Date range query |
| GET | /api/daily-entry/:date | No | Get day's entries |
| GET | /api/daily-entry/:date/opening-stock | No | Get opening stock |
| POST | /api/daily-entry/:date | Yes | Save entries |
| POST | /api/daily-entry/:date/opening-stock | Yes | Save opening stock |
| POST | /api/daily-entry/:date/purchases | Yes | Save invoice purchases |
| GET | /api/denomination/:date | No | Get denomination |
| POST | /api/denomination/:date | Yes | Save denomination |
| POST | /api/export/daily | Yes | Generate Excel file |
| GET | /api/dashboard/today | No | Today's summary |
| GET | /api/products | No | Product list |
| GET | /api/products/staff | No | Staff list |

**Important**: The `/range/` route MUST be defined before `/:date` in Express to avoid the wildcard catching "range" as a date parameter.

---

## Data Flow (Daily Workflow)

1. **Morning**: Enter Opening Stock (previous day's closing stock auto-calculated)
2. **During Day**: Record Purchase Invoices (adds to purchase column)
3. **End of Day**: Enter Closing Stock (Cases + Bottles for each product)
4. **System Calculates**: Sales = OpeningStock + Purchase - ClosingStock
5. **Verify**: Enter denomination (cash count), POS amount, device readings
6. **Validate**: Cash + POS should = Total Sales, Device should = Manual
7. **Export**: Download Excel sheet for records

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | React | 18.x |
| Build | Vite | 5.x |
| Routing | React Router | 6.x |
| HTTP | Axios | 1.6.x |
| Backend | Express | 4.18.x |
| Auth | jsonwebtoken | 9.x |
| Excel | xlsx-js-style | 1.2.x |
| Storage | JSON file (fs) | Node built-in |

---

## Color Palette

| Color | Hex | Usage |
|-------|-----|-------|
| TASMAC Green | #0E6633 | Primary, headers, positive values |
| TASMAC Red | #D92426 | Danger, negative values, totals row |
| Dark Green | #1E291E | Category headers, dark backgrounds |
| Light Gray | #F4F6F4 | Card backgrounds, alternating rows |
| White | #FFFFFF | Base background |

---

## File Structure

```
TSOP/
├── backend/
│   ├── data/
│   │   └── store.json          # Persistent data (gitignored)
│   ├── src/
│   │   ├── config/
│   │   │   └── fileStore.js    # Read/write JSON persistence
│   │   ├── data/
│   │   │   ├── products.js     # 54 products + categories
│   │   │   └── rates.js        # Rate configuration
│   │   ├── middleware/
│   │   │   └── auth.js         # JWT middleware
│   │   ├── routes/
│   │   │   ├── auth.js         # PIN login
│   │   │   ├── dailyEntry.js   # Core CRUD for daily data
│   │   │   ├── dashboard.js    # Aggregated views
│   │   │   ├── denomination.js # Cash counting
│   │   │   ├── export.js       # Excel generation
│   │   │   └── products.js     # Product/staff management
│   │   └── index.js            # Express app setup
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── CaseAbstract.jsx
│   │   │   ├── DenominationCounter.jsx
│   │   │   ├── InvoiceSection.jsx
│   │   │   └── Layout.jsx
│   │   ├── context/
│   │   │   └── AuthContext.jsx  # PIN auth state
│   │   ├── data/
│   │   │   ├── products.js      # Frontend product catalog
│   │   │   └── rates.js
│   │   ├── pages/
│   │   │   ├── Analytics.jsx    # 30-day analytics
│   │   │   ├── DailyEntry.jsx   # Main data entry (sequential/table)
│   │   │   ├── Dashboard.jsx    # Summary + stock view
│   │   │   ├── InvoicePage.jsx  # Purchase invoice entry
│   │   │   ├── Login.jsx        # PIN entry screen
│   │   │   └── ManageProducts.jsx
│   │   ├── utils/
│   │   │   ├── api.js           # Axios instance
│   │   │   └── dateHelper.js    # Midnight date logic
│   │   ├── App.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   ├── vercel.json              # Production API proxy
│   └── package.json
├── DEPLOY.md                    # Vercel + Render deployment guide
├── PROJECT.md                   # This file
└── package.json
```

---

## Known Behaviors

- **PIN**: Always `1745`. Single-user system (no multi-user accounts).
- **Opening Stock**: Auto-calculated from previous day's closing stock if not manually set.
- **Route Order**: Express `/:date` wildcard catches everything - `/range/` must come first.
- **Timezone**: All dates use LOCAL time (IST). Never use `toISOString().split('T')[0]` for display dates.
- **Save Event**: DailyEntry dispatches `window.dispatchEvent(new CustomEvent('dailyEntrySaved'))` so Dashboard/Analytics can refresh.
- **Export Validation**: Excel download blocked unless Cash+POS matches Sales OR device matches manual.

---

## Deployment

- **Frontend**: Vercel (static build, /api rewritten to backend)
- **Backend**: Render (Node.js web service with persistent disk for store.json)
- See `DEPLOY.md` for full step-by-step instructions.
