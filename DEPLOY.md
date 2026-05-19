# Deployment Guide - TASMAC POS (Shop No. 1745)

Deploy the frontend to **Vercel** and the backend to **Render** for a free, production-ready setup.

---

## Architecture

```
[Browser] --> [Vercel - React Frontend] --> [Render - Express Backend]
                                                    |
                                              [data/store.json]
```

---

## Prerequisites

- GitHub account with this repo pushed
- [Vercel account](https://vercel.com) (free tier works)
- [Render account](https://render.com) (free tier works)
- Node.js 18+ locally for testing

---

## Step 1: Deploy Backend to Render

### 1.1 Create a Web Service

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **"New +"** > **"Web Service"**
3. Connect your GitHub repo (`Tatwin/TSOP`)
4. Configure the service:

| Setting | Value |
|---------|-------|
| **Name** | `tasmac-pos-api` |
| **Region** | Singapore (closest to India) or Oregon |
| **Branch** | `main` |
| **Root Directory** | `backend` |
| **Runtime** | Node |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Instance Type** | Free |

### 1.2 Set Environment Variables

In the Render service settings, add these environment variables:

| Variable | Value |
|----------|-------|
| `PORT` | `5000` |
| `JWT_SECRET` | (generate a random string, e.g. `tasmac-1745-prod-secret-xyz`) |
| `FRONTEND_URL` | (add after Vercel deploy, e.g. `https://tasmac-pos.vercel.app`) |
| `NODE_ENV` | `production` |

### 1.3 Create Persistent Disk (Important!)

Since data is stored in `data/store.json`, you need persistent storage:

1. Go to your Render service > **Disks**
2. Click **"Add Disk"**
3. Configure:
   - **Name**: `pos-data`
   - **Mount Path**: `/opt/render/project/src/data`
   - **Size**: 1 GB (free tier allows 1 disk)

> **Note**: On the free tier without a disk, data resets on every deploy. If using free tier without disk, consider upgrading to Starter ($7/mo) for persistent disk.

### 1.4 Verify Backend

After deploy completes, visit your Render URL:
```
https://tasmac-pos-api.onrender.com/api/health
```
Should return: `{"status":"ok","timestamp":"..."}`

---

## Step 2: Deploy Frontend to Vercel

### 2.1 Import Project

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"Add New..."** > **"Project"**
3. Import the GitHub repo (`Tatwin/TSOP`)
4. Configure:

| Setting | Value |
|---------|-------|
| **Framework Preset** | Vite |
| **Root Directory** | `frontend` |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |
| **Install Command** | `npm install` |

### 2.2 Set Environment Variables

Add this environment variable in Vercel project settings:

| Variable | Value |
|----------|-------|
| `VITE_API_URL` | `https://tasmac-pos-api.onrender.com/api` |

### 2.3 Update Vite Config for Production

The frontend needs to know the backend URL in production. The `vite.config.js` proxy only works in dev. The `api.js` utility uses `/api` as baseURL which works with the proxy in dev.

For production, update `frontend/src/utils/api.js` to use the env variable:

```javascript
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' }
});
```

### 2.4 Add Vercel Rewrites (Alternative to env variable)

Create `frontend/vercel.json`:

```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://tasmac-pos-api.onrender.com/api/:path*"
    }
  ]
}
```

This proxies all `/api/*` requests to Render, so you don't need to change `api.js`.

### 2.5 Verify Frontend

Visit your Vercel URL (e.g., `https://tasmac-pos.vercel.app`). You should see the login screen.

---

## Step 3: Connect Frontend to Backend

### 3.1 Update CORS on Backend

Go back to Render and update the `FRONTEND_URL` environment variable:
```
FRONTEND_URL=https://tasmac-pos.vercel.app
```

The backend CORS is configured to accept `origin: true` so all origins work, but setting this is good practice.

### 3.2 Test the Full Flow

1. Open the Vercel URL
2. Enter PIN: `1745`
3. You should be logged in
4. Try saving a daily entry — data should persist across refreshes

---

## Custom Domain (Optional)

### Vercel (Frontend)
1. Go to Project Settings > Domains
2. Add your domain (e.g., `pos.tasmac1745.com`)
3. Update DNS as instructed

### Render (Backend)
1. Go to Service Settings > Custom Domains
2. Add your domain (e.g., `api.tasmac1745.com`)
3. Update DNS as instructed
4. Update `VITE_API_URL` or `vercel.json` rewrite to use new domain

---

## Troubleshooting

### "Invalid PIN" on login
- Verify backend is running: check `https://your-render-url.onrender.com/api/health`
- Check browser console for CORS errors
- Ensure `VITE_API_URL` or `vercel.json` rewrite points to correct Render URL

### Data disappears after Render redeploy
- **Free tier without disk**: Data resets on every deploy. Add a Render Disk (Step 1.3)
- **With disk**: Ensure mount path is `/opt/render/project/src/data`

### Render service sleeps (free tier)
- Free tier services sleep after 15 minutes of inactivity
- First request after sleep takes ~30 seconds to wake up
- Consider upgrading to Starter ($7/mo) for always-on

### CORS errors in browser
- Verify `FRONTEND_URL` env variable on Render matches your Vercel URL exactly
- Check that the URL doesn't have a trailing slash

### Build fails on Vercel
- Ensure Root Directory is set to `frontend`
- Check that `npm run build` works locally first

### Build fails on Render
- Ensure Root Directory is set to `backend`
- Check `package.json` has all dependencies listed

---

## Environment Variables Summary

### Backend (Render)
```env
PORT=5000
JWT_SECRET=your-secret-key-here
FRONTEND_URL=https://your-vercel-url.vercel.app
NODE_ENV=production
```

### Frontend (Vercel)
```env
VITE_API_URL=https://your-render-url.onrender.com/api
```

---

## Cost Estimate

| Service | Tier | Cost |
|---------|------|------|
| Vercel (Frontend) | Hobby | Free |
| Render (Backend) | Free | Free (sleeps after 15min) |
| Render (Backend) | Starter | $7/month (always-on + disk) |

**Recommended**: Render Starter ($7/mo) for reliable production use with persistent data.
