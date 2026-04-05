const express = require('express');
const { verifyToken, verifyRole } = require('../middleware/auth');
const pool = require('../config/db');

const router = express.Router();

// ─── Security / Warden: Scan QR → Full lifecycle logic ────────────────────────
router.post('/scan', verifyToken, verifyRole(['Security', 'Admin', 'Warden']), async (req, res) => {
    try {
        const { qrHash, action } = req.body; // action: 'Exit' or 'Entry'
        const jwt = require('jsonwebtoken');

        if (!['Exit', 'Entry'].includes(action)) {
            return res.status(400).json({ message: 'Invalid action. Must be Exit or Entry.' });
        }

        // 1. Find the gate pass
        const [passes] = await pool.execute(
            `SELECT p.*, r.PassType, r.Destination, r.ExpectedReturnTime, r.StudentID,
                    u.Name as StudentName, s.RegisterNumber, s.Block, s.RoomNumber, s.ParentPhone
             FROM GatePasses p
             JOIN GatePassRequests r ON r.ID = p.RequestID
             JOIN Students s ON s.UserID = r.StudentID
             JOIN Users u ON u.ID = s.UserID
             WHERE p.QRCodeHash = ?`,
            [qrHash]
        );

        if (passes.length === 0) {
            return res.status(404).json({
                scanResult: 'INVALID',
                color: 'red',
                message: 'Invalid QR Code — Pass not found.'
            });
        }

        const pass = passes[0];

        // 2. Check if already terminated
        if (pass.PassStatus === 'TERMINATED') {
            return res.status(400).json({
                scanResult: 'TERMINATED',
                color: 'orange',
                message: '⚠️ Error: This QR Code has already been used and is terminated.',
                studentName: pass.StudentName,
                registerNumber: pass.RegisterNumber
            });
        }

        // 3. Check expiry (Local passes only)
        if (pass.PassType === 'Local' && pass.ValidUntil) {
            const now = new Date();
            const expiry = new Date(pass.ValidUntil);
            if (now > expiry) {
                return res.status(400).json({
                    scanResult: 'EXPIRED',
                    color: 'red',
                    message: '❌ Error: Pass Expired. This 24-hour Local Outpass is no longer valid.',
                    studentName: pass.StudentName,
                    registerNumber: pass.RegisterNumber,
                    expiredAt: pass.ValidUntil
                });
            }
        }

        // 4. Verify JWT signature
        try {
            jwt.verify(qrHash, process.env.JWT_SECRET || 'hostel_secret_key', { ignoreExpiration: true });
        } catch (e) {
            return res.status(400).json({
                scanResult: 'INVALID',
                color: 'red',
                message: '❌ Invalid QR Code — tampered or forged token.'
            });
        }

        const now = new Date().toISOString();

        // 5. Exit scan
        if (action === 'Exit') {
            if (pass.PassStatus !== 'Active') {
                return res.status(400).json({
                    scanResult: 'ALREADY_EXITED',
                    color: 'orange',
                    message: `Student is already marked as OUT.`,
                    studentName: pass.StudentName
                });
            }

            await pool.execute(
                'UPDATE GatePasses SET PassStatus = ?, ExitTimestamp = ?, IsActive = 1 WHERE ID = ?',
                ['OUT', now, pass.ID]
            );
            await pool.execute(
                'INSERT INTO SecurityLogs (GatePassID, Action, ScannedBy) VALUES (?, ?, ?)',
                [pass.ID, 'Exit', req.user.id]
            );

            // Notify student
            const returnTime = new Date(pass.ExpectedReturnTime).toLocaleString('en-IN');
            await pool.execute(
                'INSERT INTO Notifications (UserID, Message) VALUES (?, ?)',
                [pass.StudentID, `Your ${pass.PassType} Outpass is now active. Please return by ${returnTime}.`]
            );

            // Parent notification (logged — Twilio-ready)
            if (pass.ParentPhone) {
                console.log(`[SMS-READY] To: ${pass.ParentPhone} — Your ward ${pass.StudentName} has left the hostel at ${now}. Expected return: ${returnTime}.`);
            }

            return res.json({
                scanResult: 'EXIT_APPROVED',
                color: 'green',
                message: `✅ Exit Approved — ${pass.StudentName} is now OFF-CAMPUS.`,
                studentName: pass.StudentName,
                registerNumber: pass.RegisterNumber,
                passType: pass.PassType,
                destination: pass.Destination,
                expectedReturn: pass.ExpectedReturnTime,
                validUntil: pass.ValidUntil
            });
        }

        // 6. Entry scan
        if (action === 'Entry') {
            if (pass.PassStatus !== 'OUT') {
                return res.status(400).json({
                    scanResult: 'NOT_OUT',
                    color: 'orange',
                    message: `Cannot log Entry — student has not been scanned as OUT yet.`,
                    studentName: pass.StudentName
                });
            }

            await pool.execute(
                'UPDATE GatePasses SET PassStatus = ?, EntryTimestamp = ?, IsActive = 0 WHERE ID = ?',
                ['TERMINATED', now, pass.ID]
            );
            await pool.execute(
                'INSERT INTO SecurityLogs (GatePassID, Action, ScannedBy) VALUES (?, ?, ?)',
                [pass.ID, 'Entry', req.user.id]
            );

            // Notify student
            await pool.execute(
                'INSERT INTO Notifications (UserID, Message) VALUES (?, ?)',
                [pass.StudentID, `Welcome back! Your ${pass.PassType} Outpass has been successfully closed. You are now ON-CAMPUS.`]
            );

            // Parent notification (logged — Twilio-ready)
            if (pass.ParentPhone) {
                console.log(`[SMS-READY] To: ${pass.ParentPhone} — Your ward ${pass.StudentName} has safely returned to the hostel at ${now}.`);
            }

            // Warden notification
            const [wardens] = await pool.execute(`SELECT ID FROM Users WHERE Role IN ('Warden','Admin')`);
            for (const w of wardens) {
                await pool.execute(
                    'INSERT INTO Notifications (UserID, Message) VALUES (?, ?)',
                    [w.ID, `Student ${pass.StudentName} (${pass.RegisterNumber}) has returned. Pass #${pass.ID} TERMINATED.`]
                );
            }

            return res.json({
                scanResult: 'ENTRY_CONFIRMED',
                color: 'blue',
                message: `✅ Entry Confirmed — ${pass.StudentName} is now ON-CAMPUS. Pass Closed.`,
                studentName: pass.StudentName,
                registerNumber: pass.RegisterNumber,
                exitTime: pass.ExitTimestamp,
                entryTime: now
            });
        }

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error logging security scan.' });
    }
});

// ─── Verify QR (get pass details before scan) ────────────────────────────────
router.get('/verify/:qrHash', verifyToken, verifyRole(['Security', 'Admin', 'Warden']), async (req, res) => {
    try {
        const { qrHash } = req.params;
        const jwt = require('jsonwebtoken');

        const [passes] = await pool.execute(
            `SELECT p.*, r.PassType, r.Destination, r.ExpectedReturnTime, r.Reason,
                    u.Name as StudentName, s.RegisterNumber, s.Block, s.RoomNumber
             FROM GatePasses p
             JOIN GatePassRequests r ON r.ID = p.RequestID
             JOIN Students s ON s.UserID = r.StudentID
             JOIN Users u ON u.ID = s.UserID
             WHERE p.QRCodeHash = ?`,
            [qrHash]
        );

        if (passes.length === 0) {
            return res.status(404).json({ valid: false, message: 'Invalid Gate Pass.' });
        }

        const pass = passes[0];
        const now = new Date();
        let scanResult = 'VALID';
        let color = 'green';
        let message = 'Pass is valid and ready to scan.';

        if (pass.PassStatus === 'TERMINATED') {
            scanResult = 'TERMINATED';
            color = 'orange';
            message = 'This pass has already been used and terminated.';
        } else if (pass.PassType === 'Local' && pass.ValidUntil && now > new Date(pass.ValidUntil)) {
            scanResult = 'EXPIRED';
            color = 'red';
            message = 'This 24-hour Local pass has expired.';
        } else if (pass.PassStatus === 'OUT') {
            scanResult = 'AWAITING_ENTRY';
            color = 'blue';
            message = 'Student is currently OUT — scan to confirm Entry.';
        } else {
            // Check if Local pass is expiring within 30 minutes
            if (pass.PassType === 'Local' && pass.ValidUntil) {
                const minsLeft = (new Date(pass.ValidUntil) - now) / 60000;
                if (minsLeft < 30) {
                    color = 'orange';
                    message = `Pass expiring soon — ${Math.round(minsLeft)} min left.`;
                }
            }
        }

        try {
            jwt.verify(qrHash, process.env.JWT_SECRET || 'hostel_secret_key', { ignoreExpiration: true });
        } catch {
            return res.status(400).json({ valid: false, scanResult: 'INVALID', message: 'Tampered QR code.' });
        }

        res.json({
            valid: scanResult === 'VALID' || scanResult === 'AWAITING_ENTRY',
            scanResult,
            color,
            message,
            pass: {
                id: pass.ID,
                passType: pass.PassType,
                passStatus: pass.PassStatus,
                studentName: pass.StudentName,
                registerNumber: pass.RegisterNumber,
                block: pass.Block,
                room: pass.RoomNumber,
                destination: pass.Destination,
                reason: pass.Reason,
                expectedReturn: pass.ExpectedReturnTime,
                validUntil: pass.ValidUntil,
                issuedAt: pass.IssuedAt,
                exitTimestamp: pass.ExitTimestamp,
                entryTimestamp: pass.EntryTimestamp
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error verifying gate pass.' });
    }
});

// ─── Logs — 3-month history with filters ─────────────────────────────────────
router.get('/logs', verifyToken, verifyRole(['Security', 'Admin', 'Warden', 'HOD']), async (req, res) => {
    try {
        const { passType, dateFrom, dateTo } = req.query;

        // Default: last 3 months
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        const from = dateFrom ? new Date(dateFrom).toISOString() : threeMonthsAgo.toISOString();
        const to   = dateTo   ? new Date(new Date(dateTo).setHours(23,59,59,999)).toISOString() : new Date().toISOString();

        const typeFilter = passType && ['Local','Home'].includes(passType) ? `AND r.PassType = '${passType}'` : '';

        const [logs] = await pool.execute(
            `SELECT
                l.ID, l.Action, l.Timestamp,
                sec.Name  AS ScannedBy,
                r.Destination, r.PassType, r.Reason,
                r.OutTime, r.ExpectedReturnTime,
                s.RegisterNumber, s.Block, s.RoomNumber,
                u.Name    AS StudentName,
                p.PassStatus, p.ValidUntil,
                p.ExitTimestamp, p.EntryTimestamp, p.IsActive
             FROM SecurityLogs l
             JOIN Users      sec ON sec.ID  = l.ScannedBy
             JOIN GatePasses   p ON p.ID    = l.GatePassID
             JOIN GatePassRequests r ON r.ID = p.RequestID
             JOIN Students     s ON s.UserID = r.StudentID
             JOIN Users        u ON u.ID    = s.UserID
             WHERE l.Timestamp >= ? AND l.Timestamp <= ?
             ${typeFilter}
             ORDER BY l.Timestamp DESC`,
            [from, to]
        );

        // Enrich with duration + late flag (computed server-side)
        const enriched = logs.map(log => {
            let durationMinutes = null;
            let lateReturn = false;

            if (log.ExitTimestamp && log.EntryTimestamp) {
                durationMinutes = Math.round(
                    (new Date(log.EntryTimestamp) - new Date(log.ExitTimestamp)) / 60000
                );
                if (log.PassType === 'Local' && durationMinutes > 24 * 60) lateReturn = true;
                if (log.PassType === 'Home' && log.ExpectedReturnTime &&
                    new Date(log.EntryTimestamp) > new Date(log.ExpectedReturnTime)) lateReturn = true;
            } else if (log.ExitTimestamp && !log.EntryTimestamp) {
                // Still out — check if overdue
                if (log.PassType === 'Local' && log.ValidUntil && new Date() > new Date(log.ValidUntil)) lateReturn = true;
                if (log.PassType === 'Home' && log.ExpectedReturnTime && new Date() > new Date(log.ExpectedReturnTime)) lateReturn = true;
            }

            return { ...log, durationMinutes, lateReturn };
        });

        res.json(enriched);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error fetching logs.' });
    }
});


// ─── Warden: Live Occupancy ───────────────────────────────────────────────────
router.get('/occupancy', verifyToken, verifyRole(['Warden', 'Admin']), async (req, res) => {
    try {
        const { dept } = req.query;
        const deptFilter = dept ? `AND s.Department = '${dept}'` : '';

        const [students] = await pool.execute(
            `SELECT u.Name, s.RegisterNumber, s.Block, s.RoomNumber, s.Department,
                    p.PassStatus, p.ID as PassID, r.PassType, r.ExpectedReturnTime,
                    p.ExitTimestamp, p.ValidUntil
             FROM Students s
             JOIN Users u ON u.ID = s.UserID
             LEFT JOIN GatePassRequests r ON r.StudentID = s.UserID
                 AND r.Status = 'WardenApproved'
             LEFT JOIN GatePasses p ON p.RequestID = r.ID
                 AND p.PassStatus IN ('Active','OUT')
                 AND p.IsActive = 1
             WHERE 1=1 ${deptFilter}
             ORDER BY s.Department, s.Block, s.RoomNumber`
        );

        const now = new Date();
        const occupancy = students.map(s => {
            let status = 'IN_CAMPUS';
            let lateReturn = false;

            if (s.PassStatus === 'OUT' || s.PassStatus === 'Active') {
                status = s.PassType === 'Local' ? 'LOCAL_OUT' : 'HOME_OUT';
                if (s.ExpectedReturnTime && now > new Date(s.ExpectedReturnTime) && !s.EntryTimestamp) {
                    lateReturn = true;
                }
            }

            return {
                name: s.Name,
                registerNumber: s.RegisterNumber,
                block: s.Block,
                room: s.RoomNumber,
                department: s.Department || 'N/A',
                status,
                lateReturn,
                passType: s.PassType || null,
                expectedReturn: s.ExpectedReturnTime || null,
                validUntil: s.ValidUntil || null,
                exitTimestamp: s.ExitTimestamp || null
            };
        });

        res.json(occupancy);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error fetching occupancy.' });
    }
});

// ─── Notifications: Get user's notifications ──────────────────────────────────
router.get('/notifications', verifyToken, async (req, res) => {
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

// ─── Notifications: Mark all as read ─────────────────────────────────────────
router.put('/notifications/read', verifyToken, async (req, res) => {
    try {
        await pool.execute('UPDATE Notifications SET IsRead = 1 WHERE UserID = ?', [req.user.id]);
        res.json({ message: 'All notifications marked as read.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error.' });
    }
});

module.exports = router;
