const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/requests', require('./routes/requests'));
app.use('/api/gatepass', require('./routes/gatepass'));
app.use('/api/security', require('./routes/security'));
app.use('/api/notifications', require('./routes/security')); // notifications via security router

// Basic Route for testing
app.get('/', (req, res) => {
    res.json({ message: 'Secure Hostel Management API Running' });
});

// Export app for Vercel
module.exports = app;

// Start Server locally
if (require.main === module) {
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
}
