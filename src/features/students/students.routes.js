const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const pool = require('../../../config/database.config');
const { verifyToken, verifyRole } = require('../../middleware/auth.middleware');

// Helper to calculate profile completion percentage
const calculateProfileCompletion = (student, profile) => {
    let score = 25; // Base academic info provides 25%
    if (profile) {
        if (profile.DateOfBirth || profile.dateOfBirth) score += 10;
        if (profile.PhoneNumber || profile.phoneNumber || profile.phone) score += 10;
        if (profile.PersonalEmail || profile.personalEmail) score += 10;
        if (profile.PermanentAddress || profile.permanentAddress || profile.addressLine1 || profile.address) score += 10;
        if ((profile.City || profile.city) && (profile.State || profile.state)) score += 10;
        if ((profile.GuardianName || profile.guardianName) && (profile.GuardianPhone || profile.guardianPhone)) score += 15;
        if (profile.EmergencyContact || profile.emergencyContact) score += 10;
    }
    return Math.min(score, 100);
};

// Helper to generate a friendly 6-digit alphanumeric activation code
const generateActivationCode = () => {
    return 'ACT-' + crypto.randomBytes(3).toString('hex').toUpperCase();
};

// ── 1. GET /api/students - Directory with Search, Filter & Pagination ───────
router.get('/', verifyToken, verifyRole(['Admin', 'Super Admin', 'SuperAdmin', 'Warden', 'Staff', 'HOD']), async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
        const offset = (page - 1) * limit;

        const search = req.query.search ? req.query.search.trim() : '';
        const department = req.query.department ? req.query.department.trim() : '';
        const status = req.query.status ? req.query.status.trim().toUpperCase() : '';

        let whereClauses = [];
        let params = [];

        if (search) {
            whereClauses.push('(u.Name LIKE ? OR s.RegisterNumber LIKE ? OR u.Email LIKE ? OR s.CollegeEmail LIKE ?)');
            const sPattern = `%${search}%`;
            params.push(sPattern, sPattern, sPattern, sPattern);
        }

        if (department && department !== 'ALL') {
            whereClauses.push('COALESCE(s.Department, u.Department) = ?');
            params.push(department);
        }

        if (status && status !== 'ALL') {
            whereClauses.push('COALESCE(u.Status, "ACTIVE") = ?');
            params.push(status);
        }

        const whereSql = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

        // Count total
        const [countRows] = await pool.execute(
            `SELECT COUNT(*) as total
             FROM Students s
             JOIN Users u ON u.ID = s.UserID
             ${whereSql}`,
            params
        );
        const total = countRows[0]?.total || 0;

        // Fetch paginated data
        const [rows] = await pool.execute(
            `SELECT u.ID as userId, u.Name as studentName, u.Email, u.Status as status, u.CreatedAt as userCreatedAt,
                    s.RegisterNumber as registerNumber, s.Block as block, s.RoomNumber as roomNumber,
                    COALESCE(s.Department, u.Department) as department, s.AcademicYear as academicYear,
                    s.YearOfStudy as yearOfStudy, s.CollegeEmail as collegeEmail, s.ParentPhone as parentPhone,
                    s.ActivatedAt as activatedAt,
                    sp.ProfileCompletion as profileCompletion, sp.PhoneNumber as studentPhone
             FROM Students s
             JOIN Users u ON u.ID = s.UserID
             LEFT JOIN StudentProfiles sp ON sp.UserID = u.ID
             ${whereSql}
             ORDER BY u.ID DESC
             LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        res.json({
            students: rows,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });

    } catch (err) {
        console.error('Error fetching students:', err);
        res.status(500).json({ message: 'Server error while fetching students.' });
    }
});

// ── 2. GET /api/students/stats - Analytics for Student Management ───────────
router.get('/stats', verifyToken, verifyRole(['Admin', 'Super Admin', 'SuperAdmin', 'Warden', 'Staff', 'HOD']), async (req, res) => {
    try {
        const [totalCount] = await pool.execute('SELECT COUNT(*) as count FROM Students');
        const [activeCount] = await pool.execute('SELECT COUNT(*) as count FROM Users u JOIN Students s ON s.UserID = u.ID WHERE u.Status = "ACTIVE"');
        const [pendingCount] = await pool.execute('SELECT COUNT(*) as count FROM Users u JOIN Students s ON s.UserID = u.ID WHERE u.Status = "PENDING_ACTIVATION"');
        const [suspendedCount] = await pool.execute('SELECT COUNT(*) as count FROM Users u JOIN Students s ON s.UserID = u.ID WHERE u.Status = "SUSPENDED"');

        const [depts] = await pool.execute(
            `SELECT COALESCE(s.Department, u.Department, 'Unknown') as department, COUNT(*) as count
             FROM Students s
             JOIN Users u ON u.ID = s.UserID
             GROUP BY department`
        );

        const [years] = await pool.execute(
            `SELECT COALESCE(s.YearOfStudy, 1) as year, COUNT(*) as count
             FROM Students s
             GROUP BY year`
        );

        res.json({
            totalStudents: totalCount[0]?.count || 0,
            activeStudents: activeCount[0]?.count || 0,
            pendingActivation: pendingCount[0]?.count || 0,
            suspendedStudents: suspendedCount[0]?.count || 0,
            byDepartment: depts,
            byYear: years
        });
    } catch (err) {
        console.error('Error fetching student stats:', err);
        res.status(500).json({ message: 'Server error while fetching student analytics.' });
    }
});

// ── 3. POST /api/students - Add Individual Student ──────────────────────────
router.post('/', verifyToken, verifyRole(['Admin', 'Super Admin', 'SuperAdmin']), async (req, res) => {
    try {
        const studentName = req.body.studentName || req.body.name;
        const registerNumber = req.body.registerNumber || req.body.regNo;
        const department = req.body.department;
        const academicYear = req.body.academicYear || '2023-2027';
        const yearOfStudy = req.body.yearOfStudy || 1;
        const collegeEmail = req.body.collegeEmail || req.body.email;
        const block = req.body.block || 'TBD';
        const roomNumber = req.body.roomNumber || 'TBD';
        const parentPhone = req.body.parentPhone || null;

        if (!registerNumber || !studentName || !department) {
            return res.status(400).json({ message: 'Register Number, Student Name, and Department are required.' });
        }

        const cleanRegNo = String(registerNumber).trim();
        const cleanName = String(studentName).trim();
        const cleanDept = String(department).trim();
        const email = (collegeEmail || `${cleanRegNo.toLowerCase()}@dmice.edu`).trim().toLowerCase();

        // Check if register number or email already exists
        const [existingReg] = await pool.execute('SELECT UserID FROM Students WHERE RegisterNumber = ?', [cleanRegNo]);
        if (existingReg.length > 0) {
            return res.status(409).json({ message: `Student with Register Number ${cleanRegNo} already exists.` });
        }

        const [existingEmail] = await pool.execute('SELECT ID FROM Users WHERE Email = ?', [email]);
        if (existingEmail.length > 0) {
            return res.status(409).json({ message: `An account with email ${email} already exists.` });
        }

        // 1. Create Pending User
        const [userResult] = await pool.execute(
            'INSERT INTO Users (Name, Email, Role, Department, Status, PasswordHash) VALUES (?, ?, ?, ?, ?, NULL)',
            [cleanName, email, 'Student', cleanDept, 'PENDING_ACTIVATION']
        );
        const userId = userResult.insertId;

        // 2. Create Student Record
        await pool.execute(
            `INSERT INTO Students (UserID, RegisterNumber, Block, RoomNumber, Department, ParentPhone, AcademicYear, YearOfStudy, CollegeEmail)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [userId, cleanRegNo, block, roomNumber, cleanDept, parentPhone, academicYear, parseInt(yearOfStudy) || 1, email]
        );

        // 3. Create initial profile entry
        await pool.execute(
            'INSERT INTO StudentProfiles (UserID, ProfileCompletion) VALUES (?, 25)',
            [userId]
        );

        // 4. Generate Activation Token & Code
        const actCode = generateActivationCode();
        const rawToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

        await pool.execute(
            `INSERT INTO ActivationTokens (RegisterNumber, UserID, TokenHash, ActivationCode, ExpiresAt)
             VALUES (?, ?, ?, ?, ?)`,
            [cleanRegNo, userId, tokenHash, actCode, expiresAt]
        );

        // 5. Audit Log
        try {
            await pool.execute(
                'INSERT INTO AuthAuditLogs (UserID, Identifier, Action) VALUES (?, ?, ?)',
                [req.user.id, cleanRegNo, 'ADMIN_CREATED_STUDENT']
            );
        } catch (_) {}

        res.status(201).json({
            success: true,
            message: `Student record created for ${cleanName}. Account is pending activation.`,
            activationCode: actCode,
            student: {
                userId,
                registerNumber: cleanRegNo,
                studentName: cleanName,
                department: cleanDept,
                collegeEmail: email,
                activationCode: actCode,
                status: 'PENDING_ACTIVATION'
            }
        });

    } catch (err) {
        console.error('Error creating student:', err);
        res.status(500).json({ message: 'Server error while creating student record.' });
    }
});

// ── 4. POST /api/students/bulk-import/preview - Validate and Preview Batch ──
router.post('/bulk-import/preview', verifyToken, verifyRole(['Admin', 'Super Admin', 'SuperAdmin']), async (req, res) => {
    try {
        const students = req.body.students || req.body.rows;
        if (!students || !Array.isArray(students) || students.length === 0) {
            return res.status(400).json({ message: 'No student records provided in import payload.' });
        }

        const validDepartments = ['IT', 'CSE', 'ECE', 'EEE', 'MECH', 'AIML', 'AIDS', 'CIVIL'];
        const previewList = [];
        const errors = [];
        const seenRegNos = new Set();
        const seenEmails = new Set();

        for (let i = 0; i < students.length; i++) {
            const row = students[i];
            const rowNum = i + 1;
            const regNo = String(row['Register Number'] || row.registerNumber || row.regNo || '').trim();
            const name = String(row['Student Name'] || row['Full Name'] || row.studentName || row.name || '').trim();
            const dept = String(row['Department'] || row.department || '').trim().toUpperCase();
            const acadYear = String(row['Academic Year'] || row.academicYear || '2023-2027').trim();
            const yearOfStudy = parseInt(row['Year'] || row['Year of Study'] || row.yearOfStudy || 1) || 1;
            const collegeEmail = String(row['College Email'] || row.collegeEmail || row.email || (regNo ? `${regNo.toLowerCase()}@dmice.edu` : '')).trim().toLowerCase();
            const block = String(row['Block'] || row.block || 'TBD').trim();
            const roomNumber = String(row['Room Number'] || row.roomNumber || 'TBD').trim();
            const parentPhone = String(row['Parent Phone'] || row.parentPhone || '').trim();

            const rowErrors = [];

            if (!regNo) rowErrors.push('Missing Register Number');
            if (!name) rowErrors.push('Missing Student Name');
            if (!dept) rowErrors.push('Missing Department');
            else if (!validDepartments.includes(dept)) {
                // allow anyway but note warning or error
            }

            if (regNo && seenRegNos.has(regNo)) {
                rowErrors.push(`Duplicate Register Number "${regNo}" in current file.`);
            } else if (regNo) {
                seenRegNos.add(regNo);
            }

            if (collegeEmail && seenEmails.has(collegeEmail)) {
                rowErrors.push(`Duplicate Email "${collegeEmail}" in current file.`);
            } else if (collegeEmail) {
                seenEmails.add(collegeEmail);
            }

            // Check against database if regNo exists
            if (regNo && !rowErrors.length) {
                const [dbReg] = await pool.execute('SELECT UserID FROM Students WHERE RegisterNumber = ?', [regNo]);
                if (dbReg.length > 0) rowErrors.push(`Register Number "${regNo}" already exists in system.`);
            }

            if (rowErrors.length > 0) {
                errors.push({ row: rowNum, regNo: regNo || 'N/A', name: name || 'N/A', reasons: rowErrors });
            }

            previewList.push({
                rowNum,
                registerNumber: regNo,
                studentName: name,
                department: dept,
                academicYear: acadYear,
                yearOfStudy,
                collegeEmail,
                block,
                roomNumber,
                parentPhone,
                isValid: rowErrors.length === 0,
                errors: rowErrors
            });
        }

        const validCount = previewList.filter(p => p.isValid).length;
        const invalidCount = previewList.filter(p => !p.isValid).length;

        res.json({
            summary: {
                total: students.length,
                valid: validCount,
                invalid: invalidCount,
                hasErrors: invalidCount > 0
            },
            preview: previewList,
            errors
        });

    } catch (err) {
        console.error('Error previewing bulk import:', err);
        res.status(500).json({ message: 'Server error while validating spreadsheet data.' });
    }
});

// ── 5. POST /api/students/bulk-import/confirm - Commit Batch Import ────────
router.post('/bulk-import/confirm', verifyToken, verifyRole(['Admin', 'Super Admin', 'SuperAdmin']), async (req, res) => {
    try {
        const { students, fileName = 'student_upload.xlsx' } = req.body;
        if (!students || !Array.isArray(students) || students.length === 0) {
            return res.status(400).json({ message: 'No student records to import.' });
        }

        // Create Import Batch Record
        const [batchResult] = await pool.execute(
            'INSERT INTO StudentImportBatches (UploadedByID, FileName, TotalRecords, Status) VALUES (?, ?, ?, "PROCESSING")',
            [req.user.id, fileName, students.length]
        );
        const batchId = batchResult.insertId;

        let successful = 0;
        let skipped = 0;
        let failed = 0;

        for (let i = 0; i < students.length; i++) {
            const student = students[i];
            const regNo = String(student.registerNumber || student['Register Number'] || '').trim();
            const name = String(student.studentName || student['Student Name'] || '').trim();
            const dept = String(student.department || student['Department'] || '').trim().toUpperCase();
            const acadYear = String(student.academicYear || student['Academic Year'] || '2023-2027').trim();
            const yearOfStudy = parseInt(student.yearOfStudy || student['Year of Study'] || 1);
            const email = String(student.collegeEmail || student['College Email'] || (regNo ? `${regNo.toLowerCase()}@dmice.edu` : '')).trim().toLowerCase();
            const block = String(student.block || student['Block'] || 'TBD').trim();
            const room = String(student.roomNumber || student['Room Number'] || 'TBD').trim();
            const phone = String(student.parentPhone || student['Parent Phone'] || '').trim();

            try {
                if (!regNo || !name || !dept) {
                    skipped++;
                    continue;
                }

                // Check for existing register number or email
                const [existingReg] = await pool.execute('SELECT UserID FROM Students WHERE RegisterNumber = ?', [regNo]);
                const [existingEmail] = await pool.execute('SELECT ID FROM Users WHERE Email = ?', [email]);

                if (existingReg.length > 0 || existingEmail.length > 0) {
                    skipped++;
                    continue;
                }

                // 1. Create Pending User Account
                const [userRes] = await pool.execute(
                    'INSERT INTO Users (Name, Email, Role, Department, Status, PasswordHash) VALUES (?, ?, ?, ?, ?, NULL)',
                    [name, email, 'Student', dept, 'PENDING_ACTIVATION']
                );
                const userId = userRes.insertId;

                // 2. Create Student Record
                await pool.execute(
                    `INSERT INTO Students (UserID, RegisterNumber, Block, RoomNumber, Department, ParentPhone, AcademicYear, YearOfStudy, CollegeEmail)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [userId, regNo, block, room, dept, phone || null, acadYear, yearOfStudy, email]
                );

                // 3. Create initial profile entry
                await pool.execute(
                    'INSERT INTO StudentProfiles (UserID, ProfileCompletion) VALUES (?, 25)',
                    [userId]
                );

                // 4. Generate Activation Token & Code
                const actCode = generateActivationCode();
                const rawToken = crypto.randomBytes(32).toString('hex');
                const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
                const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

                await pool.execute(
                    `INSERT INTO ActivationTokens (RegisterNumber, UserID, TokenHash, ActivationCode, ExpiresAt)
                     VALUES (?, ?, ?, ?, ?)`,
                    [regNo, userId, tokenHash, actCode, expiresAt]
                );

                successful++;

            } catch (rowErr) {
                failed++;
                try {
                    await pool.execute(
                        'INSERT INTO StudentImportErrors (BatchID, RowNumber, RegisterNumber, ErrorType, ErrorMessage) VALUES (?, ?, ?, ?, ?)',
                        [batchId, i + 1, regNo, 'INSERT_FAILED', rowErr.message]
                    );
                } catch (_) {}
            }
        }

        // Update batch summary
        await pool.execute(
            `UPDATE StudentImportBatches 
             SET SuccessfulRecords = ?, FailedRecords = ?, DuplicateRecords = ?, Status = "COMPLETED"
             WHERE ID = ?`,
            [successful, failed, skipped, batchId]
        );

        res.json({
            message: `Bulk import completed successfully.`,
            batchId,
            successful,
            skipped,
            failed,
            total: students.length
        });

    } catch (err) {
        console.error('Error confirming bulk import:', err);
        res.status(500).json({ message: 'Server error while executing bulk import.' });
    }
});

// ── 6. PATCH /api/students/:id/status - Admin Suspend/Reactivate Student ────
router.patch('/:id/status', verifyToken, verifyRole(['Admin', 'Super Admin', 'SuperAdmin']), async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const { status, reason } = req.body;

        const allowed = ['ACTIVE', 'SUSPENDED', 'PENDING_ACTIVATION', 'INACTIVE'];
        if (!status || !allowed.includes(status.toUpperCase())) {
            return res.status(400).json({ message: `Invalid status. Must be one of: ${allowed.join(', ')}` });
        }

        const newStatus = status.toUpperCase();
        await pool.execute('UPDATE Users SET Status = ?, UpdatedAt = CURRENT_TIMESTAMP WHERE ID = ?', [newStatus, userId]);

        // Audit log
        try {
            await pool.execute(
                'INSERT INTO AuthAuditLogs (UserID, Identifier, Action) VALUES (?, ?, ?)',
                [req.user.id, String(userId), `ADMIN_STATUS_CHANGED_TO_${newStatus}: ${reason || 'N/A'}`]
            );
        } catch (_) {}

        res.json({ message: `Student status successfully updated to ${newStatus}.`, userId, status: newStatus });

    } catch (err) {
        console.error('Error updating student status:', err);
        res.status(500).json({ message: 'Server error while updating student status.' });
    }
});

// ── 7. POST /api/students/:id/generate-activation - Resend/Generate Code ────
router.post('/:id/generate-activation', verifyToken, verifyRole(['Admin', 'Super Admin', 'SuperAdmin']), async (req, res) => {
    try {
        const userId = parseInt(req.params.id);

        const [users] = await pool.execute(
            `SELECT u.ID, u.Name, u.Email, u.Status, s.RegisterNumber
             FROM Users u
             JOIN Students s ON s.UserID = u.ID
             WHERE u.ID = ?`,
            [userId]
        );

        if (users.length === 0) {
            return res.status(404).json({ message: 'Student not found.' });
        }

        const student = users[0];
        const actCode = generateActivationCode();
        const rawToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

        // Mark previous tokens used
        await pool.execute('UPDATE ActivationTokens SET Used = 1 WHERE UserID = ?', [userId]);

        // Insert fresh token
        await pool.execute(
            `INSERT INTO ActivationTokens (RegisterNumber, UserID, TokenHash, ActivationCode, ExpiresAt)
             VALUES (?, ?, ?, ?, ?)`,
            [student.RegisterNumber, userId, tokenHash, actCode, expiresAt]
        );

        res.json({
            message: `New activation code generated for ${student.Name}.`,
            registerNumber: student.RegisterNumber,
            activationCode: actCode,
            expiresAt
        });

    } catch (err) {
        console.error('Error generating activation code:', err);
        res.status(500).json({ message: 'Server error generating activation code.' });
    }
});

// ── 8. GET /api/students/profile - Current Student Full Profile ─────────────
router.get('/profile', verifyToken, async (req, res) => {
    try {
        const targetUserId = req.query.userId && ['Admin', 'Warden', 'Super Admin'].includes(req.user.role) 
            ? parseInt(req.query.userId) 
            : req.user.id;

        const [students] = await pool.execute(
            `SELECT u.ID as userId, u.Name as studentName, u.Email as email, u.Status as accountStatus,
                    s.RegisterNumber as registerNumber, s.Block as block, s.RoomNumber as roomNumber,
                    COALESCE(s.Department, u.Department) as department, s.AcademicYear as academicYear,
                    s.YearOfStudy as yearOfStudy, s.CollegeEmail as collegeEmail, s.ParentPhone as parentPhone,
                    s.AdmissionDate as admissionDate, s.ActivatedAt as activatedAt,
                    sp.DateOfBirth as dateOfBirth, sp.PersonalEmail as personalEmail,
                    sp.PhoneNumber as phoneNumber, sp.Gender as gender,
                    sp.PermanentAddress as permanentAddress, sp.CurrentAddress as currentAddress,
                    sp.City as city, sp.District as district, sp.State as state, sp.PostalCode as postalCode,
                    sp.GuardianName as guardianName, sp.GuardianRelationship as guardianRelationship,
                    sp.GuardianPhone as guardianPhone, sp.EmergencyContact as emergencyContact,
                    sp.ProfileCompletion as profileCompletion
             FROM Users u
             JOIN Students s ON s.UserID = u.ID
             LEFT JOIN StudentProfiles sp ON sp.UserID = u.ID
             WHERE u.ID = ?`,
            [targetUserId]
        );

        if (students.length === 0) {
            return res.status(404).json({ message: 'Student profile not found.' });
        }

        const data = students[0];
        const completion = calculateProfileCompletion(data, data);

        res.json({
            success: true,
            profile: {
                ...data,
                profileCompletion: completion
            },
            academic: {
                ...data,
                RegisterNumber: data.registerNumber,
                Name: data.studentName,
                Department: data.department
            },
            profileCompletion: completion
        });

    } catch (err) {
        console.error('Error fetching student profile:', err);
        res.status(500).json({ message: 'Server error while fetching student profile.' });
    }
});

// ── 9. PUT /api/students/profile - Update Student Editable Personal Info ────
router.put('/profile', verifyToken, async (req, res) => {
    try {
        const targetUserId = req.body.userId && ['Admin', 'Super Admin'].includes(req.user.role)
            ? parseInt(req.body.userId)
            : req.user.id;

        const {
            dateOfBirth,
            personalEmail,
            phoneNumber,
            gender,
            permanentAddress,
            currentAddress,
            city,
            district,
            state,
            postalCode,
            guardianName,
            guardianRelationship,
            guardianPhone,
            emergencyContact,
            parentPhone
        } = req.body;

        // Upsert into StudentProfiles
        const [existing] = await pool.execute('SELECT UserID FROM StudentProfiles WHERE UserID = ?', [targetUserId]);

        if (existing.length === 0) {
            await pool.execute(
                `INSERT INTO StudentProfiles 
                 (UserID, DateOfBirth, PersonalEmail, PhoneNumber, Gender, PermanentAddress, CurrentAddress,
                  City, District, State, PostalCode, GuardianName, GuardianRelationship, GuardianPhone, EmergencyContact)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [targetUserId, dateOfBirth, personalEmail, phoneNumber, gender, permanentAddress, currentAddress,
                 city, district, state, postalCode, guardianName, guardianRelationship, guardianPhone, emergencyContact]
            );
        } else {
            await pool.execute(
                `UPDATE StudentProfiles 
                 SET DateOfBirth = ?, PersonalEmail = ?, PhoneNumber = ?, Gender = ?,
                     PermanentAddress = ?, CurrentAddress = ?, City = ?, District = ?, State = ?,
                     PostalCode = ?, GuardianName = ?, GuardianRelationship = ?, GuardianPhone = ?,
                     EmergencyContact = ?
                 WHERE UserID = ?`,
                [dateOfBirth, personalEmail, phoneNumber, gender, permanentAddress, currentAddress,
                 city, district, state, postalCode, guardianName, guardianRelationship, guardianPhone,
                 emergencyContact, targetUserId]
            );
        }

        // Also update parentPhone in Students table if supplied
        if (parentPhone !== undefined) {
            await pool.execute('UPDATE Students SET ParentPhone = ? WHERE UserID = ?', [parentPhone, targetUserId]);
        }

        // Recalculate profile completion
        const completion = calculateProfileCompletion(null, req.body);
        await pool.execute('UPDATE StudentProfiles SET ProfileCompletion = ? WHERE UserID = ?', [completion, targetUserId]);

        res.json({
            success: true,
            message: 'Personal profile successfully updated.',
            profileCompletion: completion
        });

    } catch (err) {
        console.error('Error updating student profile:', err);
        res.status(500).json({ message: 'Server error while updating profile.' });
    }
});

// ── 10. GET /api/students/export - Export Student Records ──────────────────
router.get('/export', verifyToken, verifyRole(['Admin', 'Super Admin', 'SuperAdmin']), async (req, res) => {
    try {
        const [students] = await pool.execute(
            `SELECT s.RegisterNumber as "Register Number", u.Name as "Student Name",
                    COALESCE(s.Department, u.Department) as "Department", s.AcademicYear as "Academic Year",
                    s.YearOfStudy as "Year of Study", s.CollegeEmail as "College Email",
                    s.Block as "Block", s.RoomNumber as "Room", u.Status as "Status",
                    sp.PhoneNumber as "Phone Number", sp.GuardianPhone as "Parent Phone",
                    sp.ProfileCompletion as "Profile Completion (%)"
             FROM Students s
             JOIN Users u ON u.ID = s.UserID
             LEFT JOIN StudentProfiles sp ON sp.UserID = u.ID
             ORDER BY s.RegisterNumber ASC`
        );

        res.json({ students });
    } catch (err) {
        console.error('Error exporting students:', err);
        res.status(500).json({ message: 'Server error while exporting students.' });
    }
});

module.exports = router;

