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
app.use('/api/auth',          require('../features/auth/auth.routes'));
app.use('/api/requests',      require('../features/gatepass/gatepass-requests.routes'));
app.use('/api/gatepass',      require('../features/gatepass/gatepass.routes'));
app.use('/api/security',      require('../features/security/security.routes'));
app.use('/api/notifications', require('../features/notifications/notifications.routes'));

// ── Health-check / root ───────────────────────────────────────────────────────
app.get('/', (req, res) => {
    res.json({ message: 'Secure Hostel Management API Running' });
});

// ── Start server ──────────────────────────────────────────────────────────────
// Render (and most PaaS hosts) set process.env.PORT. We default to 10000
// which matches Render's default exposed port so health-checks succeed.
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// Also export for any serverless / test usage
module.exports = app;
