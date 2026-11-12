# Secure College Hostel Management System

A digital gate pass and secure campus monitoring system enabling role-based online requests, multi-tier staff and HOD approvals, warden tracking, holiday mode auto-approvals, and QR-code-based security scanning for students.

---

## 🏗️ Unified Architecture

The project follows a **Feature-Based Modular Architecture** unified in a single root repository:

```
secure-college-hostel/
├── public/                 # Static assets (images, icons, assets)
├── src/
│   ├── app/                # App shell, main entry, router, API client
│   ├── features/           # Feature-sliced modules
│   │   ├── auth/           # Login, Register, AdminLogin, AuthContext, auth routes
│   │   ├── gatepass/       # ApplyPass, StudentPasses, Staff/HOD approvals, routes
│   │   ├── warden/         # Warden Dashboard, Approvals, All Passes
│   │   ├── security/       # QR Scanning, Security Gate Logs, Occupancy, routes
│   │   ├── admin/          # Admin account creation, Bulk upload, Holiday mode
│   │   └── notifications/  # Notification center routes
│   ├── shared/             # Shared components (Layout, StatusBadge), config, styles
│   ├── middleware/         # Auth & role verification middleware
│   ├── utils/              # Logger, validators, helpers, GatePassPDF
│   └── server/             # Express server setup and route mountings
├── config/                 # Database, Firebase, App, and Security configurations
├── database/               # Schema documentation, migrations, seeds, SQLite database
├── scripts/                # Admin setup, credential seeding, and diagnostic scripts
├── tests/                  # Unit and integration test suites
├── docs/                   # Architecture, API documentation, and setup guides
├── .env                    # Local environment variables (do not commit)
├── .env.example            # Environment variables template
├── package.json            # Unified dependencies and project scripts
├── vite.config.js          # Vite bundler configuration with SPA fallback
├── render.yaml             # Render backend deployment descriptor
└── vercel.json             # Vercel frontend deployment descriptor
```

---

## ⚡ Quick Start

### 1. Prerequisites
- Node.js (v18.0.0 or higher)
- npm (v8.0.0 or higher)

### 2. Installation
```bash
npm install
```

### 3. Environment Variables
Copy the template and fill in your values:
```bash
cp .env.example .env
```

### 4. Running the Application

| Command | Description |
|---|---|
| `npm run dev` | Runs both backend server and Vite frontend client concurrently |
| `npm run server` | Runs Express backend only on `http://localhost:5000` (or `PORT`) |
| `npm run client` | Runs Vite frontend client only on `http://localhost:5173` |
| `npm run build` | Builds frontend production bundle into `dist/` |
| `npm run start` | Starts backend production server |
| `npm run test` | Runs unit and integration test suites |

---

## 🔑 Administrative Scripts

```bash
# Set up initial Super Admin
npm run setup-admin

# Seed departmental and administrative credentials
npm run seed-credentials

# Check student or user account
npm run check-user

# Run system diagnostic
npm run diagnose
```

---

## 🚀 Deployment

- **Frontend (Vercel)**: Configured in `vercel.json` (`npm run build` targeting `dist`).
- **Backend (Render)**: Configured in `render.yaml` (`npm install` & `npm start` from root).
