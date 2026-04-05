const jwt          = require('jsonwebtoken');
const { firebaseAuth } = require('../config/firebase');

// Verify standard JWT
const verifyToken = (req, res, next) => {
    const token = req.header('Authorization');

    if (!token) {
        return res.status(401).json({ message: 'Access Denied. No token provided.' });
    }

    try {
        const decoded = jwt.verify(token.replace('Bearer ', ''), process.env.JWT_SECRET);
        req.user = decoded; // Contains id, email, role
        next();
    } catch (err) {
        res.status(400).json({ message: 'Invalid token.' });
    }
};

// Verify User Role
const verifyRole = (roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Forbidden. You do not have permission.' });
        }
        next();
    };
};

// Verify a Firebase ID token (issued by Firebase Auth on the frontend)
const verifyFirebaseToken = async (req, res, next) => {
    const authHeader = req.header('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
        return res.status(401).json({ message: 'Access Denied. No token provided.' });
    }

    try {
        const decoded = await firebaseAuth.verifyIdToken(token);
        // Attach a consistent user object so the rest of the app works the same
        req.user = { firebaseUid: decoded.uid, email: decoded.email, name: decoded.name };
        next();
    } catch (err) {
        res.status(401).json({ message: 'Invalid or expired Firebase token.' });
    }
};

module.exports = { verifyToken, verifyRole, verifyFirebaseToken };
