// Load environment variables FIRST — before any other require
require('dotenv').config();

const express = require('express');
const cors = require('cors');

const app = express();

// ── CORS ──────────────────────────────────────────────────────────────────────
// Allow requests from the frontend origin(s).
const allowedOrigins = [
    'https://secure-college-hostel-management-sy.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000'
];

if (process.env.FRONTEND_URL) {
    const envOrigin = process.env.FRONTEND_URL.trim().replace(/\/$/, '');
    if (!allowedOrigins.includes(envOrigin)) {
        allowedOrigins.push(envOrigin);
    }
}

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps, curl, or server-to-server)
        if (!origin) return callback(null, true);
        
        // Remove trailing slash for comparison
        const normalizedOrigin = origin.trim().replace(/\/$/, '');
        
        if (allowedOrigins.includes(normalizedOrigin)) {
            callback(null, true);
        } else {
            callback(null, false);
        }
    },
    credentials: true
}));

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json());

// ── Routes ────────────────────────────────────────────────────────────────────
const gatePassesRouter = require('../features/gatepass/gate-passes.routes');

app.use('/api/auth',          require('../features/auth/auth.routes'));
app.use('/api/student',       require('../features/students/student-portal.routes'));
app.use('/api/admin',         require('../features/admin/admin-students.routes'));
app.use('/api/students',      require('../features/students/students.routes'));
app.use('/api/gate-passes',   gatePassesRouter);
app.use('/api/admin/gate-passes', (req, res, next) => {
    req.url = '/admin' + (req.url === '/' ? '' : req.url);
    gatePassesRouter(req, res, next);
});
app.use('/api/requests',      require('../features/gatepass/gatepass-requests.routes'));
app.use('/api/gatepass',      require('../features/gatepass/gatepass.routes'));

const path = require('path');
const fs = require('fs');

// ── Health-check ──────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Secure Hostel Management API Running' });
});

// ── Serve Frontend SPA in Production / Unified Mode ────────────────────────────
const distPath = path.resolve(__dirname, '../../dist');
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.use((req, res, next) => {
        if (req.method === 'GET' && !req.path.startsWith('/api')) {
            return res.sendFile(path.join(distPath, 'index.html'));
        }
        next();
    });
} else {
    app.get('/', (req, res) => {
        res.json({ message: 'Secure Hostel Management API Running (Run npm run build to compile frontend)' });
    });
}

// ── Start server ──────────────────────────────────────────────────────────────
// Render (and most PaaS hosts) set process.env.PORT. We default to 10000
// which matches Render's default exposed port so health-checks succeed.
const PORT = process.env.PORT || 10000;
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
}

// Also export for any serverless / test usage
module.exports = app;
