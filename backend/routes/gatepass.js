const express = require('express');
const { verifyToken, verifyRole } = require('../middleware/auth');
const pool = require('../config/db');
const crypto = require('crypto');

const router = express.Router();

// HOD: Final Approve and Generate Pass
router.put('/hod/approve/:id', verifyToken, verifyRole(['HOD']), async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body; // 'HODApproved' or 'Rejected'

        await pool.execute('UPDATE GatePassRequests SET Status = ? WHERE ID = ? AND Status = "StaffApproved"', [status, id]);

        if (status === 'HODApproved') {
            // Generate QR Code Hash
            const qrHash = crypto.randomBytes(16).toString('hex') + '-' + id;
            
            // Insert into GatePasses table
            await pool.execute(
                'INSERT INTO GatePasses (RequestID, QRCodeHash) VALUES (?, ?)',
                [id, qrHash]
            );

            return res.json({ message: 'Request approved and Gate Pass generated.', qrHash });
        }

        res.json({ message: `Request ${status} by HOD.` });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error processing HOD approval.' });
    }
});

// Get Gate Pass Details by Hash (For Security/Scanners)
router.get('/verify/:qrHash', verifyToken, verifyRole(['Security', 'Admin']), async (req, res) => {
    try {
        const { qrHash } = req.params;

        const [passes] = await pool.execute(
            `SELECT p.ID as PassID, p.QRCodeHash, r.*, u.Name, s.RegisterNumber, s.Block, s.RoomNumber 
             FROM GatePasses p 
             JOIN GatePassRequests r ON p.RequestID = r.ID 
             JOIN Students s ON r.StudentID = s.UserID 
             JOIN Users u ON u.ID = s.UserID 
             WHERE p.QRCodeHash = ?`,
            [qrHash]
        );

        if (passes.length === 0) {
            return res.status(404).json({ message: 'Invalid or missing Gate Pass.' });
        }

        res.json(passes[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error verifying gate pass.' });
    }
});

// Warden/Admin: View All Approved Passes
router.get('/all', verifyToken, verifyRole(['Warden', 'Admin', 'Staff', 'HOD']), async (req, res) => {
    try {
        const [passes] = await pool.execute(
            `SELECT p.ID as PassID, p.IssuedAt, r.*, u.Name, s.RegisterNumber, s.Block, s.RoomNumber 
             FROM GatePasses p 
             JOIN GatePassRequests r ON p.RequestID = r.ID 
             JOIN Students s ON r.StudentID = s.UserID 
             JOIN Users u ON u.ID = s.UserID 
             ORDER BY p.IssuedAt DESC`
        );
        res.json(passes);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error fetching all gate passes.' });
    }
});

// Student: View own gate passes
router.get('/my-passes', verifyToken, verifyRole(['Student']), async (req, res) => {
    try {
        const [passes] = await pool.execute(
            `SELECT p.ID as PassID, p.QRCodeHash, p.IssuedAt, r.* 
             FROM GatePasses p 
             JOIN GatePassRequests r ON p.RequestID = r.ID 
             WHERE r.StudentID = ? 
             ORDER BY p.IssuedAt DESC`,
            [req.user.id]
        );
        res.json(passes);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error fetching your gate passes.' });
    }
});

module.exports = router;
