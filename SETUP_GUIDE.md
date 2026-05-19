# TASMAC POS - Setup & Installation Guide
## Shop No. 1745, Alandurai, Coimbatore (North)

---

## OPTION 1: Run as Desktop Software (Recommended)

### Requirements
- **Windows 10/11** or **Mac** or **Linux**
- **Node.js 18+** installed ([Download from nodejs.org](https://nodejs.org))

### Step-by-Step Installation

```bash
# 1. Download/Clone the project
git clone https://github.com/Tatwin/TSOP.git
cd TSOP

# 2. Install all dependencies
cd backend && npm install
cd ../frontend && npm install
cd ../electron && npm install
cd ..

# 3. Build the frontend (one time)
cd frontend && npm run build
cd ..

# 4. Run as Desktop App
cd electron && npm start
```

### Build as .exe (Windows Installer)
```bash
cd electron
npm run build:win
# The installer will be in ../dist-electron/
# Double-click the .exe to install on any Windows PC
```

---

## OPTION 2: Run as Web App (Browser)

### Start Backend (Terminal 1)
```bash
cd backend
npm install
npm run dev
# Server starts on http://localhost:5000
```

### Start Frontend (Terminal 2)
```bash
cd frontend
npm install
npm run dev
# App opens on http://localhost:5173
```

### Access the App
- Open browser: **http://localhost:5173**
- No PIN needed to **view/download**
- PIN **1745** needed to **edit/save**

---

## OPTION 3: Mobile (PWA - Progressive Web App)

Once the web app is hosted (Vercel/Render), on your phone:
1. Open Chrome browser
2. Go to the app URL
3. Tap **"Add to Home Screen"**
4. App icon appears like a regular app
5. Works offline after first load

---

## How to Use

### Daily Workflow
1. Open the app
2. Select today's date (auto-selected)
3. Click **"Load Data"** (pulls previous day's closing as opening)
4. Enter **CASE** and **BOTTLE** for each product (closing stock)
5. Enter **PURCHASE** if any bottles bought today
6. Enter **STOCK RETURN** if any returned to depot
7. Fill **Invoice Details** (Invoice No, Amount, Date)
8. Fill **Denomination Counter** (cash notes + coins + POS/Swipe)
9. Enter **Device values** from billing machine
10. Verify: GREEN = All matched, RED = Error
11. Click **Save** (requires PIN 1745)
12. Click **Export Excel** to download report

### PIN Access
- **PIN: 1745**
- Required for: Saving data, Managing products
- NOT required for: Viewing, Exporting, Analytics

### Features
| Feature | Where |
|---------|-------|
| Daily Entry | Home page (/) |
| Case Abstract | Click "Cases" button on Daily Entry |
| Denomination & POS | Click "Cash Counter" on Daily Entry |
| Device Comparison | Below denomination on Daily Entry |
| Multiple Invoices | Invoice section (up to 3) |
| Manage Products | /manage-products (PIN needed) |
| Analytics & Charts | /analytics |
| Dashboard | /dashboard |
| Excel Export | "Export Excel" button |

---

## Where is Data Stored?

### Development (Local)
- Data stored **in-memory** on the backend server
- Data is **lost when server restarts**
- Good for testing only

### Production (Cloud - Firebase)
1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable Firestore Database
3. Get service account credentials
4. Create `backend/.env` file:
```
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-email@project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
PORT=5000
JWT_SECRET=any-random-string-here
FRONTEND_URL=http://localhost:5173
```
5. Data is stored permanently in the cloud
6. Accessible from any device
7. Auto-backed up by Google

---

## Cloud Deployment (Access from Anywhere)

### Backend → Render.com (Free)
1. Go to [render.com](https://render.com)
2. Connect GitHub repo
3. Create "Web Service" pointing to `/backend`
4. Set environment variables from `.env`
5. Deploy

### Frontend → Vercel (Free)
1. Go to [vercel.com](https://vercel.com)
2. Import GitHub repo
3. Set root directory to `frontend`
4. Set `VITE_API_URL` to your Render backend URL
5. Deploy

---

## Project Structure
```
TSOP/
├── backend/           # Express API server
│   ├── src/
│   │   ├── data/      # Products & rates data
│   │   ├── routes/    # API endpoints
│   │   └── index.js   # Server entry
│   └── package.json
├── frontend/          # React app (Vite)
│   ├── src/
│   │   ├── components/  # Reusable UI parts
│   │   ├── pages/       # Main screens
│   │   ├── data/        # Products catalog
│   │   └── App.jsx      # Main app
│   └── package.json
├── electron/          # Desktop app wrapper
│   ├── main.js        # Electron main process
│   └── package.json
└── SETUP_GUIDE.md     # This file
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "npm not found" | Install Node.js from nodejs.org |
| "Port 5000 in use" | Kill other process or change PORT in .env |
| "Cannot connect to API" | Make sure backend is running on port 5000 |
| "PIN not working" | PIN is exactly: 1745 |
| "Data lost on restart" | Set up Firebase for persistent storage |
| "Excel export fails" | Check backend is running |

---

## Contact
- **Shop Owner:** ANTONYSAMY.A
- **Mobile:** 99429 10707, 99422 10707
- **Address:** SF NO-1101/1A, Siruvani Main Road, Near H.P Petrol Bunk, Alandurai, Coimbatore-(North) -641101
