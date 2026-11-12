// src/app/app.config.js - Client Application Configuration
export const APP_CONFIG = {
  appName: 'Secure College Hostel Management System',
  apiUrl: import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '' : 'https://secure-college-hostel-management-system-3.onrender.com'),
  googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
};

export default APP_CONFIG;

