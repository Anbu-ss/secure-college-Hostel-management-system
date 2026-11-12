// src/utils/validators.js
const VALID_DEPARTMENTS = ['IT', 'CSE', 'ECE', 'EEE', 'MECH', 'AIML', 'AIDS', 'CIVIL'];
const ADMIN_ROLES = ['Staff', 'HOD', 'Warden', 'Security', 'Admin'];
const STUDENT_ROLES = ['Student'];

const isValidDepartment = (dept) => VALID_DEPARTMENTS.includes(dept);
const isValidAdminRole  = (role) => ADMIN_ROLES.includes(role);
const isValidStudentRole = (role) => STUDENT_ROLES.includes(role);

module.exports = {
  VALID_DEPARTMENTS,
  ADMIN_ROLES,
  STUDENT_ROLES,
  isValidDepartment,
  isValidAdminRole,
  isValidStudentRole,
};

