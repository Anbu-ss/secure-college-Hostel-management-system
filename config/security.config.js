// config/security.config.js
module.exports = {
  jwt: {
    secret: process.env.JWT_SECRET || 'hostel_secret_key',
    studentExpiresIn: '24h',
    adminExpiresIn: '12h',
  },
  bcrypt: {
    saltRounds: 10,
  },
  cors: {
    credentials: true,
    allowedOrigins: [
      'https://secure-college-hostel-management-sy.vercel.app',
      'http://localhost:5173',
      'http://localhost:3000',
    ],
  },
  roles: {
    adminRoles: ['Staff', 'HOD', 'Warden', 'Security', 'Admin'],
    studentRoles: ['Student'],
  },
};

