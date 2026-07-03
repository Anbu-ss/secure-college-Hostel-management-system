// Load environment variables FIRST — before any other require
require('dotenv').config();

const express = require('express');
const cors = require('cors');

const app = express();

// ── CORS ──────────────────────────────────────────────────────────────────────
// Allow requests from the frontend origin defined in the environment (Render /
// local dev). Falls back to allowing all origins if FRONTEND_URL is not set.
const allowedOrigins = process.env.FRONTEND_URL
    ? [process.env.FRONTEND_URL]
    : true; // true = allow all (open CORS)

app.use(cors({ origin: allowedOrigins, credentials: true }));

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json());

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/requests', require('./routes/requests'));
app.use('/api/gatepass', require('./routes/gatepass'));
app.use('/api/security', require('./routes/security'));
app.use('/api/notifications', require('./routes/security')); // notifications via security router

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

