const express      = require('express');
const bcrypt       = require('bcryptjs');
const jwt          = require('jsonwebtoken');
const pool         = require('../config/db');
const { OAuth2Client } = require('google-auth-library');

const router = express.Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const VALID_DEPARTMENTS = ['IT', 'CSE', 'ECE', 'EEE', 'MECH', 'AIML', 'AIDS', 'CIVIL'];
const ADMIN_ROLES = ['Staff', 'HOD', 'Warden', 'Security'];

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

// Login User
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const [users] = await pool.execute('SELECT * FROM Users WHERE Email = ?', [email]);
        if (users.length === 0) return res.status(400).json({ message: 'Invalid email or password.' });

        const user = users[0];

        if (!user.PasswordHash) {
            return res.status(400).json({ message: 'Please login using Google.' });
        }

        const isMatch = await bcrypt.compare(password, user.PasswordHash);
        if (!isMatch) return res.status(400).json({ message: 'Invalid email or password.' });

        const token = jwt.sign(
            { id: user.ID, email: user.Email, role: user.Role, department: user.Department },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            token,
            user: { id: user.ID, name: user.Name, email: user.Email, role: user.Role, department: user.Department }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error during login.' });
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
            user: { id: user.ID, name: user.Name, email: user.Email, role: user.Role }
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

        const { firebaseAuth } = require('../config/firebase');

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

        const { firebaseAuth } = require('../config/firebase');

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

