// src/features/auth/auth.utils.js

export const getRoleDashboard = (role) => {
  switch (role) {
    case 'Student':
      return '/student/dashboard';
    case 'Staff':
      return '/staff/pending';
    case 'HOD':
      return '/hod/pending';
    case 'Warden':
      return '/warden/dashboard';
    case 'Security':
    case 'Admin':
      return '/admin/dashboard';
    case 'Super Admin':
    case 'SuperAdmin':
      return '/super-admin/dashboard';
    default:
      return '/dashboard';
  }
};

export const isAuthorizedRole = (userRole, allowedRoles) => {
  if (!allowedRoles || allowedRoles.length === 0) return true;
  return allowedRoles.includes(userRole);
};

