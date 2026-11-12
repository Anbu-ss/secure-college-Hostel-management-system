const express = require('express');
const { verifyToken } = require('../../middleware/auth.middleware');
const pool = require('../../../config/database.config');

const router = express.Router();

// Get user notifications (GET /api/notifications or GET /api/notifications/all)
router.get(['/', '/all', '/notifications'], verifyToken, async (req, res) => {
    try {
        const [notifs] = await pool.execute(
            'SELECT * FROM Notifications WHERE UserID = ? ORDER BY CreatedAt DESC LIMIT 30',
            [req.user.id]
        );
        res.json(notifs);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error fetching notifications.' });
    }
});

// Mark all notifications as read (PUT /api/notifications/read)
router.put(['/read', '/notifications/read'], verifyToken, async (req, res) => {
    try {
        await pool.execute('UPDATE Notifications SET IsRead = 1 WHERE UserID = ?', [req.user.id]);
        res.json({ message: 'All notifications marked as read.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error.' });
    }
});

module.exports = router;

