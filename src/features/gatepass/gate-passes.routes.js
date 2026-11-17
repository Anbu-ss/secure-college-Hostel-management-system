const express = require('express');
const router = express.Router();
const { supabase } = require('../../../config/supabase.config');
const sqlitePool = require('../../../config/database.config');
const { verifyToken, verifyRole } = require('../../middleware/auth.middleware');

// Constant permanent college gate identifier
const PERMANENT_GATE_IDENTIFIER = 'GATE_DMI_MAIN_01';

// Rate limiting in-memory store for gate scans
const scanRateLimit = new Map();
const rateLimitGateScan = (req, res, next) => {
    const key = req.user?.id || req.ip || 'client';
    const now = Date.now();
    const last = scanRateLimit.get(key) || 0;
    if (now - last < 2000) {
        return res.status(429).json({ success: false, message: 'Please wait a moment before scanning again.' });
    }
    scanRateLimit.set(key, now);
    next();
};

// Helper to resolve student Supabase ID and SQLite UserID
async function resolveStudent(email, userId = null) {
    const cleanEmail = (email || '').trim().toLowerCase();
    let supaStudent = null;
    let sqliteUser = null;
    let supaProfile = null;

    try {
        const { data: st } = await supabase
            .from('students')
            .select('id, user_id, student_code, register_number, student_name, college_email')
            .eq('college_email', cleanEmail)
            .maybeSingle();
        supaStudent = st;
    } catch (_) { }

    try {
        if (userId && String(userId).length === 36) {
            const { data: prof } = await supabase
                .from('profiles')
                .select('id')
                .eq('id', userId)
                .maybeSingle();
            supaProfile = prof;
        }
        if (!supaProfile && cleanEmail) {
            const { data: prof } = await supabase
                .from('profiles')
                .select('id')
                .eq('email', cleanEmail)
                .maybeSingle();
            supaProfile = prof;
        }
    } catch (_) { }

    try {
        const [rows] = await sqlitePool.execute(
            `SELECT u.ID as userId, u.Name, u.Email, s.RegisterNumber
             FROM Users u
             LEFT JOIN Students s ON s.UserID = u.ID
             WHERE LOWER(u.Email) = ?`,
            [cleanEmail]
        );
        if (rows.length > 0) sqliteUser = rows[0];
    } catch (_) { }

    return { supaStudent, sqliteUser, supaProfile };
}

// ── 1. POST /api/gate-passes – Student submits new Gate Pass request ──────────
router.post('/', verifyToken, async (req, res) => {
    try {
        let {
            reason,
            destination,
            departureDate,
            departureTime,
            returnDate,
            returnTime,
            additionalDescription,
            outTime,
            expectedReturnTime,
            passType
        } = req.body;

        if (outTime && (!departureDate || !departureTime)) {
            const parts = outTime.split('T');
            departureDate = departureDate || parts[0];
            departureTime = departureTime || (parts[1] ? parts[1].slice(0, 5) : '00:00');
        }
        if (expectedReturnTime && (!returnDate || !returnTime)) {
            const parts = expectedReturnTime.split('T');
            returnDate = returnDate || parts[0];
            returnTime = returnTime || (parts[1] ? parts[1].slice(0, 5) : '23:59');
        }

        if (!reason || !destination || !departureDate || !departureTime || !returnDate || !returnTime) {
            return res.status(400).json({
                success: false,
                message: 'Reason, destination, departure date/time, and return date/time are all required.'
            });
        }

        const departureAt = new Date(`${departureDate}T${departureTime}`);
        const expectedReturnAt = new Date(`${returnDate}T${returnTime}`);

        if (isNaN(departureAt.getTime()) || isNaN(expectedReturnAt.getTime())) {
            return res.status(400).json({ success: false, message: 'Invalid departure or return date/time format.' });
        }

        if (expectedReturnAt <= departureAt) {
            return res.status(400).json({
                success: false,
                message: 'Expected return time must be strictly after departure time.'
            });
        }

        const { supaStudent, sqliteUser, supaProfile } = await resolveStudent(req.user.email, req.user.id);
        const studentUserId = supaProfile?.id || null;

        // Check if student already has an active or pending request
        try {
            const { data: activeSupas } = await supabase
                .from('gate_pass_requests')
                .select('id, status')
                .or(`student_user_id.eq.${studentUserId || '00000000-0000-0000-0000-000000000000'},student_id.eq.${supaStudent?.id || 0}`)
                .in('status', ['PENDING', 'APPROVED', 'EXITED'])
                .limit(1);

            if (activeSupas && activeSupas.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: `You already have an active Gate Pass with status '${activeSupas[0].status}'. You cannot apply for a new pass until your current pass is completed or closed.`
                });
            }
        } catch (_) { }

        // Insert into Supabase gate_pass_requests
        let newRequest = null;
        try {
            const { data, error } = await supabase
                .from('gate_pass_requests')
                .insert({
                    student_id: supaStudent?.id || null,
                    student_user_id: studentUserId || null,
                    reason: reason.trim(),
                    destination: destination.trim(),
                    departure_at: departureAt.toISOString(),
                    expected_return_at: expectedReturnAt.toISOString(),
                    additional_description: additionalDescription ? additionalDescription.trim() : null,
                    status: 'PENDING'
                })
                .select()
                .single();

            if (error) console.warn('Supabase insert gate_pass_request notice:', error.message);
            newRequest = data;
        } catch (err) {
            console.warn('Supabase request insert error:', err.message);
        }

        // Dual-write to SQLite GatePassRequests for local compatibility
        let sqliteInsertId = null;
        try {
            const sId = sqliteUser?.userId || req.user.id;
            const [insertRes] = await sqlitePool.execute(
                `INSERT INTO GatePassRequests (StudentID, PassType, Destination, Reason, OutTime, ExpectedReturnTime, Status, RejectionRemarks)
                 VALUES (?, 'GatePass', ?, ?, ?, ?, 'Pending', ?)`,
                [sId, destination.trim(), reason.trim(), departureAt.toISOString(), expectedReturnAt.toISOString(), additionalDescription || '']
            );
            sqliteInsertId = insertRes.insertId;
        } catch (sqErr) {
            console.warn('SQLite dual-write notice:', sqErr.message);
        }

        const responseId = newRequest?.id || String(sqliteInsertId || Date.now());

        res.status(201).json({
            success: true,
            message: 'Gate Pass request submitted successfully. It is now pending Administrator review.',
            request: {
                id: responseId,
                status: 'PENDING',
                reason,
                destination,
                departureAt: departureAt.toISOString(),
                expectedReturnAt: expectedReturnAt.toISOString(),
                createdAt: new Date().toISOString()
            }
        });

    } catch (err) {
        console.error('Error submitting gate pass request:', err);
        res.status(500).json({ success: false, message: 'Server error while submitting gate pass request.' });
    }
});

// ── 2. GET /api/gate-passes/my – Student views own Gate Pass history ──────────
router.get('/my', verifyToken, async (req, res) => {
    try {
        const { supaStudent, sqliteUser, supaProfile } = await resolveStudent(req.user.email, req.user.id);
        const studentUserId = supaProfile?.id || null;

        if (!studentUserId && !supaStudent?.id && !sqliteUser?.userId) {
            return res.json({ success: true, count: 0, requests: [] });
        }

        let requestsList = [];

        // Fetch from Supabase
        try {
            let filterConditions = [];
            if (studentUserId) filterConditions.push(`student_user_id.eq.${studentUserId}`);
            if (supaStudent?.id) filterConditions.push(`student_id.eq.${supaStudent.id}`);

            if (filterConditions.length > 0) {
                let query = supabase
                    .from('gate_pass_requests')
                    .select(`
                        id, reason, destination, departure_at, expected_return_at, additional_description, status, created_at, updated_at,
                        gate_pass_approvals ( decision, rejection_reason, approved_at ),
                        gate_transactions ( transaction_type, transaction_status, scanned_at )
                    `)
                    .or(filterConditions.join(','))
                    .order('created_at', { ascending: false });

                const { data, error } = await query;
                if (data && data.length > 0) {
                    requestsList = data.map(r => {
                        const approvals = Array.isArray(r.gate_pass_approvals) ? r.gate_pass_approvals : (r.gate_pass_approvals ? [r.gate_pass_approvals] : []);
                        const lastApproval = approvals[approvals.length - 1];
                        const transactions = Array.isArray(r.gate_transactions) ? r.gate_transactions : [];

                        return {
                            id: r.id,
                            reason: r.reason,
                            destination: r.destination,
                            departureAt: r.departure_at,
                            expectedReturnAt: r.expected_return_at,
                            additionalDescription: r.additional_description,
                            status: r.status,
                            createdAt: r.created_at,
                            updatedAt: r.updated_at,
                            rejectionReason: lastApproval?.decision === 'REJECTED' ? lastApproval.rejection_reason : null,
                            approvedAt: lastApproval?.decision === 'APPROVED' ? lastApproval.approved_at : null,
                            transactions: transactions.map(t => ({
                                type: t.transaction_type,
                                scannedAt: t.scanned_at
                            }))
                        };
                    });
                }
            }
        } catch (supaErr) {
            console.warn('Supabase fetch my passes notice:', supaErr.message);
        }

        // Fallback to SQLite if Supabase returns none
        if (requestsList.length === 0 && sqliteUser?.userId) {
            try {
                const [rows] = await sqlitePool.execute(
                    `SELECT r.*, gp.PassStatus, gp.ExitTimestamp, gp.EntryTimestamp
                     FROM GatePassRequests r
                     LEFT JOIN GatePasses gp ON gp.RequestID = r.ID
                     WHERE r.StudentID = ?
                     ORDER BY r.ID DESC`,
                    [sqliteUser.userId]
                );

                requestsList = rows.map(r => {
                    let status = (r.Status || 'PENDING').toUpperCase();
                    if (r.PassStatus === 'Active') status = 'APPROVED';
                    if (r.ExitTimestamp && !r.EntryTimestamp) status = 'EXITED';
                    if (r.EntryTimestamp) status = 'RETURNED';

                    return {
                        id: String(r.ID),
                        reason: r.Reason,
                        destination: r.Destination,
                        departureAt: r.OutTime,
                        expectedReturnAt: r.ExpectedReturnTime,
                        additionalDescription: r.RejectionRemarks || '',
                        status,
                        createdAt: r.CreatedAt,
                        rejectionReason: r.RejectionRemarks,
                        transactions: [
                            ...(r.ExitTimestamp ? [{ type: 'EXIT', scannedAt: r.ExitTimestamp }] : []),
                            ...(r.EntryTimestamp ? [{ type: 'RETURN', scannedAt: r.EntryTimestamp }] : [])
                        ]
                    };
                });
            } catch (_) { }
        }

        res.json({ success: true, count: requestsList.length, requests: requestsList });

    } catch (err) {
        console.error('Error fetching student gate passes:', err);
        res.status(500).json({ success: false, message: 'Server error while fetching gate passes.' });
    }
});

// ── 3. GET /api/gate-passes/scanner-status – Checks QR scanner eligibility ──
router.get('/scanner-status', verifyToken, async (req, res) => {
    try {
        const { supaStudent, sqliteUser, supaProfile } = await resolveStudent(req.user.email, req.user.id);
        const studentUserId = supaProfile?.id || null;

        // Query active pass
        let activePass = null;

        try {
            let query = supabase
                .from('gate_pass_requests')
                .select('id, reason, destination, departure_at, expected_return_at, status, created_at')
                .order('created_at', { ascending: false })
                .limit(1);

            if (studentUserId) {
                query = query.or(`student_user_id.eq.${studentUserId},student_id.eq.${supaStudent?.id || 0}`);
            } else if (supaStudent?.id) {
                query = query.eq('student_id', supaStudent.id);
            }

            const { data } = await query;
            if (data && data.length > 0) {
                activePass = data[0];
            }
        } catch (_) { }

        // Fallback SQLite check
        if (!activePass && sqliteUser?.userId) {
            try {
                const [rows] = await sqlitePool.execute(
                    `SELECT r.*, gp.PassStatus, gp.ExitTimestamp, gp.EntryTimestamp
                     FROM GatePassRequests r
                     LEFT JOIN GatePasses gp ON gp.RequestID = r.ID
                     WHERE r.StudentID = ?
                     ORDER BY r.ID DESC LIMIT 1`,
                    [sqliteUser.userId]
                );
                if (rows.length > 0) {
                    const r = rows[0];
                    let status = (r.Status || 'PENDING').toUpperCase();
                    if (r.PassStatus === 'Active') status = 'APPROVED';
                    if (r.ExitTimestamp && !r.EntryTimestamp) status = 'EXITED';
                    if (r.EntryTimestamp) status = 'RETURNED';

                    activePass = {
                        id: String(r.ID),
                        status,
                        departure_at: r.OutTime,
                        expected_return_at: r.ExpectedReturnTime,
                        reason: r.Reason,
                        destination: r.Destination
                    };
                }
            } catch (_) { }
        }

        // Before Admin Approval: Scanner MUST be in locked state
        if (!activePass) {
            return res.json({
                isEligible: false,
                isLocked: true,
                status: 'NO_PASS',
                message: 'No Gate Pass application found. Please apply for a gate pass first.',
                gateIdentifier: PERMANENT_GATE_IDENTIFIER
            });
        }

        const status = (activePass.status || '').toUpperCase();

        if (status === 'PENDING') {
            return res.json({
                isEligible: false,
                isLocked: true,
                status: 'PENDING',
                passId: activePass.id,
                message: 'Your Gate Pass is waiting for Admin approval.',
                gateIdentifier: PERMANENT_GATE_IDENTIFIER
            });
        }

        if (status === 'REJECTED') {
            return res.json({
                isEligible: false,
                isLocked: true,
                status: 'REJECTED',
                passId: activePass.id,
                message: 'Your Gate Pass request was not approved by administration.',
                gateIdentifier: PERMANENT_GATE_IDENTIFIER
            });
        }

        if (status === 'RETURNED' || status === 'EXPIRED') {
            return res.json({
                isEligible: false,
                isLocked: true,
                status,
                passId: activePass.id,
                message: 'This Gate Pass cycle is completed. Please submit a new request when required.',
                gateIdentifier: PERMANENT_GATE_IDENTIFIER
            });
        }

        // Status is APPROVED: Eligible for EXIT scan
        if (status === 'APPROVED') {
            return res.json({
                isEligible: true,
                isLocked: false,
                status: 'APPROVED',
                nextAction: 'EXIT',
                passId: activePass.id,
                departureAt: activePass.departure_at,
                expectedReturnAt: activePass.expected_return_at,
                destination: activePass.destination,
                message: 'Your Gate Pass is Approved! You can now scan the QR code at the college gate to record your departure.',
                gateIdentifier: PERMANENT_GATE_IDENTIFIER
            });
        }

        // Status is EXITED: Eligible for RETURN scan
        if (status === 'EXITED') {
            return res.json({
                isEligible: true,
                isLocked: false,
                status: 'EXITED',
                nextAction: 'RETURN',
                passId: activePass.id,
                departureAt: activePass.departure_at,
                expectedReturnAt: activePass.expected_return_at,
                destination: activePass.destination,
                message: 'You have exited the campus. Scan the college gate QR code upon your return to record your entry.',
                gateIdentifier: PERMANENT_GATE_IDENTIFIER
            });
        }

        res.json({
            isEligible: false,
            isLocked: true,
            status,
            message: 'Your Gate Pass is waiting for Admin approval.'
        });

    } catch (err) {
        console.error('Error fetching scanner status:', err);
        res.status(500).json({ success: false, message: 'Server error checking scanner eligibility.' });
    }
});

// ── 4. POST /api/gate-passes/scan-gate-qr – Process physical permanent Gate QR scan ──
router.post('/scan-gate-qr', verifyToken, rateLimitGateScan, async (req, res) => {
    try {
        const { gateIdentifier } = req.body;

        if (!gateIdentifier) {
            return res.status(400).json({
                success: false,
                title: 'Invalid Scan',
                message: 'Gate identifier is required from scanned QR code.'
            });
        }

        // 1. Validate the one permanent college gate QR code
        let gateLocation = null;
        try {
            const { data } = await supabase
                .from('gate_locations')
                .select('id, gate_identifier, gate_name, is_active')
                .eq('gate_identifier', gateIdentifier.trim())
                .eq('is_active', true)
                .maybeSingle();
            gateLocation = data;
        } catch (_) { }

        if (!gateLocation && gateIdentifier.trim() === PERMANENT_GATE_IDENTIFIER) {
            // Local fallback match
            gateLocation = {
                id: '76ab6ee2-b048-4bdc-a763-2e310ebc05ee',
                gate_identifier: PERMANENT_GATE_IDENTIFIER,
                gate_name: 'DMI College Main Security Gate'
            };
        }

        if (!gateLocation) {
            return res.status(400).json({
                success: false,
                title: 'Invalid Gate QR',
                message: 'Unrecognized or inactive college gate QR code. Please scan the official permanent QR code at the college gate.'
            });
        }

        // 2. Identify the authenticated student
        const { supaStudent, sqliteUser, supaProfile } = await resolveStudent(req.user.email, req.user.id);
        const studentUserId = supaProfile?.id || null;

        // 3. Find active gate pass for student
        let pass = null;
        try {
            let query = supabase
                .from('gate_pass_requests')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(1);

            if (studentUserId) {
                query = query.or(`student_user_id.eq.${studentUserId},student_id.eq.${supaStudent?.id || 0}`);
            } else if (supaStudent?.id) {
                query = query.eq('student_id', supaStudent.id);
            }

            const { data } = await query;
            if (data && data.length > 0) pass = data[0];
        } catch (_) { }

        // Fallback to SQLite if needed
        if (!pass && sqliteUser?.userId) {
            try {
                const [rows] = await sqlitePool.execute(
                    `SELECT r.*, gp.PassStatus, gp.ExitTimestamp, gp.EntryTimestamp, gp.ID as PassID
                     FROM GatePassRequests r
                     LEFT JOIN GatePasses gp ON gp.RequestID = r.ID
                     WHERE r.StudentID = ?
                     ORDER BY r.ID DESC LIMIT 1`,
                    [sqliteUser.userId]
                );
                if (rows.length > 0) {
                    const r = rows[0];
                    let s = (r.Status || 'PENDING').toUpperCase();
                    if (r.PassStatus === 'Active') s = 'APPROVED';
                    if (r.ExitTimestamp && !r.EntryTimestamp) s = 'EXITED';
                    if (r.EntryTimestamp) s = 'RETURNED';

                    pass = {
                        id: String(r.ID),
                        sqlitePassId: r.PassID,
                        status: s,
                        student_id: r.StudentID,
                        destination: r.Destination,
                        reason: r.Reason,
                        departure_at: r.OutTime,
                        expected_return_at: r.ExpectedReturnTime
                    };
                }
            } catch (_) { }
        }

        if (!pass) {
            return res.status(404).json({
                success: false,
                title: 'No Active Pass',
                message: 'No Gate Pass record found for your account. Please submit an application first.'
            });
        }

        const currentStatus = (pass.status || '').toUpperCase();

        if (currentStatus === 'PENDING') {
            return res.status(403).json({
                success: false,
                title: 'Approval Required',
                message: 'Your Gate Pass is waiting for Admin approval. You cannot exit until approved.'
            });
        }

        if (currentStatus === 'REJECTED') {
            return res.status(403).json({
                success: false,
                title: 'Pass Rejected',
                message: 'Your Gate Pass request was rejected by administration. QR scanning is disabled.'
            });
        }

        if (currentStatus === 'RETURNED') {
            return res.status(400).json({
                success: false,
                title: 'Pass Already Completed',
                message: 'This Gate Pass has already been used for entry and return. Submit a new pass for your next departure.'
            });
        }

        // ── Transaction Branch 1: First Scan = EXITED ────────────────────────
        if (currentStatus === 'APPROVED') {
            const nowIso = new Date().toISOString();

            // 1. Update Supabase gate_pass_requests
            try {
                await supabase
                    .from('gate_pass_requests')
                    .update({ status: 'EXITED', updated_at: nowIso })
                    .eq('id', pass.id);
            } catch (err) {
                console.warn('Supabase status update to EXITED notice:', err.message);
            }

            // 2. Insert Supabase gate_transactions record
            try {
                await supabase
                    .from('gate_transactions')
                    .insert({
                        gate_pass_request_id: pass.id,
                        student_id: pass.student_id || supaStudent?.id || null,
                        gate_location_id: gateLocation.id,
                        transaction_type: 'EXIT',
                        transaction_status: 'SUCCESS',
                        scanned_at: nowIso
                    });
            } catch (txErr) {
                console.warn('Supabase exit transaction notice:', txErr.message);
            }

            // 3. Mirror sync to SQLite
            try {
                await sqlitePool.execute(
                    `UPDATE GatePassRequests SET Status = 'Exited' WHERE ID = ?`,
                    [pass.id]
                );
                await sqlitePool.execute(
                    `UPDATE GatePasses SET ExitTimestamp = CURRENT_TIMESTAMP WHERE RequestID = ?`,
                    [pass.id]
                );
            } catch (_) { }

            return res.json({
                success: true,
                transactionType: 'EXIT',
                newStatus: 'EXITED',
                passStatus: 'EXITED',
                transaction: { type: 'EXIT', scannedAt: nowIso },
                title: 'Gate Pass Scan Successful!',
                message: 'Your Gate Pass is Successfully Verified! Your exit has been recorded.',
                gateName: gateLocation.gate_name,
                scannedAt: nowIso
            });
        }

        // ── Transaction Branch 2: Second Scan = RETURNED ─────────────────────
        if (currentStatus === 'EXITED') {
            const nowIso = new Date().toISOString();

            // 1. Update Supabase gate_pass_requests
            try {
                await supabase
                    .from('gate_pass_requests')
                    .update({ status: 'RETURNED', updated_at: nowIso })
                    .eq('id', pass.id);
            } catch (err) {
                console.warn('Supabase status update to RETURNED notice:', err.message);
            }

            // 2. Insert Supabase gate_transactions record
            try {
                await supabase
                    .from('gate_transactions')
                    .insert({
                        gate_pass_request_id: pass.id,
                        student_id: pass.student_id || supaStudent?.id || null,
                        gate_location_id: gateLocation.id,
                        transaction_type: 'RETURN',
                        transaction_status: 'SUCCESS',
                        scanned_at: nowIso
                    });
            } catch (txErr) {
                console.warn('Supabase return transaction notice:', txErr.message);
            }

            // 3. Mirror sync to SQLite
            try {
                await sqlitePool.execute(
                    `UPDATE GatePassRequests SET Status = 'Completed' WHERE ID = ?`,
                    [pass.id]
                );
                await sqlitePool.execute(
                    `UPDATE GatePasses SET EntryTimestamp = CURRENT_TIMESTAMP, PassStatus = 'Used', IsActive = 0 WHERE RequestID = ?`,
                    [pass.id]
                );
            } catch (_) { }

            return res.json({
                success: true,
                transactionType: 'RETURN',
                newStatus: 'RETURNED',
                passStatus: 'RETURNED',
                transaction: { type: 'RETURN', scannedAt: nowIso },
                title: 'Gate Pass Scan Successful!',
                message: 'Your Gate Pass is Successfully Verified! Your return has been recorded.',
                gateName: gateLocation.gate_name,
                scannedAt: nowIso
            });
        }

        return res.status(400).json({
            success: false,
            title: 'Scan Error',
            message: `Pass is currently in state '${currentStatus}'. No further scan transitions available.`
        });

    } catch (err) {
        console.error('Error processing gate QR scan:', err);
        res.status(500).json({ success: false, title: 'Server Error', message: 'Error processing gate scan.' });
    }
});

// ── 5. GET /api/admin/gate-passes – Admin views & filters all Gate Passes ────
router.get('/admin', verifyToken, verifyRole(['Admin', 'Super Admin', 'SuperAdmin', 'Warden', 'Staff', 'HOD']), async (req, res) => {
    try {
        const { search, status, department, academicYear } = req.query;

        let requests = [];

        // Query Supabase
        try {
            let query = supabase
                .from('gate_pass_requests')
                .select(`
                    id, reason, destination, departure_at, expected_return_at, additional_description, status, created_at, updated_at,
                    students (
                        id, student_code, register_number, student_name, academic_year, year_of_study, college_email, phone_number,
                        departments ( department_code, department_name ),
                        student_profiles ( profile_photo_url, emergency_contact, guardian_name, guardian_phone )
                    ),
                    gate_pass_approvals ( decision, rejection_reason, approved_at, admin_id ),
                    gate_transactions ( transaction_type, transaction_status, scanned_at )
                `)
                .order('created_at', { ascending: false });

            if (status && status !== 'ALL') {
                query = query.eq('status', status.toUpperCase());
            }

            const { data, error } = await query;
            if (data) {
                requests = data.map(r => {
                    const st = r.students;
                    const sp = Array.isArray(st?.student_profiles) ? st?.student_profiles[0] : st?.student_profiles;
                    const approvals = Array.isArray(r.gate_pass_approvals) ? r.gate_pass_approvals : (r.gate_pass_approvals ? [r.gate_pass_approvals] : []);
                    const lastApproval = approvals[approvals.length - 1];
                    const txs = Array.isArray(r.gate_transactions) ? r.gate_transactions : [];

                    return {
                        id: r.id,
                        reason: r.reason,
                        destination: r.destination,
                        departureAt: r.departure_at,
                        expectedReturnAt: r.expected_return_at,
                        additionalDescription: r.additional_description,
                        status: r.status,
                        createdAt: r.created_at,
                        updatedAt: r.updated_at,
                        student: {
                            id: st?.id,
                            studentCode: st?.student_code || '—',
                            registerNumber: st?.register_number || 'Pending',
                            name: st?.student_name || 'Student',
                            email: st?.college_email,
                            phoneNumber: st?.phone_number || sp?.phone_number,
                            department: st?.departments?.department_code || '—',
                            academicYear: st?.academic_year || '—',
                            yearOfStudy: st?.year_of_study || 1,
                            profilePhotoUrl: sp?.profile_photo_url,
                            guardianName: sp?.guardian_name,
                            guardianPhone: sp?.guardian_phone,
                            emergencyContact: sp?.emergency_contact
                        },
                        approval: lastApproval ? {
                            decision: lastApproval.decision,
                            rejectionReason: lastApproval.rejection_reason,
                            approvedAt: lastApproval.approved_at
                        } : null,
                        transactions: txs.map(t => ({
                            type: t.transaction_type,
                            scannedAt: t.scanned_at
                        }))
                    };
                });
            }
        } catch (supaErr) {
            console.warn('Supabase admin gate passes notice:', supaErr.message);
        }

        // Also query SQLite fallback if list is empty or for local requests
        if (requests.length === 0) {
            try {
                const [rows] = await sqlitePool.execute(
                    `SELECT r.*, u.Name as studentName, u.Email as studentEmail,
                            s.RegisterNumber as studentCode, s.Department as department, s.Block as hostelBlock, s.RoomNumber as roomNumber,
                            s.AcademicYear as academicYear, s.YearOfStudy as yearOfStudy, s.ParentPhone as parentPhone,
                            sp.PhoneNumber as phoneNumber, sp.GuardianName as guardianName, sp.EmergencyContact as emergencyContact,
                            gp.PassStatus, gp.ExitTimestamp, gp.EntryTimestamp
                     FROM GatePassRequests r
                     JOIN Users u ON u.ID = r.StudentID
                     LEFT JOIN Students s ON s.UserID = u.ID
                     LEFT JOIN StudentProfiles sp ON sp.UserID = u.ID
                     LEFT JOIN GatePasses gp ON gp.RequestID = r.ID
                     ORDER BY r.ID DESC`
                );

                requests = rows.map(r => {
                    let s = (r.Status || 'PENDING').toUpperCase();
                    if (r.PassStatus === 'Active') s = 'APPROVED';
                    if (r.ExitTimestamp && !r.EntryTimestamp) s = 'EXITED';
                    if (r.EntryTimestamp) s = 'RETURNED';

                    return {
                        id: String(r.ID),
                        reason: r.Reason,
                        destination: r.Destination,
                        departureAt: r.OutTime,
                        expectedReturnAt: r.ExpectedReturnTime,
                        additionalDescription: r.WardenRemarks || r.RejectionRemarks || '',
                        status: s,
                        createdAt: r.CreatedAt,
                        student: {
                            id: r.StudentID,
                            studentCode: r.studentCode || '—',
                            registerNumber: r.studentCode || 'Pending',
                            name: r.studentName,
                            email: r.studentEmail,
                            phoneNumber: r.phoneNumber || r.parentPhone,
                            department: r.department || '—',
                            academicYear: r.academicYear || '—',
                            yearOfStudy: r.yearOfStudy || 1,
                            guardianName: r.guardianName,
                            guardianPhone: r.parentPhone,
                            emergencyContact: r.emergencyContact
                        },
                        approval: r.RejectedAt ? {
                            decision: 'REJECTED',
                            rejectionReason: r.RejectionRemarks
                        } : (r.PassStatus === 'Active' ? { decision: 'APPROVED' } : null),
                        transactions: [
                            ...(r.ExitTimestamp ? [{ type: 'EXIT', scannedAt: r.ExitTimestamp }] : []),
                            ...(r.EntryTimestamp ? [{ type: 'RETURN', scannedAt: r.EntryTimestamp }] : [])
                        ]
                    };
                });
            } catch (_) { }
        }

        // Apply in-memory search and filters
        if (search) {
            const sLower = search.toLowerCase();
            requests = requests.filter(r =>
                (r.student?.name && r.student.name.toLowerCase().includes(sLower)) ||
                (r.student?.studentCode && r.student.studentCode.toLowerCase().includes(sLower)) ||
                (r.student?.registerNumber && r.student.registerNumber.toLowerCase().includes(sLower)) ||
                (r.destination && r.destination.toLowerCase().includes(sLower))
            );
        }

        if (department && department !== 'ALL') {
            requests = requests.filter(r => r.student?.department === department);
        }

        if (academicYear && academicYear !== 'ALL') {
            requests = requests.filter(r => r.student?.academicYear === academicYear);
        }

        if (status && status !== 'ALL') {
            requests = requests.filter(r => r.status === status.toUpperCase());
        }

        res.json({
            success: true,
            count: requests.length,
            requests
        });

    } catch (err) {
        console.error('Error fetching admin gate passes:', err);
        res.status(500).json({ success: false, message: 'Server error while fetching gate passes.' });
    }
});

// ── 6. PATCH /api/admin/gate-passes/:id/approve – Admin approves request ────
router.patch('/admin/:id/approve', verifyToken, verifyRole(['Admin', 'Super Admin', 'SuperAdmin', 'Warden']), async (req, res) => {
    try {
        const passId = req.params.id;
        const adminId = req.user.id && String(req.user.id).length === 36 ? req.user.id : null;
        const nowIso = new Date().toISOString();

        // 1. Update Supabase gate_pass_requests
        try {
            await supabase
                .from('gate_pass_requests')
                .update({ status: 'APPROVED', updated_at: nowIso })
                .eq('id', passId);

            // Record approval audit
            await supabase
                .from('gate_pass_approvals')
                .insert({
                    gate_pass_request_id: passId,
                    admin_id: adminId,
                    decision: 'APPROVED',
                    approved_at: nowIso
                });
        } catch (supaErr) {
            console.warn('Supabase approval notice:', supaErr.message);
        }

        // 2. Dual-write to SQLite
        try {
            await sqlitePool.execute(
                `UPDATE GatePassRequests SET Status = 'WardenApproved' WHERE ID = ?`,
                [passId]
            );
            await sqlitePool.execute(
                `INSERT OR REPLACE INTO GatePasses (RequestID, QRCodeHash, PassStatus, IsActive)
                 VALUES (?, ?, 'Active', 1)`,
                [passId, PERMANENT_GATE_IDENTIFIER]
            );
        } catch (_) { }

        res.json({
            success: true,
            message: 'Gate Pass approved successfully. The student QR scanner is now eligible to unlock.',
            passId,
            status: 'APPROVED',
            passStatus: 'APPROVED'
        });

    } catch (err) {
        console.error('Error approving gate pass:', err);
        res.status(500).json({ success: false, message: 'Server error while approving gate pass.' });
    }
});

// ── 7. PATCH /api/admin/gate-passes/:id/reject – Admin rejects request ──────
router.patch('/admin/:id/reject', verifyToken, verifyRole(['Admin', 'Super Admin', 'SuperAdmin', 'Warden']), async (req, res) => {
    try {
        const passId = req.params.id;
        const { rejectionReason = 'Application rejected by administration.' } = req.body;
        const adminId = req.user.id && String(req.user.id).length === 36 ? req.user.id : null;
        const nowIso = new Date().toISOString();

        // 1. Update Supabase gate_pass_requests
        try {
            await supabase
                .from('gate_pass_requests')
                .update({ status: 'REJECTED', updated_at: nowIso })
                .eq('id', passId);

            await supabase
                .from('gate_pass_approvals')
                .insert({
                    gate_pass_request_id: passId,
                    admin_id: adminId,
                    decision: 'REJECTED',
                    rejection_reason: rejectionReason,
                    approved_at: nowIso
                });
        } catch (supaErr) {
            console.warn('Supabase rejection notice:', supaErr.message);
        }

        // 2. Dual-write to SQLite
        try {
            await sqlitePool.execute(
                `UPDATE GatePassRequests 
                 SET Status = 'Rejected', RejectedAt = CURRENT_TIMESTAMP, RejectedByRole = 'Admin', RejectionRemarks = ?
                 WHERE ID = ?`,
                [rejectionReason, passId]
            );
        } catch (_) { }

        res.json({
            success: true,
            message: 'Gate Pass has been rejected. Student QR scanner remains locked.',
            passId,
            status: 'REJECTED',
            passStatus: 'REJECTED',
            rejectionReason
        });

    } catch (err) {
        console.error('Error rejecting gate pass:', err);
        res.status(500).json({ success: false, message: 'Server error while rejecting gate pass.' });
    }
});

// ── 8. GET /api/gate-passes/permanent-gate – Permanent gate QR payload ───────
router.get('/permanent-gate', verifyToken, (req, res) => {
    res.json({
        success: true,
        gateIdentifier: PERMANENT_GATE_IDENTIFIER,
        gateName: 'DMI College Main Security Gate',
        description: 'Single permanent QR code physically displayed at the college gate for all student exit and return scans.'
    });
});

module.exports = router;
