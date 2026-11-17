const express = require('express');
const router = express.Router();
const xlsx = require('xlsx');
const { supabase } = require('../../../config/supabase.config');
const sqlitePool = require('../../../config/database.config');
const { verifyToken, verifyRole } = require('../../middleware/auth.middleware');

// ── 1. GET /api/admin/students - List all students with search & filter ─────
router.get('/students', verifyToken, verifyRole(['Admin', 'Super Admin', 'SuperAdmin', 'Warden']), async (req, res) => {
    try {
        const { search = '', status = 'ALL', department = 'ALL' } = req.query;

        // Query Supabase students
        let query = supabase
            .from('students')
            .select(`
                id, student_code, register_number, student_name, academic_year, year_of_study, college_email, phone_number, student_status, profile_completed, created_at,
                departments ( department_code, department_name ),
                student_profiles ( profile_photo_url, date_of_birth, gender, permanent_address, city, state, postal_code, guardian_name, guardian_phone, emergency_contact, profile_completion ),
                hostel_allocations (
                    allocation_status,
                    rooms ( room_number, hostels ( hostel_name ) )
                )
            `)
            .order('id', { ascending: false });

        if (status && status !== 'ALL') {
            query = query.eq('student_status', status.toUpperCase());
        }

        const { data: supaStudents, error: supaErr } = await query;

        let studentsList = [];

        if (supaStudents && supaStudents.length > 0) {
            studentsList = supaStudents.map(s => {
                const sp = Array.isArray(s.student_profiles) ? s.student_profiles[0] : s.student_profiles;
                const ha = Array.isArray(s.hostel_allocations) ? s.hostel_allocations.find(a => a.allocation_status === 'ACTIVE') : s.hostel_allocations;

                return {
                    id: s.id,
                    studentCode: s.student_code || '—',
                    studentName: s.student_name,
                    email: s.college_email,
                    registerNumber: s.register_number || 'N/A',
                    department: s.departments?.department_code || (s.department_id ? 'General' : '—'),
                    departmentName: s.departments?.department_name || '',
                    academicYear: s.academic_year || '—',
                    yearOfStudy: s.year_of_study || '—',
                    phoneNumber: s.phone_number,
                    status: s.student_status,
                    profileCompleted: s.profile_completed,
                    profileCompletion: sp?.profile_completion || 0,
                    hostelName: ha?.rooms?.hostels?.hostel_name || 'Pending Allocation',
                    roomNumber: ha?.rooms?.room_number || 'Pending Allocation',
                    dateOfBirth: sp?.date_of_birth,
                    gender: sp?.gender,
                    guardianName: sp?.guardian_name,
                    guardianPhone: sp?.guardian_phone,
                    emergencyContact: sp?.emergency_contact,
                    city: sp?.city,
                    state: sp?.state,
                    createdAt: s.created_at
                };
            });
        }

        // Also merge local SQLite students if not already present by email
        try {
            const [localRows] = await sqlitePool.execute(
                `SELECT u.ID as id, s.RegisterNumber as studentCode, u.Name as studentName, u.Email as email,
                        u.Status as status, s.Department as department, s.Block as hostelName, s.RoomNumber as roomNumber,
                        s.AcademicYear as academicYear, s.YearOfStudy as yearOfStudy,
                        sp.ProfileCompletion as profileCompletion, sp.PhoneNumber as phoneNumber, u.CreatedAt as createdAt
                 FROM Users u
                 LEFT JOIN Students s ON s.UserID = u.ID
                 LEFT JOIN StudentProfiles sp ON sp.UserID = u.ID
                 WHERE u.Role = 'Student'
                 ORDER BY u.ID DESC`
            );
            const existingEmails = new Set(studentsList.map(s => (s.email || '').toLowerCase()));
            for (const r of localRows) {
                if (r.email && !existingEmails.has(r.email.toLowerCase())) {
                    studentsList.push({
                        id: r.id,
                        studentCode: r.studentCode || '—',
                        studentName: r.studentName,
                        email: r.email,
                        registerNumber: r.studentCode || 'N/A',
                        department: r.department && r.department !== 'General' ? r.department : '—',
                        departmentName: '',
                        academicYear: r.academicYear || '—',
                        yearOfStudy: r.yearOfStudy || '—',
                        phoneNumber: r.phoneNumber,
                        status: r.status,
                        profileCompleted: Boolean(r.profileCompletion && r.profileCompletion >= 80),
                        profileCompletion: r.profileCompletion || 0,
                        hostelName: r.hostelName || 'Pending Allocation',
                        roomNumber: r.roomNumber || 'Pending Allocation',
                        createdAt: r.createdAt
                    });
                }
            }
        } catch (_) {}

        // Apply in-memory search filtering
        if (search) {
            const sLower = search.toLowerCase();
            studentsList = studentsList.filter(s =>
                (s.studentName && s.studentName.toLowerCase().includes(sLower)) ||
                (s.studentCode && s.studentCode.toLowerCase().includes(sLower)) ||
                (s.email && s.email.toLowerCase().includes(sLower)) ||
                (s.registerNumber && s.registerNumber.toLowerCase().includes(sLower))
            );
        }

        if (department && department !== 'ALL') {
            studentsList = studentsList.filter(s => s.department === department);
        }

        res.json({
            success: true,
            total: studentsList.length,
            students: studentsList
        });

    } catch (err) {
        console.error('Error fetching admin students:', err);
        res.status(500).json({ message: 'Server error while fetching students.' });
    }
});

// ── 2. GET /api/admin/students/pending - Pending approval student list ──────
router.get('/students/pending', verifyToken, verifyRole(['Admin', 'Super Admin', 'SuperAdmin', 'Warden']), async (req, res) => {
    try {
        const { data: pendingStudents, error } = await supabase
            .from('students')
            .select(`
                id, student_code, register_number, student_name, academic_year, year_of_study, college_email, phone_number, student_status, created_at,
                departments ( department_code, department_name ),
                student_profiles ( * )
            `)
            .in('student_status', ['PENDING_APPROVAL', 'PENDING_REGISTRATION'])
            .order('id', { ascending: false });

        let list = [];
        if (pendingStudents && pendingStudents.length > 0) {
            list = pendingStudents.map(s => {
                const sp = Array.isArray(s.student_profiles) ? s.student_profiles[0] : s.student_profiles;
                return {
                    id: s.id,
                    studentCode: s.student_code || '—',
                    studentName: s.student_name,
                    email: s.college_email,
                    department: s.departments?.department_code || '—',
                    academicYear: s.academic_year || '—',
                    yearOfStudy: s.year_of_study || '—',
                    status: s.student_status,
                    phoneNumber: s.phone_number,
                    guardianName: sp?.guardian_name,
                    guardianPhone: sp?.guardian_phone,
                    city: sp?.city,
                    createdAt: s.created_at
                };
            });
        } else {
            // Local fallback
            const [rows] = await sqlitePool.execute(
                `SELECT u.ID as id, s.RegisterNumber as studentCode, u.Name as studentName, u.Email as email,
                        s.Department as department, s.AcademicYear as academicYear, s.YearOfStudy as yearOfStudy,
                        u.Status as status, u.CreatedAt as createdAt
                 FROM Users u
                 LEFT JOIN Students s ON s.UserID = u.ID
                 WHERE u.Role = 'Student' AND (u.Status = 'PENDING_APPROVAL' OR u.Status = 'PENDING_ACTIVATION')`
            );
            list = rows.map(r => ({
                id: r.id,
                studentCode: r.studentCode || '—',
                studentName: r.studentName,
                email: r.email,
                department: r.department || '—',
                academicYear: r.academicYear || '—',
                yearOfStudy: r.yearOfStudy || '—',
                status: r.status,
                createdAt: r.createdAt
            }));
        }

        res.json({ success: true, count: list.length, pending: list });

    } catch (err) {
        console.error('Error fetching pending students:', err);
        res.status(500).json({ message: 'Server error while fetching pending registrations.' });
    }
});

// ── 3. PATCH /api/admin/students/:id/approve - Approve student account ───────
router.patch('/students/:id/approve', verifyToken, verifyRole(['Admin', 'Super Admin', 'SuperAdmin', 'Warden']), async (req, res) => {
    try {
        const rawId = req.params.id;
        const studentId = parseInt(rawId) || rawId;
        const adminUuid = (typeof req.user?.id === 'string' && req.user.id.length === 36) ? req.user.id : null;

        let targetEmail = null;

        // Try locating student row in Supabase
        try {
            if (typeof studentId === 'number' && !isNaN(studentId)) {
                const { data: stRow } = await supabase
                    .from('students')
                    .select('id, user_id, college_email')
                    .eq('id', studentId)
                    .maybeSingle();
                if (stRow?.college_email) targetEmail = stRow.college_email;
            }
        } catch (_) {}

        // Fallback locating in SQLite
        if (!targetEmail) {
            try {
                const [uRows] = await sqlitePool.execute('SELECT Email FROM Users WHERE ID = ? OR ID = (SELECT UserID FROM Students WHERE UserID = ?)', [studentId, studentId]);
                targetEmail = uRows[0]?.Email;
            } catch (_) {}
        }

        const lookupKey = targetEmail || String(rawId);

        // 1. Supabase RPC approval using multi-identifier support
        try {
            await supabase.rpc('admin_approve_student_by_id_or_email', {
                p_id_or_email: lookupKey,
                p_admin_id: adminUuid
            });
        } catch (_) {}

        // Fallback for standard RPC
        try {
            if (typeof studentId === 'number' && !isNaN(studentId)) {
                await supabase.rpc('admin_approve_student', {
                    p_student_id: studentId,
                    p_admin_id: adminUuid
                });
            }
        } catch (_) {}

        // Ensure SQLite is in sync
        try {
            if (targetEmail) {
                await sqlitePool.execute(
                    `UPDATE Users SET Status = 'ACTIVE', UpdatedAt = CURRENT_TIMESTAMP WHERE LOWER(Email) = LOWER(?)`,
                    [targetEmail]
                );
            }
            await sqlitePool.execute(
                `UPDATE Users SET Status = 'ACTIVE', UpdatedAt = CURRENT_TIMESTAMP 
                 WHERE ID = ? OR ID = (SELECT UserID FROM Students WHERE UserID = ?)`,
                [studentId, studentId]
            );
        } catch (syncErr) {
            console.warn('Sync student active status notice:', syncErr.message);
        }

        // 2. Sync SQLite by ID as well
        try {
            await sqlitePool.execute(
                `UPDATE Users SET Status = 'ACTIVE', UpdatedAt = CURRENT_TIMESTAMP 
                 WHERE ID = ? OR ID = (SELECT UserID FROM Students WHERE UserID = ?)`,
                [studentId, studentId]
            );
            // Also update Supabase profiles and students using the email from SQLite if available
            const [uRows] = await sqlitePool.execute('SELECT Email FROM Users WHERE ID = ? OR ID = (SELECT UserID FROM Students WHERE UserID = ?)', [studentId, studentId]);
            const targetEmail = uRows[0]?.Email;
            if (targetEmail) {
                await supabase.from('profiles').update({ account_status: 'ACTIVE' }).eq('email', targetEmail.toLowerCase());
                await supabase.from('students').update({ student_status: 'ACTIVE' }).eq('college_email', targetEmail.toLowerCase());
            }
        } catch (_) {}

        res.json({
            success: true,
            message: 'Student account has been approved and activated.',
            studentId,
            status: 'ACTIVE'
        });

    } catch (err) {
        console.error('Error approving student:', err);
        res.status(500).json({ message: 'Server error while approving student.' });
    }
});

// ── 4. PATCH /api/admin/students/:id/reject - Reject student account ─────────
router.patch('/students/:id/reject', verifyToken, verifyRole(['Admin', 'Super Admin', 'SuperAdmin', 'Warden']), async (req, res) => {
    try {
        const studentId = parseInt(req.params.id);
        const { reason = 'Application rejected by administration.' } = req.body;

        const adminUuid = (typeof req.user?.id === 'string' && req.user.id.length === 36) ? req.user.id : null;
        const { error: rpcErr } = await supabase.rpc('admin_reject_student', {
            p_student_id: studentId,
            p_reason: reason,
            p_admin_id: adminUuid
        });

        if (rpcErr) {
            await supabase.from('students').update({ student_status: 'REJECTED' }).eq('id', studentId);
        }

        try {
            await sqlitePool.execute(
                `UPDATE Users SET Status = 'REJECTED', UpdatedAt = CURRENT_TIMESTAMP WHERE ID = ?`,
                [studentId]
            );
        } catch (_) {}

        res.json({
            success: true,
            message: 'Student account has been rejected.',
            studentId,
            status: 'REJECTED',
            reason
        });

    } catch (err) {
        console.error('Error rejecting student:', err);
        res.status(500).json({ message: 'Server error while rejecting student.' });
    }
});

// ── 5. PATCH /api/admin/students/:id/suspend - Suspend/Reactivate account ───
router.patch('/students/:id/suspend', verifyToken, verifyRole(['Admin', 'Super Admin', 'SuperAdmin', 'Warden']), async (req, res) => {
    try {
        const studentId = parseInt(req.params.id);
        const { reason = 'Administrative action.' } = req.body;

        const adminUuid = (typeof req.user?.id === 'string' && req.user.id.length === 36) ? req.user.id : null;
        const { data, error: rpcErr } = await supabase.rpc('admin_suspend_student', {
            p_student_id: studentId,
            p_reason: reason,
            p_admin_id: adminUuid
        });

        const newStatus = data?.status || 'SUSPENDED';

        try {
            await sqlitePool.execute(
                `UPDATE Users SET Status = ?, UpdatedAt = CURRENT_TIMESTAMP WHERE ID = ?`,
                [newStatus, studentId]
            );
        } catch (_) {}

        res.json({
            success: true,
            message: `Student account status updated to ${newStatus}.`,
            studentId,
            status: newStatus
        });

    } catch (err) {
        console.error('Error suspending student:', err);
        res.status(500).json({ message: 'Server error while toggling student suspension.' });
    }
});

// ── 6. POST /api/admin/students/:id/allocate-room - Assign Hostel & Room ─────
router.post('/students/:id/allocate-room', verifyToken, verifyRole(['Admin', 'Super Admin', 'SuperAdmin', 'Warden']), async (req, res) => {
    try {
        const studentId = parseInt(req.params.id);
        const { roomId = 1, hostelName = 'Main Boys Hostel', roomNumber = '101' } = req.body;

        // Try RPC
        const adminUuid = (typeof req.user?.id === 'string' && req.user.id.length === 36) ? req.user.id : null;
        try {
            await supabase.rpc('admin_allocate_room', {
                p_student_id: studentId,
                p_room_id: parseInt(roomId),
                p_admin_id: adminUuid
            });
        } catch (rpcErr) {
            console.warn('RPC room allocation notice:', rpcErr.message);
        }

        // Sync to SQLite
        try {
            await sqlitePool.execute(
                `UPDATE Students SET Block = ?, RoomNumber = ? WHERE UserID = ? OR ID = ?`,
                [hostelName, roomNumber, studentId, studentId]
            );
        } catch (_) {}

        res.json({
            success: true,
            message: `Room ${roomNumber} in ${hostelName} successfully allocated to student.`,
            studentId,
            hostelName,
            roomNumber
        });

    } catch (err) {
        console.error('Error allocating room:', err);
        res.status(500).json({ message: 'Server error while allocating room.' });
    }
});

// ── 7. GET /api/admin/students/export - Generate Excel Student Records ────────
router.get('/students/export', verifyToken, verifyRole(['Admin', 'Super Admin', 'SuperAdmin', 'Warden']), async (req, res) => {
    try {
        const { department, status, year } = req.query;

        // Fetch student records from Supabase
        const { data: students } = await supabase
            .from('students')
            .select(`
                id, student_code, register_number, student_name, academic_year, year_of_study, college_email, phone_number, student_status, created_at,
                departments ( department_code, department_name ),
                student_profiles ( date_of_birth, gender, permanent_address, city, state, guardian_name, guardian_phone, emergency_contact, profile_completion ),
                hostel_allocations (
                    allocation_status,
                    rooms ( room_number, hostels ( hostel_name ) )
                )
            `)
            .order('id', { ascending: true });

        let list = students || [];

        // If Supabase list is empty, fallback to local SQLite student records
        if (list.length === 0) {
            try {
                const [localRows] = await sqlitePool.execute(
                    `SELECT u.ID, u.Name, u.Email, u.Status, s.RegisterNumber, s.Block, s.RoomNumber, s.Department,
                            s.AcademicYear, s.YearOfStudy, s.ParentPhone,
                            sp.DateOfBirth, sp.Gender, sp.PermanentAddress, sp.City, sp.State, sp.PostalCode,
                            sp.GuardianName, sp.GuardianPhone, sp.EmergencyContact, sp.PhoneNumber
                     FROM Users u
                     JOIN Students s ON s.UserID = u.ID
                     LEFT JOIN StudentProfiles sp ON sp.UserID = u.ID
                     WHERE u.Role = 'Student'
                     ORDER BY u.ID ASC`
                );
                list = localRows.map(r => ({
                    student_code: r.RegisterNumber,
                    student_name: r.Name,
                    college_email: r.Email,
                    departments: { department_code: r.Department },
                    academic_year: r.AcademicYear,
                    year_of_study: r.YearOfStudy,
                    phone_number: r.PhoneNumber || r.ParentPhone,
                    student_status: r.Status,
                    student_profiles: {
                        date_of_birth: r.DateOfBirth,
                        permanent_address: r.PermanentAddress,
                        guardian_name: r.GuardianName,
                        guardian_phone: r.GuardianPhone || r.ParentPhone,
                        emergency_contact: r.EmergencyContact
                    },
                    hostel_allocations: {
                        allocation_status: r.Block && r.Block !== 'Pending Allocation' ? 'ACTIVE' : 'PENDING',
                        rooms: {
                            room_number: r.RoomNumber,
                            hostels: { hostel_name: r.Block }
                        }
                    }
                }));
            } catch (_) {}
        }

        // Apply filters
        if (department && department !== 'ALL') {
            list = list.filter(s => s.departments?.department_code === department);
        }
        if (status && status !== 'ALL') {
            list = list.filter(s => s.student_status === status);
        }
        if (year && year !== 'ALL') {
            list = list.filter(s => String(s.year_of_study) === String(year));
        }

        // Map into the exact 16 columns specified by the master requirement
        const excelRows = list.map(s => {
            const sp = Array.isArray(s.student_profiles) ? s.student_profiles[0] : s.student_profiles;
            const ha = Array.isArray(s.hostel_allocations) ? s.hostel_allocations.find(a => a.allocation_status === 'ACTIVE') : s.hostel_allocations;

            return {
                'Student ID': s.student_code || 'N/A',
                'Full Name': s.student_name || 'N/A',
                'Email': s.college_email || 'N/A',
                'Department': s.departments?.department_code || 'N/A',
                'Academic Year': s.academic_year || 'N/A',
                'Year of Study': s.year_of_study || 'N/A',
                'Phone Number': s.phone_number || sp?.phone_number || 'N/A',
                'Date of Birth': sp?.date_of_birth || 'N/A',
                'Hostel Name': ha?.rooms?.hostels?.hostel_name || 'Pending Allocation',
                'Room Number': ha?.rooms?.room_number || 'Pending Allocation',
                'Parent / Guardian Name': sp?.guardian_name || 'N/A',
                'Guardian Contact': sp?.guardian_phone || 'N/A',
                'Emergency Contact': sp?.emergency_contact || 'N/A',
                'Account Status': s.student_status || 'PENDING_APPROVAL',
                'Registration Date': s.created_at ? new Date(s.created_at).toISOString().split('T')[0] : 'N/A',
                'Profile Completion': `${sp?.profile_completion || 20}%`
            };
        });

        // Generate Excel Workbook
        const worksheet = xlsx.utils.json_to_sheet(excelRows);
        const workbook = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(workbook, worksheet, 'Students');

        // Set column widths
        worksheet['!cols'] = [
            { wch: 12 }, // Student ID
            { wch: 25 }, // Full Name
            { wch: 30 }, // Email
            { wch: 15 }, // Department
            { wch: 15 }, // Academic Year
            { wch: 14 }, // Year of Study
            { wch: 16 }, // Phone Number
            { wch: 14 }, // Date of Birth
            { wch: 22 }, // Hostel Name
            { wch: 14 }, // Room Number
            { wch: 25 }, // Guardian Name
            { wch: 16 }, // Guardian Contact
            { wch: 16 }, // Emergency Contact
            { wch: 18 }, // Account Status
            { wch: 16 }, // Registration Date
            { wch: 18 }, // Profile Completion
        ];

        const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="Secure_Hostel_Student_Records.xlsx"');
        res.send(buffer);

    } catch (err) {
        console.error('Error generating student excel export:', err);
        res.status(500).json({ message: 'Server error while generating Excel export.' });
    }
});

module.exports = router;
