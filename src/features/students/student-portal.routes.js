const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');
const { supabase, createAuthClient, createAuthenticatedClient, SUPABASE_URL, SUPABASE_ANON_KEY, INITIAL_STUDENT_PASSWORD } = require('../../../config/supabase.config');
const sqlitePool = require('../../../config/database.config');
const { verifyToken, verifyRole } = require('../../middleware/auth.middleware');

const JWT_SECRET = process.env.JWT_SECRET || 'hostel_secret_key';

// ── Rate Limiter for Registration & Login ────────────────────────────────────
const rateLimitMap = new Map();
const rateLimiter = (maxReqs, windowMs) => (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress || 'ip';
    const now = Date.now();
    const clientData = rateLimitMap.get(ip) || { count: 0, firstReq: now };

    if (now - clientData.firstReq > windowMs) {
        rateLimitMap.set(ip, { count: 1, firstReq: now });
        return next();
    }

    if (clientData.count >= maxReqs) {
        return res.status(429).json({ message: 'Too many requests. Please try again later.' });
    }

    clientData.count++;
    rateLimitMap.set(ip, clientData);
    next();
};

// ── 1. POST /api/student/register ───────────────────────────────────────────
router.post('/register', rateLimiter(15, 60000), async (req, res) => {
    try {
        const { fullName, email, password, confirmPassword, phoneNumber } = req.body;

        if (!fullName || !email || !password) {
            return res.status(400).json({ message: 'Full name, email address, and initial password are required.' });
        }

        const cleanEmail = email.trim().toLowerCase();
        const cleanName = fullName.trim();
        const cleanPhone = phoneNumber ? phoneNumber.trim() : null;

        if (password !== confirmPassword) {
            return res.status(400).json({ message: 'Passwords do not match.' });
        }

        // Validate that temporary password matches the institutional onboarding standard
        if (password !== INITIAL_STUDENT_PASSWORD) {
            return res.status(400).json({ 
                message: `Please use the official temporary onboarding password provided by the institution (${INITIAL_STUDENT_PASSWORD}). You will establish your private permanent password upon first login.` 
            });
        }

        // 1. Check whether email already exists in Supabase Authentication or profiles
        const { data: existingProf } = await supabase
            .from('profiles')
            .select('id, email')
            .eq('email', cleanEmail)
            .maybeSingle();

        if (existingProf) {
            return res.status(409).json({ 
                message: 'This email address is already registered. Please login using your existing account.' 
            });
        }

        let supabaseUserId = null;
        let studentCode = '001';

        // 2. Register via dedicated Supabase RPC to ensure confirmed user in auth.users and auth.identities
        const { data: rpcRes, error: rpcErr } = await supabase.rpc('register_student_user', {
            p_email: cleanEmail,
            p_password: password,
            p_full_name: cleanName,
            p_phone: cleanPhone
        });

        if (rpcRes) {
            if (rpcRes.success === false) {
                return res.status(409).json({ 
                    message: rpcRes.message || 'This email address is already registered. Please login using your existing account.' 
                });
            }
            supabaseUserId = rpcRes.user_id;
            studentCode = rpcRes.student_code || '001';
        } else {
            // Fallback via standard Supabase auth.signUp
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: cleanEmail,
                password: password,
                options: {
                    data: {
                        full_name: cleanName,
                        phone_number: cleanPhone,
                        role: 'STUDENT',
                        must_change_password: true,
                        account_status: 'PENDING_PASSWORD_CHANGE'
                    }
                }
            });

            if (authError) {
                if (authError.message.includes('already registered') || authError.status === 409) {
                    return res.status(409).json({ message: 'This email address is already registered. Please login using your existing account.' });
                }
            }
            supabaseUserId = authData?.user?.id || crypto.randomUUID();

            const { data: codeData } = await supabase.rpc('generate_next_student_code');
            if (codeData) studentCode = codeData;
        }

        // 3. Dual-write to local SQLite database to ensure unified compatibility
        try {
            const defaultSalt = await bcrypt.genSalt(10);
            const hashedPwd = await bcrypt.hash(password, defaultSalt);

            const [userInsert] = await sqlitePool.execute(
                `INSERT OR REPLACE INTO Users (Name, Email, PasswordHash, Role, Status) VALUES (?, ?, ?, 'Student', 'PENDING_PASSWORD_CHANGE')`,
                [cleanName, cleanEmail, hashedPwd]
            );
            const localUserId = userInsert.insertId;

            await sqlitePool.execute(
                `INSERT OR REPLACE INTO Students (UserID, RegisterNumber, Block, RoomNumber, Department, ParentPhone, CollegeEmail)
                 VALUES (?, ?, 'Pending Allocation', 'Pending Allocation', 'General', ?, ?)`,
                [localUserId, studentCode, cleanPhone, cleanEmail]
            );

            await sqlitePool.execute(
                `INSERT OR REPLACE INTO StudentProfiles (UserID, ProfileCompletion, PhoneNumber, PersonalEmail)
                 VALUES (?, 20, ?, ?)`,
                [localUserId, cleanPhone, cleanEmail]
            );
        } catch (sqliteErr) {
            console.warn('SQLite mirror sync notice:', sqliteErr.message);
        }

        res.status(201).json({
            success: true,
            message: 'Registration successful! Your account has been created with your initial temporary password. Please log in to complete your password update and profile.',
            studentCode: studentCode,
            email: cleanEmail,
            mustChangePassword: true,
            initialPassword: INITIAL_STUDENT_PASSWORD
        });

    } catch (err) {
        console.error('Error during student registration:', err);
        res.status(500).json({ message: 'Server error during student registration.' });
    }
});

// ── 2. POST /api/student/change-password ────────────────────────────────────
router.post('/change-password', async (req, res) => {
    try {
        const { email, currentPassword, newPassword, confirmPassword } = req.body;

        if (!email || !currentPassword || !newPassword) {
            return res.status(400).json({ message: 'Email, current password, and new password are required.' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ message: 'New password must be at least 6 characters long.' });
        }

        if (newPassword === currentPassword || newPassword === INITIAL_STUDENT_PASSWORD) {
            return res.status(400).json({ message: 'Your new password must be different from the temporary onboarding password.' });
        }

        if (confirmPassword && newPassword !== confirmPassword) {
            return res.status(400).json({ message: 'New passwords do not match.' });
        }

        const cleanEmail = email.trim().toLowerCase();

        // 1. Authenticate with Supabase Auth using current credentials on isolated client
        const authClient = createAuthClient();
        const { data: loginData, error: loginError } = await authClient.auth.signInWithPassword({
            email: cleanEmail,
            password: currentPassword
        });

        if (loginError || !loginData?.session) {
            // Check fallback for local SQLite during isolated offline testing
            const [users] = await sqlitePool.execute('SELECT * FROM Users WHERE LOWER(Email) = ?', [cleanEmail]);
            if (users.length === 0) {
                return res.status(401).json({ message: 'Current password verification failed. Please check your credentials.' });
            }
            const isMatch = await bcrypt.compare(currentPassword, users[0].PasswordHash);
            if (!isMatch && currentPassword !== INITIAL_STUDENT_PASSWORD) {
                return res.status(401).json({ message: 'Current password verification failed. Please check your credentials.' });
            }
        }

        let supabaseUserId = loginData?.user?.id;

        // 2. Call Supabase Auth password update method with authenticated session
        if (loginData?.session) {
            const { data: updateData, error: updateError } = await authClient.auth.updateUser({
                password: newPassword
            });

            if (updateError) {
                return res.status(400).json({ message: updateError.message || 'Supabase password update failed.' });
            }

            // Sign out the Supabase session
            try {
                await authClient.auth.signOut();
            } catch (_) {}
        }

        try {
            await supabase.auth.signOut();
        } catch (_) {}

        // 3. Update account's must_change_password status to FALSE in Supabase profiles
        try {
            const { error: rpcErr } = await supabase.rpc('confirm_password_changed', { p_email: cleanEmail });
            if (rpcErr) {
                await supabase
                    .from('profiles')
                    .update({
                        must_change_password: false,
                        password_changed_at: new Date().toISOString(),
                        account_status: 'PENDING_PROFILE_COMPLETION'
                    })
                    .eq('email', cleanEmail);
            }
        } catch (updateErr) {
            console.warn('Notice updating profile password status:', updateErr.message);
        }

        // 4. Mirror new password hash to local SQLite
        try {
            const salt = await bcrypt.genSalt(10);
            const hashed = await bcrypt.hash(newPassword, salt);
            await sqlitePool.execute(
                `UPDATE Users SET PasswordHash = ?, Status = 'PENDING_PROFILE_COMPLETION', UpdatedAt = CURRENT_TIMESTAMP WHERE LOWER(Email) = ?`,
                [hashed, cleanEmail]
            );
        } catch (_) {}

        // 5. Audit Log
        try {
            await supabase.from('audit_logs').insert({
                actor_id: typeof supabaseUserId === 'string' && supabaseUserId.length === 36 ? supabaseUserId : null,
                action: 'STUDENT_CHANGED_MANDATORY_PASSWORD',
                entity_type: 'profiles',
                entity_id: String(supabaseUserId || cleanEmail),
                description: 'Student successfully established permanent private password'
            });
        } catch (_) {}

        // Issue application JWT
        const appToken = jwt.sign(
            {
                id: supabaseUserId || cleanEmail,
                email: cleanEmail,
                name: loginData?.user?.user_metadata?.full_name || cleanEmail,
                role: 'Student',
                mustChangePassword: false,
                accountStatus: 'PENDING_PROFILE_COMPLETION'
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            success: true,
            message: 'Password updated successfully! Please login using your new password.',
            mustChangePassword: false,
            token: appToken,
            redirectUrl: '/student/complete-profile'
        });

    } catch (err) {
        console.error('Error changing student password:', err);
        res.status(500).json({ message: 'Server error while updating password.' });
    }
});

// ── 3. POST /api/student/complete-profile ───────────────────────────────────
router.post('/complete-profile', verifyToken, async (req, res) => {
    try {
        const {
            dateOfBirth,
            gender,
            department,
            academicYear,
            yearOfStudy,
            registerNumber,
            roomNumber,
            phoneNumber,
            permanentAddress,
            currentAddress,
            city,
            district,
            state,
            postalCode,
            guardianName,
            guardianRelationship,
            guardianPhone,
            emergencyContact
        } = req.body;

        let targetUserId = req.user.id;
        if (typeof targetUserId !== 'string' || targetUserId.length !== 36) {
            const { data: prof } = await supabase.from('profiles').select('id').eq('email', req.user.email.toLowerCase()).single();
            if (prof?.id) targetUserId = prof.id;
        }

        const cleanDept = (department || 'CSE').trim();
        const cleanAcadYear = (academicYear || '2024-2028').trim();
        const cleanRoomNo = (roomNumber || '').trim();
        const numYear = parseInt(yearOfStudy) || 1;
        const normalizedGender = (gender || 'Male').trim().toUpperCase();
        const validGender = ['MALE', 'FEMALE', 'OTHER'].includes(normalizedGender) ? normalizedGender : 'MALE';

        // Invoke Supabase RPC to commit full profile if valid UUID, otherwise update directly by email
        if (typeof targetUserId === 'string' && targetUserId.length === 36) {
            const { data: rpcResult, error: rpcError } = await supabase.rpc('complete_student_profile', {
                p_user_id: targetUserId,
                p_dob: dateOfBirth || '2004-01-01',
                p_phone: phoneNumber || '',
                p_gender: validGender,
                p_dept_code: cleanDept,
                p_acad_year: cleanAcadYear,
                p_year_study: numYear,
                p_reg_no: registerNumber || null,
                p_perm_addr: permanentAddress || '',
                p_curr_addr: currentAddress || '',
                p_city: city || '',
                p_district: district || '',
                p_state: state || '',
                p_pincode: postalCode || '',
                p_guardian_name: guardianName || '',
                p_guardian_rel: guardianRelationship || '',
                p_guardian_phone: guardianPhone || '',
                p_emergency_phone: emergencyContact || null,
                p_room_no: cleanRoomNo || null
            });

            if (rpcError) {
                console.warn('Supabase RPC complete_student_profile notice:', rpcError.message);
            }
        } else {
            // Update Supabase directly by email
            try {
                await supabase.from('profiles').update({
                    account_status: 'PENDING_APPROVAL'
                }).eq('email', req.user.email.toLowerCase());

                const { data: updatedStudent } = await supabase.from('students').update({
                    academic_year: cleanAcadYear,
                    year_of_study: numYear,
                    register_number: registerNumber || null,
                    phone_number: phoneNumber,
                    room_number: cleanRoomNo || null,
                    student_status: 'PENDING_APPROVAL',
                    profile_completed: true
                }).eq('college_email', req.user.email.toLowerCase()).select('id').maybeSingle();

                if (updatedStudent?.id) {
                    await supabase.from('student_profiles').upsert({
                        student_id: updatedStudent.id,
                        room_number: cleanRoomNo || null,
                        date_of_birth: dateOfBirth || '2004-01-01',
                        phone_number: phoneNumber || '',
                        gender: validGender,
                        permanent_address: permanentAddress || '',
                        current_address: currentAddress || permanentAddress || '',
                        city: city || '',
                        district: district || '',
                        state: state || '',
                        postal_code: postalCode || '',
                        guardian_name: guardianName || '',
                        guardian_relationship: guardianRelationship || '',
                        guardian_phone: guardianPhone || '',
                        profile_completion: 100
                    }, { onConflict: 'student_id' });
                }
            } catch (err) {
                console.warn('Supabase profile update by email notice:', err.message);
            }
        }

        // Mirror sync to SQLite
        try {
            await sqlitePool.execute(
                `UPDATE Users SET Status = 'PENDING_APPROVAL', UpdatedAt = CURRENT_TIMESTAMP WHERE LOWER(Email) = LOWER(?)`,
                [req.user.email]
            );

            try {
                await sqlitePool.execute(
                    `UPDATE Students 
                     SET Department = ?, AcademicYear = ?, YearOfStudy = ?, RegisterNumber = COALESCE(?, RegisterNumber), ParentPhone = ?
                     WHERE UserID = (SELECT ID FROM Users WHERE LOWER(Email) = LOWER(?))`,
                    [cleanDept, cleanAcadYear, numYear, registerNumber, guardianPhone, req.user.email]
                );
            } catch (regErr) {
                await sqlitePool.execute(
                    `UPDATE Students 
                     SET Department = ?, AcademicYear = ?, YearOfStudy = ?, ParentPhone = ?
                     WHERE UserID = (SELECT ID FROM Users WHERE LOWER(Email) = LOWER(?))`,
                    [cleanDept, cleanAcadYear, numYear, guardianPhone, req.user.email]
                );
            }

            await sqlitePool.execute(
                `UPDATE StudentProfiles 
                 SET DateOfBirth = ?, Gender = ?, PermanentAddress = ?, CurrentAddress = ?, City = ?, District = ?, State = ?, PostalCode = ?,
                     GuardianName = ?, GuardianRelationship = ?, GuardianPhone = ?, EmergencyContact = ?, ProfileCompletion = 100, PhoneNumber = ?
                 WHERE UserID = (SELECT ID FROM Users WHERE LOWER(Email) = LOWER(?))`,
                [dateOfBirth, gender, permanentAddress, currentAddress, city, district, state, postalCode,
                 guardianName, guardianRelationship, guardianPhone, emergencyContact, phoneNumber, req.user.email]
            );
        } catch (sqliteErr) {
            console.warn('SQLite mirror sync error:', sqliteErr.message);
        }

        res.json({
            success: true,
            message: 'Profile completed successfully! Your account is now submitted for administrator approval.',
            accountStatus: 'PENDING_APPROVAL',
            redirectUrl: '/student/pending-approval'
        });

    } catch (err) {
        console.error('Error completing student profile:', err);
        res.status(500).json({ message: 'Server error while completing student profile.' });
    }
});

// ── 4. GET /api/student/profile ─────────────────────────────────────────────
router.get('/profile', verifyToken, async (req, res) => {
    try {
        const userEmail = req.user.email;
        let studentData = null;

        // Query Supabase for student details
        const { data: supaStudent, error: supaErr } = await supabase
            .from('students')
            .select(`
                id, student_code, register_number, room_number, student_name, academic_year, year_of_study, college_email, phone_number, student_status, profile_completed,
                departments ( department_code, department_name ),
                student_profiles ( * ),
                hostel_allocations (
                    allocation_status, allocation_date,
                    rooms ( room_number, hostels ( hostel_name, hostel_code ) )
                )
            `)
            .eq('college_email', userEmail.toLowerCase())
            .single();

        if (supaStudent) {
            const sp = Array.isArray(supaStudent.student_profiles) ? supaStudent.student_profiles[0] : supaStudent.student_profiles;
            const ha = Array.isArray(supaStudent.hostel_allocations) ? supaStudent.hostel_allocations.find(a => a.allocation_status === 'ACTIVE') : supaStudent.hostel_allocations;

            studentData = {
                studentId: supaStudent.id,
                studentCode: supaStudent.student_code,
                studentName: supaStudent.student_name,
                email: supaStudent.college_email,
                registerNumber: supaStudent.register_number || 'Pending',
                department: supaStudent.departments?.department_code || 'General',
                academicYear: supaStudent.academic_year || '2024-2028',
                yearOfStudy: supaStudent.year_of_study || 1,
                phoneNumber: supaStudent.phone_number,
                status: supaStudent.student_status,
                profileCompleted: supaStudent.profile_completed,
                profileCompletion: sp?.profile_completion || 20,
                // Hostel allocation info
                hostelName: ha?.rooms?.hostels?.hostel_name || 'Pending Allocation',
                roomNumber: supaStudent.room_number || sp?.room_number || ha?.rooms?.room_number || '',
                allocationStatus: ha?.allocation_status || 'PENDING',
                // Personal & Address
                dateOfBirth: sp?.date_of_birth,
                gender: sp?.gender,
                profilePhotoUrl: sp?.profile_photo_url || sp?.profile_photo_path,
                permanentAddress: sp?.permanent_address,
                currentAddress: sp?.current_address,
                city: sp?.city,
                district: sp?.district,
                state: sp?.state,
                postalCode: sp?.postal_code,
                guardianName: sp?.guardian_name,
                guardianRelationship: sp?.guardian_relationship,
                guardianPhone: sp?.guardian_phone,
                emergencyContact: sp?.emergency_contact
            };
        }

        // Fallback to SQLite if Supabase record not yet fully formed
        if (!studentData) {
            const [localRows] = await sqlitePool.execute(
                `SELECT u.ID, u.Name, u.Email, u.Status, s.RegisterNumber, s.Block, s.RoomNumber, s.Department,
                        s.AcademicYear, s.YearOfStudy,
                        sp.ProfileCompletion, sp.PhoneNumber, sp.DateOfBirth, sp.Gender, sp.PermanentAddress, sp.City, sp.State, sp.PostalCode,
                        sp.GuardianName, sp.GuardianPhone, sp.EmergencyContact
                 FROM Users u
                 LEFT JOIN Students s ON s.UserID = u.ID
                 LEFT JOIN StudentProfiles sp ON sp.UserID = u.ID
                 WHERE LOWER(u.Email) = LOWER(?)`,
                [userEmail]
            );

            if (localRows.length > 0) {
                const row = localRows[0];
                studentData = {
                    studentCode: row.RegisterNumber || null,
                    studentName: row.Name,
                    email: row.Email,
                    status: row.Status,
                    department: row.Department && row.Department !== 'General' ? row.Department : null,
                    academicYear: row.AcademicYear || null,
                    yearOfStudy: row.YearOfStudy || null,
                    hostelName: row.Block || 'Pending Allocation',
                    roomNumber: row.RoomNumber || 'Pending Allocation',
                    profileCompletion: row.ProfileCompletion || 0,
                    phoneNumber: row.PhoneNumber,
                    dateOfBirth: row.DateOfBirth,
                    gender: row.Gender,
                    permanentAddress: row.PermanentAddress,
                    city: row.City,
                    state: row.State,
                    postalCode: row.PostalCode,
                    guardianName: row.GuardianName,
                    guardianPhone: row.GuardianPhone,
                    emergencyContact: row.EmergencyContact
                };
            }
        }

        res.json({ success: true, profile: studentData });

    } catch (err) {
        console.error('Error fetching student profile:', err);
        res.status(500).json({ message: 'Server error while fetching student profile.' });
    }
});

// ── 5. GET /api/student/dashboard ───────────────────────────────────────────
router.get('/dashboard', verifyToken, async (req, res) => {
    try {
        const userEmail = req.user.email;

        // Check account state in Supabase
        const { data: profile } = await supabase
            .from('profiles')
            .select('must_change_password, account_status')
            .eq('email', userEmail.toLowerCase())
            .single();

        if (profile) {
            if (profile.must_change_password) {
                return res.status(403).json({
                    code: 'MUST_CHANGE_PASSWORD',
                    message: 'Mandatory password reset required.',
                    redirectUrl: '/student/change-password'
                });
            }
            if (profile.account_status === 'PENDING_PROFILE_COMPLETION') {
                return res.status(403).json({
                    code: 'PENDING_PROFILE_COMPLETION',
                    message: 'Please complete your student profile to proceed.',
                    redirectUrl: '/student/complete-profile'
                });
            }
            if (profile.account_status === 'PENDING_APPROVAL') {
                return res.status(403).json({
                    code: 'PENDING_APPROVAL',
                    message: 'Your account is currently under administrator review.',
                    redirectUrl: '/student/pending-approval'
                });
            }
            if (profile.account_status === 'SUSPENDED') {
                return res.status(403).json({
                    code: 'SUSPENDED',
                    message: 'Your hostel access has been suspended by administration. Please contact the warden.'
                });
            }
        }

        // Check local SQLite status as well
        const [localUserRows] = await sqlitePool.execute('SELECT Status FROM Users WHERE LOWER(Email) = LOWER(?)', [userEmail]);
        const localStatus = (localUserRows[0]?.Status || '').toUpperCase();

        if (localStatus === 'PENDING_APPROVAL') {
            return res.status(403).json({
                code: 'PENDING_APPROVAL',
                message: 'Your account is currently under administrator review.',
                redirectUrl: '/student/pending-approval'
            });
        }

        // Fetch gate passes summary from SQLite
        let activePasses = 0;
        let pastPasses = [];
        try {
            const [passes] = await sqlitePool.execute(
                `SELECT gp.*, gpr.Reason, gpr.DepartureDate, gpr.ReturnDate, gpr.Status
                 FROM GatePasses gp
                 JOIN GatePassRequests gpr ON gpr.ID = gp.RequestID
                 WHERE gpr.StudentID = (SELECT ID FROM Users WHERE LOWER(Email) = LOWER(?))
                 ORDER BY gp.ID DESC LIMIT 10`,
                [userEmail]
            );
            pastPasses = passes;
            activePasses = passes.filter(p => p.PassStatus === 'Active').length;
        } catch (_) {}

        res.json({
            success: true,
            activePasses,
            pastPasses,
            notifications: []
        });

    } catch (err) {
        console.error('Error fetching student dashboard:', err);
        res.status(500).json({ message: 'Server error while loading student dashboard.' });
    }
});

// ── 6. POST /api/student/upload-photo ───────────────────────────────────────
router.post('/upload-photo', verifyToken, async (req, res) => {
    try {
        const { photoBase64, fileName = 'profile.jpg' } = req.body;
        if (!photoBase64) {
            return res.status(400).json({ message: 'Photo data is required.' });
        }

        const buffer = Buffer.from(photoBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
        const fileExt = fileName.split('.').pop() || 'jpg';
        const storagePath = `${req.user.id}/${Date.now()}.${fileExt}`;

        const { data, error } = await supabase.storage
            .from('student-profiles')
            .upload(storagePath, buffer, {
                contentType: `image/${fileExt === 'png' ? 'png' : fileExt === 'webp' ? 'webp' : 'jpeg'}`,
                upsert: true
            });

        if (error) {
            console.error('Storage upload error:', error);
            return res.status(500).json({ message: 'Failed to upload profile picture to storage.' });
        }

        // Generate public or signed URL
        const { data: publicUrlData } = supabase.storage
            .from('student-profiles')
            .getPublicUrl(storagePath);

        const photoUrl = publicUrlData?.publicUrl || storagePath;

        // Update student profile in Supabase
        let studentId = null;
        if (req.user?.email) {
            const { data: stByEmail } = await supabase
                .from('students')
                .select('id')
                .eq('college_email', req.user.email.toLowerCase())
                .maybeSingle();
            studentId = stByEmail?.id;
        }
        if (!studentId && req.user?.id) {
            const { data: stById } = await supabase
                .from('students')
                .select('id')
                .eq('user_id', req.user.id)
                .maybeSingle();
            studentId = stById?.id;
        }

        if (studentId) {
            await supabase
                .from('student_profiles')
                .upsert({
                    student_id: studentId,
                    profile_photo_path: storagePath,
                    profile_photo_url: photoUrl
                }, { onConflict: 'student_id' });
        }

        res.json({
            success: true,
            photoUrl,
            storagePath
        });

    } catch (err) {
        console.error('Error uploading photo:', err);
        res.status(500).json({ message: 'Server error uploading profile photo.' });
    }
});

module.exports = router;
