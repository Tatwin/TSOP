# TASMAC POS System - Shop No. 1745

**Point of Sale web application for TASMAC (Tamil Nadu State Marketing Corporation) alcohol retail shop.**

Shop: SF NO-1101/1A, Siruvani Main Road, Near H.P Petrol Bunk, Alandurai, Coimbatore-(North) - 641101  
Owner: ANTONYSAMY.A | Mobile: 99429 10707, 99422 10707

---

## Features

- **Daily Entry Form** — Enter closing stock (cases + bottles), purchases, stock returns for all 54 products
- **Real-time Calculations** — Auto-computes CL.ST, TOTAL, SALES, SALES AMT, all values
- **Opening Stock Auto-Pull** — Previous day's closing stock carried forward automatically
- **Category Filtering** — View one category at a time (15 categories with proper case sizes)
- **Denomination Counter** — Cash reconciliation with RED/GREEN validation
- **Excel Export** — One-click download matching the exact reference format
- **Dashboard** — Today's summary, monthly view, product catalog
- **Authentication** — JWT-based login

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + React Router |
| Backend | Node.js + Express |
| Auth | JWT (jsonwebtoken) |
| Excel Export | SheetJS (xlsx) |
| Database | In-memory (swap for Firebase Firestore in production) |

---

## Quick Start

### Prerequisites
- Node.js 18+ installed

### Installation

```bash
# Install all dependencies
cd backend && npm install
cd ../frontend && npm install
```

### Running Locally

```bash
# Start backend (port 5000)
cd backend && npm run dev

# Start frontend (port 5173) - in another terminal
cd frontend && npm run dev
```

Open http://localhost:5173 in your browser.

### Default Login
- **Username:** `antonysamy`
- **Password:** `tasmac1745`

---

## Project Structure

```
TSOP/
├── backend/
│   ├── src/
│   │   ├── config/          # Firebase & in-memory DB config
│   │   ├── data/
│   │   │   └── products.js  # All 54 products with categories
│   │   ├── middleware/
│   │   │   └── auth.js      # JWT authentication
│   │   ├── routes/
│   │   │   ├── auth.js      # Login/logout
│   │   │   ├── dailyEntry.js # Daily data CRUD
│   │   │   ├── denomination.js # Cash denomination
│   │   │   ├── dashboard.js # Summary APIs
│   │   │   ├── export.js    # Excel export
│   │   │   └── products.js  # Product management
│   │   └── index.js         # Express server entry
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Layout.jsx
│   │   │   └── DenominationCounter.jsx
│   │   ├── context/
│   │   │   └── AuthContext.jsx
│   │   ├── data/
│   │   │   └── products.js  # Shared product data
│   │   ├── pages/
│   │   │   ├── DailyEntry.jsx  # Main data entry
│   │   │   ├── Dashboard.jsx
│   │   │   └── Login.jsx
│   │   ├── utils/
│   │   │   └── api.js       # Axios instance
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
└── package.json
```

---

## Categories & Case Sizes

| Category | Bottles/Case |
|----------|-------------|
| 180ml Brandy/Whiskey/Rum/Wine/Vodka & Gin | 48 |
| 375ml Brandy/Whiskey/Rum/Wine/Vodka & Gin | 24 |
| 720ml (all items) | 12 |
| 1000ml (all items) | 9 |
| Beer 650ml | 48 |
| Beer 325ml & 500ml / 500ml Can | 24 |

---

## Daily Workflow

1. **Select Date** → defaults to today
2. **Click "Load Data"** → fetches previous day's closing stock as opening stock
3. **Enter per product:** CASE, BOTTLE, PURCHASE, STOCK RETURN
4. **Fill Denomination Counter** → cash reconciliation
5. **Verify** RED/GREEN indicator → cash vs sales match
6. **Save** → stores to database
7. **Export Excel** → downloads .xlsx in exact reference format

---

## Production Deployment

1. Set up Firebase Firestore and update `.env` with credentials
2. Deploy backend to Render/Railway
3. Deploy frontend to Vercel (set `VITE_API_URL` env var)
4. Update CORS origin in backend

---

## Excel Export Format

The exported Excel matches the father's existing daily worksheet format exactly:
- Header rows with shop info, invoice details, salesmen names
- All 54 products with calculated columns
- Formulas: TOTAL = OP.ST + PURCHASE - STOCK RETURN, CL.ST = CASE × CASE_SIZE + BOTTLE, SALES = TOTAL - CL.ST
- Denomination section with total cash
