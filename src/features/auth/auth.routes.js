const express      = require('express');
const bcrypt       = require('bcryptjs');
const jwt          = require('jsonwebtoken');
const crypto       = require('crypto');
const pool         = require('../../../config/database.config');
const { supabase, createAuthClient } = require('../../../config/supabase.config');
const { OAuth2Client } = require('google-auth-library');
const { verifyToken } = require('../../middleware/auth.middleware');

const router = express.Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const VALID_DEPARTMENTS = ['IT', 'CSE', 'ECE', 'EEE', 'MECH', 'AIML', 'AIDS', 'CIVIL'];
const ADMIN_ROLES = ['Staff', 'HOD', 'Warden', 'Security', 'Admin'];

// Centralized role-to-dashboard route mapper
const getDashboardRedirect = (role) => {
    switch (role) {
        case 'Student':     return '/student/dashboard';
        case 'Staff':       return '/staff/pending';
        case 'HOD':         return '/hod/pending';
        case 'Warden':      return '/warden/dashboard';
        case 'Security':    return '/security/scan';
        case 'Admin':       return '/admin/dashboard';
        case 'Super Admin': return '/super-admin/dashboard';
        case 'SuperAdmin':  return '/super-admin/dashboard';
        default:            return '/dashboard';
    }
};

// In-memory token store for password resets (15 minute TTL)
const passwordResetTokens = new Map();

// Rate limiter for authentication endpoints (15 requests per minute per IP)
const loginAttempts = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000;
const MAX_ATTEMPTS = 20;

const loginRateLimiter = (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const record = loginAttempts.get(ip) || { count: 0, resetTime: now + RATE_LIMIT_WINDOW };

    if (now > record.resetTime) {
        record.count = 1;
        record.resetTime = now + RATE_LIMIT_WINDOW;
    } else {
        record.count += 1;
    }
    loginAttempts.set(ip, record);

    if (record.count > MAX_ATTEMPTS) {
        const waitSec = Math.ceil((record.resetTime - now) / 1000);
        return res.status(429).json({
            message: `Too many login attempts. Please wait ${waitSec} seconds before trying again.`
        });
    }
    next();
};

// Register User
router.post('/register', async (req, res) => {
    try {
        const { name, email, password, role, registerNumber, block, roomNumber, department } = req.body;

        if (!name || !email || !password || !role) {
            return res.status(400).json({ message: 'All required fields must be provided.' });
        }

        // Admin roles require department (except Warden and Security who serve all depts)
        if (['Staff', 'HOD'].includes(role)) {
            if (!department || !VALID_DEPARTMENTS.includes(department)) {
                return res.status(400).json({ message: 'A valid department is required for Staff and HOD.' });
            }
        }

        const [existing] = await pool.execute('SELECT * FROM Users WHERE Email = ?', [email]);
        if (existing.length > 0) return res.status(400).json({ message: 'Email already exists.' });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const [result] = await pool.execute(
            'INSERT INTO Users (Name, Email, PasswordHash, Role, Department) VALUES (?, ?, ?, ?, ?)',
            [name, email, hashedPassword, role, department || null]
        );

        const userId = result.insertId;

        if (role === 'Student') {
            if (!registerNumber || !block || !roomNumber) {
                return res.status(400).json({ message: 'Student details missing.' });
            }
            if (!department || !VALID_DEPARTMENTS.includes(department)) {
                return res.status(400).json({ message: 'A valid department is required for students.' });
            }
            await pool.execute(
                'INSERT INTO Students (UserID, RegisterNumber, Block, RoomNumber, Department) VALUES (?, ?, ?, ?, ?)',
                [userId, registerNumber, block, roomNumber, department]
            );
        }

        res.status(201).json({ message: 'User registered successfully.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error during registration.' });
    }
});

// Universal Login User (supports Email OR RegisterNumber/Username for all roles)
router.post('/login', loginRateLimiter, async (req, res) => {
    try {
        const { email, username, identifier, password } = req.body;
        const targetIdentifier = (identifier || email || username || '').trim();

        if (!targetIdentifier || !password) {
            return res.status(400).json({ message: 'Email/Username and Password are required.' });
        }

        const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
        const isEmail = targetIdentifier.includes('@');
        const cleanEmail = isEmail ? targetIdentifier.toLowerCase() : null;

        let supaUser = null;
        let supaProfile = null;

        // ── 1. Email Login: Check Supabase Auth as the Single Source of Truth ──
        if (cleanEmail) {

            // Attempt Supabase Auth login using isolated client
            try {
                const authClient = createAuthClient();
                const { data: authData, error: authErr } = await authClient.auth.signInWithPassword({
                    email: cleanEmail,
                    password
                });
                if (!authErr && authData?.user) {
                    supaUser = authData.user;
                }
            } catch (_) {}

            // Check if profile exists in Supabase
            try {
                if (supaUser) {
                    const { data: sp } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('id', supaUser.id)
                        .maybeSingle();
                    supaProfile = sp;
                } else {
                    const { data: sp } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('email', cleanEmail)
                        .maybeSingle();
                    supaProfile = sp;
                }
            } catch (_) {}

            // If Supabase Auth successfully authenticated this user
            if (supaUser) {
                const role = supaProfile?.role ? (supaProfile.role === 'STUDENT' ? 'Student' : supaProfile.role) : 'Student';
                const mustChangePassword = supaProfile ? !!supaProfile.must_change_password : false;
                const statusUpper = (supaProfile?.account_status || 'ACTIVE').toUpperCase();

                if (role === 'Student') {
                    if (statusUpper === 'SUSPENDED') {
                        return res.status(403).json({
                            message: 'Your hostel access has been suspended by administration. Please contact hostel authorities.',
                            status: 'SUSPENDED'
                        });
                    }

                    if (statusUpper === 'REJECTED') {
                        return res.status(403).json({
                            message: 'Your registration application was not approved by administration.',
                            status: 'REJECTED'
                        });
                    }

                    // Mandatory first login password change
                    if (mustChangePassword || statusUpper === 'PENDING_PASSWORD_CHANGE') {
                        const token = jwt.sign(
                            { id: supaUser.id, email: supaUser.email, name: supaProfile?.full_name || 'Student', role: 'Student', mustChangePassword: true, status: 'PENDING_PASSWORD_CHANGE' },
                            process.env.JWT_SECRET || 'hostel_secret_key',
                            { expiresIn: '2h' }
                        );
                        return res.json({
                            token,
                            user: { id: supaUser.id, name: supaProfile?.full_name || 'Student', email: supaUser.email, role: 'Student', status: 'PENDING_PASSWORD_CHANGE' },
                            mustChangePassword: true,
                            redirectUrl: '/student/change-password',
                            message: 'First login detected. Mandatory password update required.'
                        });
                    }

                    if (statusUpper === 'PENDING_PROFILE_COMPLETION') {
                        const token = jwt.sign(
                            { id: supaUser.id, email: supaUser.email, name: supaProfile?.full_name || 'Student', role: 'Student', status: statusUpper },
                            process.env.JWT_SECRET || 'hostel_secret_key',
                            { expiresIn: '24h' }
                        );
                        return res.json({
                            token,
                            user: { id: supaUser.id, name: supaProfile?.full_name || 'Student', email: supaUser.email, role: 'Student', status: statusUpper },
                            pendingProfile: true,
                            redirectUrl: '/student/complete-profile',
                            message: 'Please complete your student profile to proceed.'
                        });
                    }

                    if (statusUpper === 'PENDING_APPROVAL') {
                        const token = jwt.sign(
                            { id: supaUser.id, email: supaUser.email, name: supaProfile?.full_name || 'Student', role: 'Student', status: statusUpper },
                            process.env.JWT_SECRET || 'hostel_secret_key',
                            { expiresIn: '24h' }
                        );
                        return res.json({
                            token,
                            user: { id: supaUser.id, name: supaProfile?.full_name || 'Student', email: supaUser.email, role: 'Student', status: statusUpper },
                            pendingApproval: true,
                            redirectUrl: '/student/pending-approval',
                            message: 'Your account is under administrator review.'
                        });
                    }

                    // Active student
                    let stData = null;
                    try {
                        const { data: st } = await supabase
                            .from('students')
                            .select('register_number, room_number, hostel_name, department')
                            .eq('college_email', cleanEmail)
                            .maybeSingle();
                        stData = st;
                    } catch (_) {}

                    const token = jwt.sign(
                        {
                            id: supaUser.id,
                            email: supaUser.email,
                            name: supaProfile?.full_name || 'Student',
                            role: 'Student',
                            status: 'ACTIVE',
                            department: stData?.department || 'General',
                            registerNumber: stData?.register_number || supaProfile?.username || null,
                            roomNumber: stData?.room_number || null,
                            block: stData?.hostel_name || null
                        },
                        process.env.JWT_SECRET || 'hostel_secret_key',
                        { expiresIn: '24h' }
                    );

                    return res.json({
                        token,
                        user: {
                            id: supaUser.id,
                            name: supaProfile?.full_name || 'Student',
                            email: supaUser.email,
                            role: 'Student',
                            status: 'ACTIVE',
                            registerNumber: stData?.register_number || supaProfile?.username || null,
                            block: stData?.hostel_name || null,
                            roomNumber: stData?.room_number || null
                        },
                        redirectUrl: '/student/dashboard',
                        message: 'Login successful.'
                    });
                }
            } else if (supaProfile && supaProfile.role === 'STUDENT') {
                return res.status(401).json({ message: 'Invalid email or password.' });
            }
        }

        // ── 2. Unified Supabase Search (for RegNo, Username, or Institutional Accounts) ──
        let matchedEmail = cleanEmail;
        let supaStudentRow = null;

        if (!matchedEmail) {
            // Check student register number or student code in Supabase
            try {
                const { data: st } = await supabase
                    .from('students')
                    .select('*')
                    .or(`register_number.ilike.${targetIdentifier},student_code.ilike.${targetIdentifier}`)
                    .maybeSingle();
                if (st?.college_email) {
                    matchedEmail = st.college_email.toLowerCase();
                    supaStudentRow = st;
                }
            } catch (_) {}

            // Check username or email in profiles
            if (!matchedEmail) {
                try {
                    const { data: sp } = await supabase
                        .from('profiles')
                        .select('*')
                        .or(`username.ilike.${targetIdentifier},email.ilike.${targetIdentifier}`)
                        .maybeSingle();
                    if (sp?.email) {
                        matchedEmail = sp.email.toLowerCase();
                        if (!supaProfile) supaProfile = sp;
                    }
                } catch (_) {}
            }
        }

        if (!matchedEmail) {
            return res.status(401).json({ message: 'Invalid email/username or password.' });
        }

        // Fetch Supabase profile if not already fetched
        if (!supaProfile) {
            try {
                const { data: sp } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('email', matchedEmail)
                    .maybeSingle();
                supaProfile = sp;
            } catch (_) {}
        }

        // Attempt Supabase Auth login for this resolved email
        let supaUserResolved = supaUser;
        if (!supaUserResolved) {
            try {
                const authClient = createAuthClient();
                const { data: authData, error: authErr } = await authClient.auth.signInWithPassword({
                    email: matchedEmail,
                    password
                });
                if (!authErr && authData?.user) {
                    supaUserResolved = authData.user;
                }
            } catch (_) {}
        }

        const role = supaProfile?.role ? (supaProfile.role === 'STUDENT' ? 'Student' : (supaProfile.role === 'SUPER_ADMIN' ? 'Admin' : supaProfile.role)) : 'Student';
        const mustChangePassword = supaProfile ? !!supaProfile.must_change_password : false;
        const statusUpper = (supaProfile?.account_status || 'ACTIVE').toUpperCase();

        if (role === 'Student') {
            // For students, credentials must be confirmed via Supabase Auth
            const isStudentMatched = !!supaUserResolved;

            if (!isStudentMatched) {
                return res.status(401).json({ message: 'Invalid email or password.' });
            }

            if (statusUpper === 'SUSPENDED') {
                return res.status(403).json({
                    message: 'Your hostel access has been suspended by administration. Please contact hostel authorities.',
                    status: 'SUSPENDED'
                });
            }

            if (statusUpper === 'REJECTED') {
                return res.status(403).json({
                    message: 'Your registration application was not approved by administration.',
                    status: 'REJECTED'
                });
            }

            // Mandatory first login password change
            if (mustChangePassword || statusUpper === 'PENDING_PASSWORD_CHANGE') {
                const token = jwt.sign(
                    { id: supaProfile?.id || matchedEmail, email: matchedEmail, name: supaProfile?.full_name || 'Student', role: 'Student', mustChangePassword: true, status: 'PENDING_PASSWORD_CHANGE' },
                    process.env.JWT_SECRET || 'hostel_secret_key',
                    { expiresIn: '2h' }
                );
                return res.json({
                    token,
                    user: { id: supaProfile?.id || matchedEmail, name: supaProfile?.full_name || 'Student', email: matchedEmail, role: 'Student', status: 'PENDING_PASSWORD_CHANGE' },
                    mustChangePassword: true,
                    redirectUrl: '/student/change-password',
                    message: 'First login detected. Mandatory password update required.'
                });
            }

            if (statusUpper === 'PENDING_PROFILE_COMPLETION') {
                const token = jwt.sign(
                    { id: supaProfile?.id || matchedEmail, email: matchedEmail, name: supaProfile?.full_name || 'Student', role: 'Student', status: statusUpper },
                    process.env.JWT_SECRET || 'hostel_secret_key',
                    { expiresIn: '24h' }
                );
                return res.json({
                    token,
                    user: { id: supaProfile?.id || matchedEmail, name: supaProfile?.full_name || 'Student', email: matchedEmail, role: 'Student', status: statusUpper },
                    pendingProfile: true,
                    redirectUrl: '/student/complete-profile',
                    message: 'Please complete your student profile to proceed.'
                });
            }

            if (statusUpper === 'PENDING_APPROVAL') {
                const token = jwt.sign(
                    { id: supaProfile?.id || matchedEmail, email: matchedEmail, name: supaProfile?.full_name || 'Student', role: 'Student', status: statusUpper },
                    process.env.JWT_SECRET || 'hostel_secret_key',
                    { expiresIn: '24h' }
                );
                return res.json({
                    token,
                    user: { id: supaProfile?.id || matchedEmail, name: supaProfile?.full_name || 'Student', email: matchedEmail, role: 'Student', status: statusUpper },
                    pendingApproval: true,
                    redirectUrl: '/student/pending-approval',
                    message: 'Your account is under administrator review.'
                });
            }

            // Active student
            if (!supaStudentRow) {
                try {
                    const { data: st } = await supabase
                        .from('students')
                        .select('*')
                        .eq('college_email', matchedEmail)
                        .maybeSingle();
                    supaStudentRow = st;
                } catch (_) {}
            }

            const token = jwt.sign(
                {
                    id: supaProfile?.id || matchedEmail,
                    email: matchedEmail,
                    name: supaProfile?.full_name || supaStudentRow?.student_name || 'Student',
                    role: 'Student',
                    status: 'ACTIVE',
                    department: supaStudentRow?.department_id ? 'CSE' : 'General',
                    registerNumber: supaStudentRow?.register_number || supaStudentRow?.student_code || supaProfile?.username || null,
                    roomNumber: '101',
                    block: 'Main Boys Hostel'
                },
                process.env.JWT_SECRET || 'hostel_secret_key',
                { expiresIn: '24h' }
            );

            return res.json({
                token,
                user: {
                    id: supaProfile?.id || matchedEmail,
                    name: supaProfile?.full_name || supaStudentRow?.student_name || 'Student',
                    email: matchedEmail,
                    role: 'Student',
                    status: 'ACTIVE',
                    registerNumber: supaStudentRow?.register_number || supaStudentRow?.student_code || supaProfile?.username || null,
                    block: 'Main Boys Hostel',
                    roomNumber: '101'
                },
                redirectUrl: '/student/dashboard',
                message: 'Login successful.'
            });
        }

        // Institutional roles (Admin, Warden, Staff, Security)
        const isInstitutionalMatched = !!supaUserResolved;

        if (!isInstitutionalMatched) {
            return res.status(401).json({ message: 'Invalid email/username or password.' });
        }

        if (statusUpper && !['ACTIVE', 'PENDING_ACTIVATION', 'PENDING_PASSWORD_CHANGE', 'PENDING_PROFILE_COMPLETION', 'PENDING_APPROVAL'].includes(statusUpper)) {
            return res.status(403).json({
                message: `Your account is ${statusUpper.toLowerCase()}. Please contact the administrator.`,
                status: statusUpper
            });
        }

        const standardRole = role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
        const finalRole = (standardRole === 'Superadmin' || standardRole === 'Super admin') ? 'Admin' : standardRole;

        const token = jwt.sign(
            {
                id: supaProfile?.id || matchedEmail,
                email: matchedEmail,
                name: supaProfile?.full_name || targetIdentifier,
                role: finalRole,
                department: supaProfile?.department || null,
                status: statusUpper
            },
            process.env.JWT_SECRET || 'hostel_secret_key',
            { expiresIn: '24h' }
        );

        return res.json({
            token,
            user: {
                id: supaProfile?.id || matchedEmail,
                name: supaProfile?.full_name || targetIdentifier,
                email: matchedEmail,
                role: finalRole,
                status: statusUpper
            },
            redirectUrl: getDashboardRedirect(finalRole),
            message: 'Login successful.'
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error during login.' });
    }
});

// Logout User
router.post('/logout', async (req, res) => {
    try {
        res.json({ message: 'Logged out successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Server error during logout.' });
    }
});

// Get Current User Profile / Session
router.get(['/me', '/session'], verifyToken, async (req, res) => {
    try {
        const userEmail = (req.user.email || '').toLowerCase();
        const userId = req.user.id;

        // Query Supabase profiles
        let profile = null;
        if (userId) {
            const { data: p } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
            profile = p;
        }
        if (!profile && userEmail) {
            const { data: p } = await supabase.from('profiles').select('*').eq('email', userEmail).maybeSingle();
            profile = p;
        }

        // Query student row if student
        let student = null;
        if (userEmail) {
            const { data: s } = await supabase.from('students').select('*').eq('college_email', userEmail).maybeSingle();
            student = s;
        }

        if (!profile && !student) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const role = profile?.role ? (profile.role === 'STUDENT' ? 'Student' : profile.role === 'ADMIN' ? 'Admin' : profile.role === 'WARDEN' ? 'Warden' : profile.role) : (req.user.role || 'Student');
        const status = (profile?.account_status || 'ACTIVE').toUpperCase();

        if (status !== 'ACTIVE') {
            return res.status(403).json({
                message: `Account is ${status.toLowerCase()}.`,
                status
            });
        }

        res.json({
            authenticated: true,
            user: {
                id: profile?.id || req.user.id,
                name: profile?.full_name || student?.full_name || req.user.name || 'User',
                email: profile?.email || student?.college_email || req.user.email,
                role,
                department: student?.department || profile?.department || null,
                status,
                registerNumber: student?.register_number || profile?.username || null,
                block: student?.hostel_name || null,
                roomNumber: student?.room_number || null,
                photoUrl: profile?.avatar_url || null,
                createdAt: profile?.created_at || null
            },
            redirectUrl: getDashboardRedirect(role)
        });
    } catch (error) {
        console.error('Session error:', error);
        res.status(500).json({ message: 'Server error fetching session.' });
    }
});

// Universal Forgot Password - initiates password reset
router.post('/forgot-password', async (req, res) => {
    try {
        const { email, identifier } = req.body;
        const target = (email || identifier || '').trim();

        if (!target) {
            return res.status(400).json({ message: 'Email or Register Number is required.' });
        }

        // 1. Resolve student / profile in Supabase
        let resolvedEmail = null;
        let resolvedName = null;
        let resolvedUserId = null;

        try {
            // Check students table by register_number or college_email
            const { data: st } = await supabase
                .from('students')
                .select('college_email, full_name, user_id, register_number')
                .or(`register_number.ilike.${target},college_email.ilike.${target}`)
                .maybeSingle();

            if (st?.college_email) {
                resolvedEmail = st.college_email.toLowerCase();
                resolvedName = st.full_name;
                resolvedUserId = st.user_id;
            }
        } catch (_) {}

        if (!resolvedEmail) {
            try {
                // Check profiles table by email or username
                const { data: prof } = await supabase
                    .from('profiles')
                    .select('id, email, full_name, username')
                    .or(`email.ilike.${target},username.ilike.${target}`)
                    .maybeSingle();

                if (prof?.email) {
                    resolvedEmail = prof.email.toLowerCase();
                    resolvedName = prof.full_name;
                    resolvedUserId = prof.id;
                }
            } catch (_) {}
        }

        // Fallback for valid email format
        if (!resolvedEmail && target.includes('@')) {
            resolvedEmail = target.toLowerCase();
        }

        // Generate a 32-character hexadecimal token
        const rawToken = crypto.randomBytes(16).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        const expiresAt = Date.now() + 15 * 60 * 1000; // 15 mins

        passwordResetTokens.set(tokenHash, {
            email: resolvedEmail || target.toLowerCase(),
            userId: resolvedUserId,
            name: resolvedName,
            expiresAt
        });

        // Clean up expired tokens
        const now = Date.now();
        for (const [k, v] of passwordResetTokens.entries()) {
            if (v.expiresAt < now) passwordResetTokens.delete(k);
        }

        res.json({
            message: 'If an account matches this credential, a password reset request has been initialized.',
            status: 'initiated',
            resetToken: rawToken,
            expiresIn: '15 minutes'
        });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ message: 'Server error during password reset request.' });
    }
});

// Universal Reset Password - completes password reset
router.post('/reset-password', async (req, res) => {
    try {
        const { token, newPassword, email, registerNumber } = req.body;

        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ message: 'New password must be at least 6 characters long.' });
        }

        let userEmail = null;

        if (token) {
            const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');
            const tokenRecord = passwordResetTokens.get(tokenHash);

            if (!tokenRecord || tokenRecord.expiresAt < Date.now()) {
                return res.status(400).json({ message: 'Invalid or expired password reset token.' });
            }

            userEmail = tokenRecord.email;
            passwordResetTokens.delete(tokenHash);
        } else if (email || registerNumber) {
            const target = (email || registerNumber || '').trim();
            try {
                const { data: st } = await supabase
                    .from('students')
                    .select('college_email')
                    .or(`register_number.ilike.${target},college_email.ilike.${target}`)
                    .maybeSingle();

                if (st?.college_email) {
                    userEmail = st.college_email.toLowerCase();
                } else if (email) {
                    userEmail = email.toLowerCase().trim();
                }
            } catch (_) {}
        }

        if (!userEmail) {
            return res.status(400).json({ message: 'A valid reset token is required.' });
        }

        // 1. Update password in Supabase via RPC
        try {
            const { error: rpcErr } = await supabase.rpc('reset_user_password_direct', {
                p_email: userEmail,
                p_new_password: newPassword
            });

            if (rpcErr) {
                console.error('Supabase password reset RPC error:', rpcErr);
            }
        } catch (e) {
            console.error('Supabase reset exception:', e);
        }

        // 2. Also update profile record directly to ensure must_change_password = false
        try {
            await supabase
                .from('profiles')
                .update({
                    must_change_password: false,
                    password_changed_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('email', userEmail);
        } catch (_) {}

        // 3. Log audit event
        try {
            await supabase.from('audit_logs').insert([{
                action: 'PASSWORD_RESET',
                entity_type: 'USER',
                entity_id: userEmail,
                description: `Password reset successfully via recovery token for ${userEmail}`,
                ip_address: req.ip || null
            }]);
        } catch (_) {}

        res.json({
            success: true,
            message: 'Password has been reset successfully. You may now log in.'
        });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ message: 'Server error during password reset.' });
    }
});

// ─── Student Account Activation ──────────────────────────────────────────────
router.post('/activation/initiate', async (req, res) => {
    try {
        const { registerNumber } = req.body;
        if (!registerNumber) {
            return res.status(400).json({ message: 'Register Number is required.' });
        }

        const cleanReg = String(registerNumber).trim();
        const [rows] = await pool.execute(
            `SELECT u.ID, u.Name, u.Email, u.Status, s.RegisterNumber
             FROM Students s
             JOIN Users u ON u.ID = s.UserID
             WHERE s.RegisterNumber = ?`,
            [cleanReg]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                message: 'No student record found with this Register Number. Please contact your college administrator.'
            });
        }

        const student = rows[0];

        if (student.Status === 'ACTIVE') {
            return res.status(400).json({
                message: 'This student account has already been activated. Please proceed to the login page.',
                isAlreadyActive: true
            });
        }

        if (student.Status === 'SUSPENDED') {
            return res.status(403).json({
                message: 'This account has been suspended by administration. Please contact hostel authorities.'
            });
        }

        // Generate / retrieve active activation code
        const actCode = 'ACT-' + crypto.randomBytes(3).toString('hex').toUpperCase();
        const rawToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

        // Mark previous tokens used
        await pool.execute('UPDATE ActivationTokens SET Used = 1 WHERE UserID = ?', [student.ID]);

        await pool.execute(
            `INSERT INTO ActivationTokens (RegisterNumber, UserID, TokenHash, ActivationCode, ExpiresAt)
             VALUES (?, ?, ?, ?, ?)`,
            [cleanReg, student.ID, tokenHash, actCode, expiresAt]
        );

        const maskEmail = (email) => {
            if (!email || !email.includes('@')) return email;
            const [local, domain] = email.split('@');
            if (local.length <= 2) return local[0] + '***@' + domain;
            return local[0] + '***' + local[local.length - 1] + '@' + domain;
        };

        res.json({
            success: true,
            message: 'Student record verified. Enter your activation code to complete setup.',
            registerNumber: student.RegisterNumber,
            studentName: student.Name,
            maskedEmail: maskEmail(student.Email),
            activationCode: actCode,
            activationToken: rawToken,
            expiresAt
        });

    } catch (err) {
        console.error('Error initiating activation:', err);
        res.status(500).json({ message: 'Server error during activation check.' });
    }
});

router.post('/activation/complete', async (req, res) => {
    try {
        const { registerNumber, regNo, activationCode, code, password, confirmPassword } = req.body;
        const inputReg = registerNumber || regNo;
        const inputCode = activationCode || code;

        if (!inputCode || !password) {
            return res.status(400).json({ message: 'Activation Code and Password are required.' });
        }

        if (password.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
        }

        if (confirmPassword && password !== confirmPassword) {
            return res.status(400).json({ message: 'Passwords do not match.' });
        }

        const cleanCode = String(inputCode).trim().toUpperCase();
        let query = `
            SELECT at.ID, at.UserID, at.RegisterNumber, at.ExpiresAt, at.Used, u.Name, u.Email
            FROM ActivationTokens at
            JOIN Users u ON u.ID = at.UserID
            WHERE at.ActivationCode = ? AND at.Used = 0
        `;
        let params = [cleanCode];

        if (inputReg) {
            query += ` AND at.RegisterNumber = ?`;
            params.push(String(inputReg).trim());
        }

        query += ` ORDER BY at.ID DESC LIMIT 1`;

        const [tokens] = await pool.execute(query, params);

        if (tokens.length === 0) {
            return res.status(400).json({ message: 'Invalid or already used activation code. Please check your code or request a new one.' });
        }

        const tokenRecord = tokens[0];
        if (new Date(tokenRecord.ExpiresAt) < new Date()) {
            return res.status(400).json({ message: 'This activation code has expired. Please initiate activation again.' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        await pool.execute(
            `UPDATE Users 
             SET PasswordHash = ?, Status = 'ACTIVE', UpdatedAt = CURRENT_TIMESTAMP 
             WHERE ID = ?`,
            [hashedPassword, tokenRecord.UserID]
        );

        await pool.execute(
            `UPDATE Students 
             SET ActivatedAt = CURRENT_TIMESTAMP 
             WHERE UserID = ?`,
            [tokenRecord.UserID]
        );

        await pool.execute('UPDATE ActivationTokens SET Used = 1 WHERE ID = ?', [tokenRecord.ID]);

        await pool.execute(
            `INSERT OR IGNORE INTO StudentProfiles (UserID, ProfileCompletion) VALUES (?, 25)`,
            [tokenRecord.UserID]
        );

        try {
            await pool.execute(
                'INSERT INTO AuthAuditLogs (UserID, Identifier, Action) VALUES (?, ?, ?)',
                [tokenRecord.UserID, tokenRecord.RegisterNumber || inputReg, 'STUDENT_ACCOUNT_ACTIVATED']
            );
        } catch (_) {}

        res.json({
            success: true,
            status: 'ACTIVE',
            message: 'Your account has been successfully activated! You may now sign in using your Register Number and password.',
            redirectUrl: '/login'
        });

    } catch (err) {
        console.error('Error completing activation:', err);
        res.status(500).json({ message: 'Server error completing activation.' });
    }
});

// Google OAuth Login
// Frontend sends a Google credential token -> backend verifies it -> issues own JWT
router.post('/google-login', async (req, res) => {
    try {
        const { credential } = req.body;

        if (!credential) {
            return res.status(400).json({ message: 'Google credential token is required.' });
        }

        // Verify with Google's servers
        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();
        const { email, name, sub: googleId } = payload;

        // Check if user already exists
        const [users] = await pool.execute('SELECT * FROM Users WHERE Email = ?', [email]);

        let user;
        if (users.length === 0) {
            // 1. Create User account
            const [result] = await pool.execute(
                'INSERT INTO Users (Name, Email, GoogleID, Role) VALUES (?, ?, ?, ?)',
                [name || email.split('@')[0], email, googleId, 'Student']
            );
            const userId = result.insertId;

            // 2. IMPORTANT: Create minimal Student profile to prevent DB join crashes
            // The student will be prompted to update these in their profile later
            await pool.execute(
                'INSERT INTO Students (UserID, RegisterNumber, Block, RoomNumber, Department) VALUES (?, ?, ?, ?, ?)',
                [userId, `G-${googleId.slice(-6)}`, 'NOT_SET', '000', 'TBD']
            );

            user = { ID: userId, Name: name, Email: email, Role: 'Student' };
        } else {
            user = users[0];
            // Update GoogleID if not already set
            if (!user.GoogleID) {
                await pool.execute('UPDATE Users SET GoogleID = ? WHERE ID = ?', [googleId, user.ID]);
            }
        }

        // Issue JWT like a regular login
        const token = jwt.sign(
            { id: user.ID, email: user.Email, role: user.Role },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            token,
            user: { id: user.ID, name: user.Name, email: user.Email, role: user.Role },
            redirectUrl: getDashboardRedirect(user.Role)
        });

    } catch (error) {
        console.error('Google login error:', error);
        res.status(401).json({ message: 'Invalid or expired Google token.' });
    }
});

// ─── Admin Login (Firebase token → JWT) ─────────────────────────────────────
// Admin clicks Login on AdminLogin.jsx → Firebase signs them in →
// frontend sends the Firebase idToken here → we verify it with Firebase Admin SDK
// → look up the user by email in SQLite → issue our own JWT for the rest of the app
router.post('/admin-login', async (req, res) => {
    try {
        const { idToken } = req.body;
        if (!idToken) return res.status(400).json({ message: 'Firebase ID token is required.' });

        const { firebaseAuth } = require('../../../config/firebase.config');

        // Verify the Firebase token
        let decoded;
        try {
            decoded = await firebaseAuth.verifyIdToken(idToken);
        } catch {
            return res.status(401).json({ message: 'Invalid or expired Firebase token.' });
        }

        const email = decoded.email;

        // Look up in SQLite — must exist and be an admin role
        const [users] = await pool.execute('SELECT * FROM Users WHERE Email = ?', [email]);
        if (users.length === 0) {
            return res.status(403).json({ message: 'No admin account found for this email. Contact Super Admin.' });
        }

        const user = users[0];
        const adminRoles = ['Staff', 'HOD', 'Warden', 'Security', 'Admin'];
        if (!adminRoles.includes(user.Role)) {
            return res.status(403).json({ message: 'This account does not have admin access.' });
        }

        const token = jwt.sign(
            { id: user.ID, email: user.Email, role: user.Role, department: user.Department },
            process.env.JWT_SECRET,
            { expiresIn: '12h' }
        );

        res.json({
            token,
            user: { id: user.ID, name: user.Name, email: user.Email, role: user.Role, department: user.Department }
        });

    } catch (error) {
        console.error('Admin login error:', error);
        res.status(500).json({ message: 'Server error during admin login.' });
    }
});

// ─── Create Admin Account (Super Admin only) ─────────────────────────────────
// Requires a logged-in Admin/Warden to call this
// Creates Firebase Auth user + stores user in SQLite with their role/dept
router.post('/create-admin', async (req, res) => {
    try {
        const { name, dob, role, department, collegeName, email, password } = req.body;

        if (!name || !email || !password || !role || !collegeName) {
            return res.status(400).json({ message: 'name, email, password, role, and collegeName are required.' });
        }

        // Validate role
        if (!['Staff', 'HOD', 'Warden', 'Security'].includes(role)) {
            return res.status(400).json({ message: 'Invalid role. Must be Staff, HOD, Warden, or Security.' });
        }

        // Department required for Staff/HOD
        const validDeps = ['IT', 'CSE', 'ECE', 'EEE', 'MECH', 'AIML', 'AIDS', 'CIVIL'];
        if (['Staff', 'HOD'].includes(role)) {
            if (!department || !validDeps.includes(department)) {
                return res.status(400).json({ message: 'A valid department is required for Staff and HOD.' });
            }
        }

        // Check email not already in SQLite
        const [existing] = await pool.execute('SELECT ID FROM Users WHERE Email = ?', [email]);
        if (existing.length > 0) {
            return res.status(400).json({ message: 'An account with this email already exists.' });
        }

        const { firebaseAuth } = require('../../../config/firebase.config');

        // Create user in Firebase Authentication
        let firebaseUser;
        try {
            firebaseUser = await firebaseAuth.createUser({
                email,
                password,
                displayName: name,
                emailVerified: false,
            });
        } catch (fbErr) {
            if (fbErr.code === 'auth/email-already-exists') {
                return res.status(400).json({ message: 'This email already exists in Firebase. Use a different email.' });
            }
            throw fbErr;
        }

        // Save in SQLite — no password hash needed for admin (Firebase handles auth)
        await pool.execute(
            'INSERT INTO Users (Name, Email, Role, Department) VALUES (?, ?, ?, ?)',
            [name, email, role, department || null]
        );

        console.log(`✅ Admin account created: ${name} (${role}) — ${email}`);
        res.status(201).json({ message: `Admin account for ${name} (${role}) created successfully.` });

    } catch (error) {
        console.error('Create admin error:', error);
        res.status(500).json({ message: 'Server error creating admin account.' });
    }
});

// ─── Bulk Student Upload (Admin/Staff only) ──────────────────────────────────
router.post('/bulk-student-upload', async (req, res) => {
    try {
        const { students } = req.body; // Array of student objects
        if (!students || !Array.isArray(students)) {
           return res.status(400).json({ message: 'A valid array of students is required.' });
        }

        const results = { successful: 0, skipped: 0, errors: [] };

        for (const student of students) {
            const { name, email, registerNumber, block, roomNumber, department, parentPhone } = student;

            try {
                // 1. Validation
                if (!name || !email || !registerNumber || !department) {
                    throw new Error(`Missing required fields for student: ${registerNumber || name}`);
                }

                // 2. Check for existing email or register number
                const [existingEmail] = await pool.execute('SELECT ID FROM Users WHERE Email = ?', [email]);
                const [existingReg]   = await pool.execute('SELECT UserID FROM Students WHERE RegisterNumber = ?', [registerNumber]);

                if (existingEmail.length > 0 || existingReg.length > 0) {
                    results.skipped++;
                    continue;
                }

                // 3. Create User account (Default password: S@RegNo2026)
                const salt = await bcrypt.genSalt(10);
                const defaultPassword = `S@${registerNumber}2026`;
                const hashedPassword = await bcrypt.hash(defaultPassword, salt);

                const [userResult] = await pool.execute(
                    'INSERT INTO Users (Name, Email, PasswordHash, Role, Department) VALUES (?, ?, ?, ?, ?)',
                    [name, email, hashedPassword, 'Student', department]
                );

                const userId = userResult.insertId;

                // 4. Create Student Profile
                await pool.execute(
                    'INSERT INTO Students (UserID, RegisterNumber, Block, RoomNumber, Department, ParentPhone) VALUES (?, ?, ?, ?, ?, ?)',
                    [userId, registerNumber, block || 'TBD', roomNumber || 'TBD', department, parentPhone || null]
                );

                results.successful++;
            } catch (err) {
                console.error(`Error processing bulk record (${registerNumber}):`, err.message);
                results.errors.push({ registerNumber, error: err.message });
            }
        }

        res.json({
            message: `Bulk processing complete. ${results.successful} students added, ${results.skipped} duplicates skipped.`,
            ...results
        });

    } catch (error) {
        console.error('Bulk upload server error:', error);
        res.status(500).json({ message: 'Server error during bulk processing.' });
    }
});

// ─── Verify Student Identity (Reset Password Step 1) ──────────────────────────
router.post('/verify-student-identity', async (req, res) => {
    try {
        const { email, registerNumber } = req.body;
        if (!email || !registerNumber) {
            return res.status(400).json({ message: 'Email and Register Number are required.' });
        }

        // Check if student exists with these details
        const [rows] = await pool.execute(
            `SELECT u.ID FROM Users u
             JOIN Students s ON s.UserID = u.ID
             WHERE u.Email = ? AND s.RegisterNumber = ?`,
            [email, registerNumber]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: 'No student found with these matching details.' });
        }

        res.json({ message: 'Identity verified. You can now reset your password.', userId: rows[0].ID });
    } catch (error) {
        console.error('Verify identity error:', error);
        res.status(500).json({ message: 'Server error during identity verification.' });
    }
});

// ─── Reset Student Password (Step 2) ──────────────────────────────────────────
router.post('/reset-student-password', async (req, res) => {
    try {
        const { email, registerNumber, newPassword } = req.body;
        if (!email || !registerNumber || !newPassword) {
            return res.status(400).json({ message: 'Missing required fields.' });
        }

        // Verify again for security
        const [rows] = await pool.execute(
            `SELECT u.ID FROM Users u
             JOIN Students s ON s.UserID = u.ID
             WHERE u.Email = ? AND s.RegisterNumber = ?`,
            [email, registerNumber]
        );

        if (rows.length === 0) {
            return res.status(403).json({ message: 'Identity verification failed.' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        await pool.execute('UPDATE Users SET PasswordHash = ? WHERE ID = ?', [hashedPassword, rows[0].ID]);

        // Add a notification for the user
        await pool.execute('INSERT INTO Notifications (UserID, Message) VALUES (?, ?)', [
            rows[0].ID,
            'Your password was successfully reset.'
        ]);

        res.json({ message: 'Password reset successfully. You can now log in.' });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ message: 'Server error during password reset.' });
    }
});

module.exports = router;

