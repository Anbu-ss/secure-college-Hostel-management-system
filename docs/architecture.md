# Secure College Hostel Management System — Architecture Documentation

## 1. Overview
The **Secure College Hostel Management System** is a unified, full-stack, feature-based modular web application designed to handle student gate pass lifecycles, holiday management, department-level approvals, warden tracking, gate security check-in/out scanning, and administrative controls.

---

## 2. Architectural Paradigm: Feature-Based Modular Architecture
Instead of rigid separation between top-level backend and frontend directories, the system uses a cohesive, feature-sliced directory structure where business features are encapsulated:

```
secure-college-hostel/
│
├── public/                     # Static assets (images, icons, assets)
│   ├── images/
│   ├── icons/
│   └── assets/
│
├── src/                        # Application source code
│   ├── app/                    # Application root & shell
│   │   ├── App.jsx             # Main router & role route guards
│   │   └── main.jsx            # React root & global providers
│   │
│   ├── features/               # Business domain features
│   │   ├── auth/               # Authentication & session management
│   │   │   ├── AuthContext.jsx
│   │   │   ├── LandingLogin.jsx
│   │   │   ├── Login.jsx
│   │   │   ├── AdminLogin.jsx
│   │   │   ├── Register.jsx
│   │   │   ├── ForgotPassword.jsx
│   │   │   └── auth.routes.js
│   │   │
│   │   ├── gatepass/           # Gate pass workflow & requests
│   │   │   ├── ApplyPass.jsx
│   │   │   ├── StudentPasses.jsx
│   │   │   ├── StaffPending.jsx
│   │   │   ├── HODPending.jsx
│   │   │   ├── gatepass.routes.js
│   │   │   └── gatepass-requests.routes.js
│   │   │
│   │   ├── warden/             # Warden dashboard & approvals
│   │   │   ├── WardenDashboard.jsx
│   │   │   ├── WardenApproval.jsx
│   │   │   └── WardenPasses.jsx
│   │   │
│   │   ├── security/           # Gate security scanning & audit logs
│   │   │   ├── SecurityScan.jsx
│   │   │   ├── SecurityLogs.jsx
│   │   │   └── security.routes.js
│   │   │
│   │   └── admin/              # Administrative tools
│   │       ├── CreateAdminUser.jsx
│   │       ├── HolidayMode.jsx
│   │       └── BulkStudentUpload.jsx
│   │
│   ├── shared/                 # Shared frontend UI & configurations
│   │   ├── components/         # Layout.jsx, StatusBadge.jsx
│   │   ├── config/             # firebase.js (Client SDK)
│   │   └── styles/             # index.css (Tailwind styles)
│   │
│   ├── middleware/             # Express middlewares
│   │   └── auth.middleware.js  # JWT & role verification
│   │
│   ├── utils/                  # Cross-cutting utilities
│   │   ├── logger.js           # Server logger
│   │   ├── validators.js       # Department and role validators
│   │   ├── helpers.js          # Shared utility helpers
│   │   └── GatePassPDF.js      # Client-side PDF generator
│   │
│   └── server/                 # Express backend core
│       └── server.js           # Express app instance & route bindings
│
├── config/                     # Environment & database configuration
│   ├── app.config.js           # App port, env & CORS config
│   ├── database.config.js      # SQLite connection & schema initializer
│   └── firebase.config.js      # Firebase Admin SDK initialization
│
├── database/                   # Database files & migrations
│   ├── schema.sql              # SQL Schema reference
│   ├── database.sqlite         # SQLite database file
│   ├── migrations/             # Schema migration scripts
│   └── seeds/                  # Seed scripts
│
├── scripts/                    # Management & diagnosis CLI scripts
│   ├── setup-admin.js          # One-time super-admin setup
│   ├── seed-credentials.js     # Seed admin credentials
│   ├── check-user.js           # User lookup diagnostic
│   ├── diagnose.js             # Diagnostic tool
│   └── fix-departments.js      # Department patch utility
│
├── docs/                       # Project documentation
│   ├── architecture.md
│   ├── api-documentation.md
│   └── setup-guide.md
│
├── .env                        # Local environment variables
├── .env.example                # Sample environment template
├── .gitignore                  # Git ignore rules
├── package.json                # Unified NPM package manifest
├── vite.config.js              # Vite bundler configuration
├── render.yaml                 # Render cloud hosting descriptor
└── vercel.json                 # Vercel deployment descriptor
```

---

## 3. Technology Stack
- **Frontend**: React 18, React Router v7, Tailwind CSS v4, Lucide React, Axios, QRCode.react, jsPDF, html2canvas, XLSX.
- **Backend**: Node.js, Express 5, JSON Web Token (jsonwebtoken), bcryptjs, Google Auth Library, Firebase Admin SDK.
- **Database**: SQLite3 with `sqlite` promise wrapper.
- **Authentication**:
  - Students: Local SQLite password hashing (bcrypt) / Google OAuth ID tokens.
  - Faculty/Staff/Admin: Firebase Authentication combined with SQLite role mapping.

