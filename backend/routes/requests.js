const express = require('express');
const { verifyToken, verifyRole } = require('../middleware/auth');
const pool = require('../config/db');

const router = express.Router();

// ─── Student: Apply for Gate Pass ───────────────────────────────────────────
router.post('/apply', verifyToken, verifyRole(['Student']), async (req, res) => {
    try {
        const { destination, reason, outTime, expectedReturnTime, passType } = req.body;

        if (!['Local', 'Home'].includes(passType)) {
            return res.status(400).json({ message: 'passType must be Local or Home.' });
        }

        const [result] = await pool.execute(
            'INSERT INTO GatePassRequests (StudentID, PassType, Destination, Reason, OutTime, ExpectedReturnTime, Status) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [req.user.id, passType, destination, reason, outTime, expectedReturnTime, 'Pending']
        );

        const newRequestId = result.insertId;

        // ── Holiday Mode Auto-Promotion ──────────────────────────────────────
        // For Home passes, check if the OutTime falls within an active holiday window.
        // If yes, skip Staff → HOD approval and jump directly to HODApproved.
        if (passType === 'Home') {
            // Normalize outTime to a date-only string for comparison
            const outDate = outTime.split('T')[0].split(' ')[0]; // handles both ISO and space-delimited

            const [windows] = await pool.execute(
                `SELECT * FROM HolidayWindows
                 WHERE IsActive = 1
                   AND StartDate <= ?
                   AND EndDate >= ?`,
                [outDate, outDate]
            );

            if (windows.length > 0) {
                const win = windows[0];
                // Auto-promote: skip Staff + HOD, land straight in Warden queue
                await pool.execute(
                    `UPDATE GatePassRequests
                     SET Status = 'HODApproved', HolidayWindowID = ?
                     WHERE ID = ?`,
                    [win.ID, newRequestId]
                );

                // Notify the student about the holiday fast-track
                await pool.execute(
                    'INSERT INTO Notifications (UserID, Message) VALUES (?, ?)',
                    [
                        req.user.id,
                        `🎉 Holiday Mode Active! Your Home Outpass for "${win.Name}" has been fast-tracked and is awaiting final Warden approval. No Staff/HOD sign-off needed.`
                    ]
                );

                return res.status(201).json({
                    message: 'Home outpass request auto-approved via Holiday Mode! Awaiting Warden final approval.',
                    requestId: newRequestId,
                    holidayMode: true,
                    windowName: win.Name,
                });
            }
        }

        res.status(201).json({ message: 'Gate pass request submitted.', requestId: newRequestId });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error while applying for gate pass.' });
    }
});

// ─── Student: View own requests ──────────────────────────────────────────────
router.get('/my-requests', verifyToken, verifyRole(['Student']), async (req, res) => {
    try {
        const [requests] = await pool.execute(
            `SELECT g.*, hw.Name AS HolidayWindowName 
             FROM GatePassRequests g 
             LEFT JOIN HolidayWindows hw ON g.HolidayWindowID = hw.ID
             WHERE g.StudentID = ? 
             ORDER BY g.CreatedAt DESC`,
            [req.user.id]
        );
        res.json(requests);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error fetching requests.' });
    }
});

// ─── Student: Get own profile (name, dept, block, room) ──────────────────────
router.get('/my-profile', verifyToken, verifyRole(['Student']), async (req, res) => {
    try {
        const [rows] = await pool.execute(
            `SELECT u.Name, u.Email, s.RegisterNumber, s.Block, s.RoomNumber, s.Department
             FROM Students s
             JOIN Users u ON u.ID = s.UserID
             WHERE s.UserID = ?`,
            [req.user.id]
        );
        if (rows.length === 0) return res.status(404).json({ message: 'Student profile not found.' });
        res.json(rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error fetching profile.' });
    }
});


// ─── Staff: Get Pending Requests (Home passes, same department only) ─────────
router.get('/staff/pending', verifyToken, verifyRole(['Staff']), async (req, res) => {
    try {
        // Get this staff member's department
        const [staffRows] = await pool.execute('SELECT Department FROM Users WHERE ID = ?', [req.user.id]);
        const staffDept = staffRows[0]?.Department || null;

        let query, params;
        if (staffDept) {
            // Dept set: show only matching department students
            query = `SELECT g.*, u.Name, s.RegisterNumber, s.Block, s.RoomNumber, s.Department AS StudentDept
             FROM GatePassRequests g
             JOIN Students s ON g.StudentID = s.UserID
             JOIN Users u ON u.ID = s.UserID
             WHERE g.Status = 'Pending'
               AND g.PassType = 'Home'
               AND (s.Department = ? OR s.Department IS NULL)
             ORDER BY g.CreatedAt DESC`;
            params = [staffDept];
        } else {
            // No dept on staff account: show ALL pending home requests
            query = `SELECT g.*, u.Name, s.RegisterNumber, s.Block, s.RoomNumber, s.Department AS StudentDept
             FROM GatePassRequests g
             JOIN Students s ON g.StudentID = s.UserID
             JOIN Users u ON u.ID = s.UserID
             WHERE g.Status = 'Pending' AND g.PassType = 'Home'
             ORDER BY g.CreatedAt DESC`;
            params = [];
        }

        const [requests] = await pool.execute(query, params);
        res.json(requests);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error fetching pending requests.' });
    }
});

// ─── Staff: Approve / Reject Home Request ────────────────────────────────────
router.put('/staff/approve/:id', verifyToken, verifyRole(['Staff']), async (req, res) => {
    try {
        const { id } = req.params;
        const { status, reason } = req.body;

        // Verify the student belongs to the same department as this staff member
        const [check] = await pool.execute(
            `SELECT g.ID FROM GatePassRequests g
             JOIN Students s ON g.StudentID = s.UserID
             WHERE g.ID = ? AND g.Status = 'Pending' AND g.PassType = 'Home'
               AND s.Department = (SELECT Department FROM Users WHERE ID = ?)`,
            [id, req.user.id]
        );
        if (check.length === 0) {
            return res.status(403).json({ message: 'Request not found or not in your department.' });
        }

        if (status === 'Rejected') {
            await pool.execute(
                `UPDATE GatePassRequests SET Status = ?, RejectedByRole = 'Staff', RejectedByName = ?, RejectionRemarks = ?, RejectedAt = CURRENT_TIMESTAMP WHERE ID = ?`,
                [status, req.user.name, reason || 'No reason provided', id]
            );
        } else {
            await pool.execute('UPDATE GatePassRequests SET Status = ? WHERE ID = ?', [status, id]);
        }

        const [rows] = await pool.execute('SELECT StudentID FROM GatePassRequests WHERE ID = ?', [id]);
        if (rows.length > 0) {
            const msg = status === 'StaffApproved'
                ? 'Your Home Outpass request has been approved by your Staff Tutor. Awaiting HOD approval.'
                : `Your Home Outpass request was rejected by Staff (${req.user.name}). Reason: ${reason || 'No reason provided.'}`;
            await pool.execute('INSERT INTO Notifications (UserID, Message) VALUES (?, ?)', [rows[0].StudentID, msg]);
        }

        res.json({ message: `Request ${status} by Staff.` });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error processing approval.' });
    }
});

// ─── HOD: Get Staff-Approved Requests (same department only) ─────────────────
router.get('/hod/pending', verifyToken, verifyRole(['HOD']), async (req, res) => {
    try {
        const [hodRows] = await pool.execute('SELECT Department FROM Users WHERE ID = ?', [req.user.id]);
        const hodDept = hodRows[0]?.Department || null;

        let query, params;
        if (hodDept) {
            query = `SELECT g.*, u.Name, s.RegisterNumber, s.Block, s.RoomNumber, s.Department AS StudentDept
             FROM GatePassRequests g
             JOIN Students s ON g.StudentID = s.UserID
             JOIN Users u ON u.ID = s.UserID
             WHERE g.Status = 'StaffApproved'
               AND g.PassType = 'Home'
               AND (s.Department = ? OR s.Department IS NULL)
             ORDER BY g.CreatedAt DESC`;
            params = [hodDept];
        } else {
            query = `SELECT g.*, u.Name, s.RegisterNumber, s.Block, s.RoomNumber, s.Department AS StudentDept
             FROM GatePassRequests g
             JOIN Students s ON g.StudentID = s.UserID
             JOIN Users u ON u.ID = s.UserID
             WHERE g.Status = 'StaffApproved' AND g.PassType = 'Home'
             ORDER BY g.CreatedAt DESC`;
            params = [];
        }

        const [requests] = await pool.execute(query, params);
        res.json(requests);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error fetching HOD pending requests.' });
    }
});

// ─── HOD: Approve / Reject (escalates to Warden) ────────────────────────────
router.put('/hod/approve/:id', verifyToken, verifyRole(['HOD']), async (req, res) => {
    try {
        const { id } = req.params;
        const { status, reason } = req.body; // 'HODApproved' or 'Rejected'

        if (status === 'Rejected') {
            await pool.execute(
                'UPDATE GatePassRequests SET Status = ?, RejectedByRole = "HOD", RejectedByName = ?, RejectionRemarks = ?, RejectedAt = CURRENT_TIMESTAMP WHERE ID = ? AND Status = "StaffApproved"',
                [status, req.user.name, reason || 'No reason provided', id]
            );
        } else {
            await pool.execute(
                'UPDATE GatePassRequests SET Status = ? WHERE ID = ? AND Status = "StaffApproved"',
                [status, id]
            );
        }

        const [rows] = await pool.execute('SELECT StudentID FROM GatePassRequests WHERE ID = ?', [id]);
        if (rows.length > 0) {
            const msg = status === 'HODApproved'
                ? 'Your Home Outpass has been approved by the HOD. Awaiting final Warden approval.'
                : `Your Home Outpass was rejected by HOD (${req.user.name}). Reason: ${reason || 'No reason provided.'}`;
            await pool.execute('INSERT INTO Notifications (UserID, Message) VALUES (?, ?)', [rows[0].StudentID, msg]);
        }

        res.json({ message: `Request ${status} by HOD.` });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error processing HOD approval.' });
    }
});

// ─── Warden: Get Pending Queue ────────────────────────────────────────────────
// Local passes: Status = 'Pending'
// Home passes: Status = 'HODApproved'
router.get('/warden/pending', verifyToken, verifyRole(['Warden', 'Admin']), async (req, res) => {
    try {
        const [requests] = await pool.execute(
            `SELECT g.*, u.Name, s.RegisterNumber, s.Block, s.RoomNumber,
                    hw.Name AS HolidayWindowName
             FROM GatePassRequests g
             JOIN Students s ON g.StudentID = s.UserID
             JOIN Users u ON u.ID = s.UserID
             LEFT JOIN HolidayWindows hw ON g.HolidayWindowID = hw.ID
             WHERE (g.PassType = 'Local' AND g.Status = 'Pending')
                OR (g.PassType = 'Home'  AND g.Status = 'HODApproved')
             ORDER BY g.CreatedAt DESC`
        );
        res.json(requests);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error fetching warden pending requests.' });
    }
});

// ─── Warden: Approve / Reject → generates pass ───────────────────────────────
router.put('/warden/approve/:id', verifyToken, verifyRole(['Warden', 'Admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const { status, reason, manualQRCode } = req.body; // 'WardenApproved', 'Rejected', and optional 'manualQRCode'

        const [reqRows] = await pool.execute('SELECT * FROM GatePassRequests WHERE ID = ?', [id]);
        if (reqRows.length === 0) return res.status(404).json({ message: 'Request not found.' });
        const passReq = reqRows[0];

        const validPrev = passReq.PassType === 'Local' ? 'Pending' : 'HODApproved';

        if (status === 'Rejected') {
            await pool.execute(
                `UPDATE GatePassRequests SET Status = ?, RejectedByRole = 'Warden', RejectedByName = ?, RejectionRemarks = ?, RejectedAt = CURRENT_TIMESTAMP WHERE ID = ? AND Status = ?`,
                [status, req.user.name, reason || 'No reason provided', id, validPrev]
            );
        } else {
            await pool.execute(
                `UPDATE GatePassRequests SET Status = ? WHERE ID = ? AND Status = ?`,
                [status, id, validPrev]
            );
        }

        if (status === 'WardenApproved') {
            const crypto = require('crypto');
            const jwt = require('jsonwebtoken');

            const [studentRows] = await pool.execute(
                'SELECT s.*, u.Name FROM Students s JOIN Users u ON u.ID = s.UserID WHERE s.UserID = ?',
                [passReq.StudentID]
            );
            const student = studentRows[0];

            // Local: 24-hour expiry. Home: no expiry (null)
            let validUntil = null;
            let qrHash = manualQRCode || null; // Use manual if provided

            if (!qrHash) {
                // Auto-generate if manual is empty
                let jwtPayload = {
                    studentId: passReq.StudentID,
                    passType: passReq.PassType,
                    requestId: parseInt(id),
                    registerNumber: student.RegisterNumber,
                    destination: passReq.Destination,
                };

                if (passReq.PassType === 'Local') {
                    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
                    validUntil = expiry.toISOString();
                    jwtPayload.exp = Math.floor(expiry.getTime() / 1000);
                }
                qrHash = jwt.sign(jwtPayload, process.env.JWT_SECRET || 'hostel_secret_key');
            } else {
                // For manual codes, we still set the 24h expiry for Local passes
                if (passReq.PassType === 'Local') {
                    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
                    validUntil = expiry.toISOString();
                }
            }

            await pool.execute(
                'INSERT INTO GatePasses (RequestID, QRCodeHash, ValidUntil, PassStatus, IsActive) VALUES (?, ?, ?, ?, ?)',
                [id, qrHash, validUntil, 'Active', 1]
            );

            // Notify student
            const returnTime = new Date(passReq.ExpectedReturnTime).toLocaleString('en-IN');
            const notifMsg = passReq.PassType === 'Local'
                ? `Your Local Outpass has been approved by the Warden! Valid for 24 hours. Expected return: ${returnTime}.`
                : `Your Home Outpass has been fully approved! Show your QR code at the gate. Expected return: ${returnTime}.`;
            await pool.execute('INSERT INTO Notifications (UserID, Message) VALUES (?, ?)', [passReq.StudentID, notifMsg]);

            return res.json({ message: 'Pass approved and QR code generated.', qrHash });
        }

        // Notification for rejection
        const [reqRow2] = await pool.execute('SELECT StudentID FROM GatePassRequests WHERE ID = ?', [id]);
        if (reqRow2.length > 0) {
            const rejectionMsg = `Your outpass request was rejected by the Warden (${req.user.name}). Reason: ${reason || 'No reason provided.'}`;
            await pool.execute(
                'INSERT INTO Notifications (UserID, Message) VALUES (?, ?)',
                [reqRow2[0].StudentID, rejectionMsg]
            );
        }

        res.json({ message: `Request ${status} by Warden.` });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error processing warden approval.' });
    }
});

// ════════════════════════════════════════════════════════════════════════════
//  HOLIDAY MODE — Admin/Warden Endpoints
// ════════════════════════════════════════════════════════════════════════════

// ─── List all holiday windows ────────────────────────────────────────────────
router.get('/admin/holiday-windows', verifyToken, verifyRole(['Admin', 'Warden']), async (req, res) => {
    try {
        const [windows] = await pool.execute(
            `SELECT hw.*,
                    u.Name AS CreatedByName,
                    (SELECT COUNT(*) FROM GatePassRequests WHERE HolidayWindowID = hw.ID) AS AutoApprovedCount
             FROM HolidayWindows hw
             LEFT JOIN Users u ON u.ID = hw.CreatedByID
             ORDER BY hw.CreatedAt DESC`
        );
        res.json(windows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error fetching holiday windows.' });
    }
});

// ─── Create a new holiday window ─────────────────────────────────────────────
router.post('/admin/holiday-windows', verifyToken, verifyRole(['Admin', 'Warden']), async (req, res) => {
    try {
        const { name, startDate, endDate } = req.body;

        if (!name || !startDate || !endDate) {
            return res.status(400).json({ message: 'name, startDate, and endDate are required.' });
        }
        if (new Date(startDate) > new Date(endDate)) {
            return res.status(400).json({ message: 'startDate must be before or equal to endDate.' });
        }

        const [result] = await pool.execute(
            'INSERT INTO HolidayWindows (Name, StartDate, EndDate, IsActive, CreatedByID) VALUES (?, ?, ?, 1, ?)',
            [name, startDate, endDate, req.user.id]
        );

        res.status(201).json({
            message: `Holiday window "${name}" created successfully.`,
            windowId: result.insertId,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error creating holiday window.' });
    }
});

// ─── Toggle active/inactive a holiday window ──────────────────────────────────
router.delete('/admin/holiday-windows/:id', verifyToken, verifyRole(['Admin', 'Warden']), async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.execute('SELECT * FROM HolidayWindows WHERE ID = ?', [id]);
        if (rows.length === 0) return res.status(404).json({ message: 'Holiday window not found.' });

        // Toggle IsActive
        const newActive = rows[0].IsActive ? 0 : 1;
        await pool.execute('UPDATE HolidayWindows SET IsActive = ? WHERE ID = ?', [newActive, id]);

        res.json({ message: `Holiday window ${newActive ? 'activated' : 'deactivated'}.`, IsActive: newActive });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error toggling holiday window.' });
    }
});

// ─── Bulk Apply: retroactively promote existing Pending/StaffApproved requests ─
router.post('/admin/holiday-windows/:id/apply-bulk', verifyToken, verifyRole(['Admin', 'Warden']), async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.execute('SELECT * FROM HolidayWindows WHERE ID = ?', [id]);
        if (rows.length === 0) return res.status(404).json({ message: 'Holiday window not found.' });
        const win = rows[0];

        // Find all Home pass requests (Pending or StaffApproved) whose OutTime falls within this window
        // and who haven't already been promoted by this feature
        const [eligible] = await pool.execute(
            `SELECT g.ID, g.StudentID FROM GatePassRequests g
             WHERE g.PassType = 'Home'
               AND g.Status IN ('Pending', 'StaffApproved')
               AND g.HolidayWindowID IS NULL
               AND DATE(g.OutTime) >= ?
               AND DATE(g.OutTime) <= ?`,
            [win.StartDate, win.EndDate]
        );

        if (eligible.length === 0) {
            return res.json({ message: 'No eligible requests found for bulk promotion.', promoted: 0 });
        }

        // Promote each request to HODApproved and send notification
        let promoted = 0;
        for (const req_ of eligible) {
            await pool.execute(
                `UPDATE GatePassRequests SET Status = 'HODApproved', HolidayWindowID = ? WHERE ID = ?`,
                [win.ID, req_.ID]
            );
            await pool.execute(
                'INSERT INTO Notifications (UserID, Message) VALUES (?, ?)',
                [
                    req_.StudentID,
                    `🎉 Holiday Mode! Your Home Outpass has been fast-tracked under "${win.Name}". It is now awaiting final Warden approval.`
                ]
            );
            promoted++;
        }

        res.json({
            message: `Bulk promotion complete. ${promoted} request(s) fast-tracked to Warden queue.`,
            promoted,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error during bulk promotion.' });
    }
});

module.exports = router;
