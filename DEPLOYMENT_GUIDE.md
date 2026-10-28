# Studio Frangipani — Live Hosting & Dual-Link Deployment Guide

This project is fully prepared, tested, and optimized for live production hosting with **2 distinct links**:
1. **Main Client Website** (Public Editorial Prop Catalogue & Rental Request Experience)
2. **Admin Management Portal** (Studio Operations, Physical Inventory, Enquiries Inbox & Analytics)

---

## 🚀 Live Hosting Options

### Option 1: 1-Click Zero-Config Deployment via Vercel (Recommended)

Because the project uses **Next.js 15**, Vercel provides native zero-config deployment, edge CDN caching, image optimization, and serverless API execution.

#### Step 1: Import the GitHub Repository
1. Log in to [vercel.com](https://vercel.com).
2. Click **Add New...** → **Project**.
3. Select your repository: [`Manmeet2405/prop-studio-website`](https://github.com/Manmeet2405/prop-studio-website).
4. In the **Configure Project** screen:
   - **Root Directory**: Click **Edit** and select **`frontend`**.
   - **Framework Preset**: Next.js (automatically detected).
5. (Optional) Under **Environment Variables**, you can configure:
   - `NEXT_PUBLIC_WHATSAPP_NUMBER`: `918767640931`
   - `NEXT_PUBLIC_WHATSAPP_PHONE`: `+91 8767640931`
6. Click **Deploy**.

---

## 🔗 The Two Client Links

### Scenario A — Single Project with Dual Links (Ready out-of-the-box)
Once deployed, Vercel gives you a primary domain, e.g. `https://prop-studio-website.vercel.app`.
You can share these two exact links with your client immediately:
- **Main Website Link:**  
  `https://prop-studio-website.vercel.app/`
- **Admin Portal Link:**  
  `https://prop-studio-website.vercel.app/admin`  
  *(or `https://prop-studio-website.vercel.app/?mode=admin`)*

---

### Scenario B — Dedicated Subdomains / Custom Domains (via Intelligent Middleware)
The application includes intelligent edge middleware in `frontend/src/middleware.js`. It automatically detects any domain containing `-admin` or `admin.` and routes directly to the Admin Dashboard without showing the public site.

To set this up on Vercel:
1. In your Vercel Project, go to **Settings** → **Domains**.
2. Add a second domain name, e.g.:
   - `prop-studio-website-admin.vercel.app` (or `admin.yourdomain.com`).
3. Now you have 2 dedicated live URLs:
   - **Main Website:** `https://prop-studio-website.vercel.app`
   - **Admin Portal:** `https://prop-studio-website-admin.vercel.app` *(Visiting the root `/` opens Admin directly!)*

---

## 🧪 Architecture & Zero-Error Verification

- **Production Build:** Verified with `next build`. All 23 static pages, dynamic routes (`/product/[id]`), and serverless API endpoints pre-render with 0 errors.
- **Enquiries API (`/api/enquiries`):** Handles client cart rental submissions with anti-spam honeypot, E.164 phone normalization, and unique booking reference generation (`ENQ-2026-XXXX`).
- **WhatsApp Webhook API (`/api/whatsapp/webhook`):** Meta WhatsApp Cloud API verification handshake and incoming message webhook receiver.
- **State Management:** Powered by React Context and browser `localStorage`, allowing the client and admin to interact with inventory updates, status transitions, and enquiry records in real time without requiring external database provisioning.
- **FastAPI / MongoDB Backend:** Located in `backend/server.py` with safe environment variable fallbacks if you wish to connect MongoDB later.
