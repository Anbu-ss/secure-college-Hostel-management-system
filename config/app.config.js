// config/app.config.js
module.exports = {
  port: process.env.PORT || 10000,
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  jwtSecret: process.env.JWT_SECRET,
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  corsOrigins: [
    'https://secure-college-hostel-management-sy.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000',
  ],
};
