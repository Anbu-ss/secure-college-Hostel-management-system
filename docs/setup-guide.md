# Setup & Developer Guide — Secure College Hostel Management System

## 1. Prerequisites
- **Node.js**: v18.0.0 or higher (v20+ recommended)
- **NPM**: v8.0.0 or higher
- **Git**

---

## 2. Quick Setup

### Step 1: Install Dependencies
Run from the root project directory:
```bash
npm install
```

### Step 2: Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Ensure required environment variables are set:
- `JWT_SECRET`: Secret key for JWT signing
- `GOOGLE_CLIENT_ID`: Google OAuth client identifier
- `FIREBASE_*`: Firebase Admin & Client SDK credentials
- `DB_PATH`: `./database/database.sqlite` (or `./database.sqlite`)

### Step 3: Run the Application
In development, run both backend server and frontend client concurrently:
```bash
npm run dev
```
Or run individually:
- **Backend**: `npm run server` (runs Express on `http://localhost:10000` with nodemon)
- **Frontend**: `npm run client` (runs Vite dev server on `http://localhost:5173`)

### Step 4: Admin Initialization
Initialize the primary Super Admin account:
```bash
npm run setup-admin
```
Seed departmental admin accounts:
```bash
npm run seed-credentials
```

---

## 3. Production Build & Deployment

### Build Frontend
```bash
npm run build
```
Generates production-optimized static files in the `dist/` directory.

### Start Backend Production Server
```bash
npm run start
```

### Deployment Configuration

#### Vercel (Frontend)
- Build Command: `npm run build`
- Output Directory: `dist`
- Proxy / API rewrites are configured in `vercel.json` pointing to your Render backend instance.

#### Render (Backend)
- Build Command: `npm install`
- Start Command: `npm start`
- Root Directory: `.`
- Managed via `render.yaml`.
- For production persistence on Render, attach a persistent disk and configure `DB_PATH=/var/data/database.sqlite`.

