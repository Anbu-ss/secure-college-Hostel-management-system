import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import { getRoleDashboard } from '../features/auth/auth.utils';
import ProtectedRoute from '../features/auth/ProtectedRoute';

// Universal Auth Pages
import LoginPage       from '../features/auth/LoginPage';
import Register        from '../features/auth/Register';
import ForgotPassword  from '../features/auth/ForgotPassword';

// Student Features
import StudentRegister       from '../features/students/StudentRegister';
import StudentChangePassword from '../features/students/StudentChangePassword';
import StudentCompleteProfile from '../features/students/StudentCompleteProfile';
import StudentPendingApproval from '../features/students/StudentPendingApproval';
import StudentActivation     from '../features/students/StudentActivation';
import StudentProfile        from '../features/students/StudentProfile';
import StudentDashboard      from '../features/students/StudentDashboard';
import ApplyPass             from '../features/gatepass/ApplyPass';
import StudentPasses         from '../features/gatepass/StudentPasses';

// Staff
import StaffPending      from '../features/gatepass/StaffPending';

// HOD
import HODPending        from '../features/gatepass/HODPending';

// Warden & Admin
import WardenDashboard   from '../features/warden/WardenDashboard';
import WardenApproval    from '../features/warden/WardenApproval';
import WardenPasses      from '../features/warden/WardenPasses';

// Super Admin & Admin Tools
import StudentManagement from '../features/admin/StudentManagement';
import AdminGatePasses   from '../features/admin/AdminGatePasses';
import CreateAdminUser   from '../features/admin/CreateAdminUser';
import HolidayMode       from '../features/admin/HolidayMode';
import BulkStudentUpload from '../features/admin/BulkStudentUpload';

// Dynamic role redirector based on authenticated profile
const DashboardRedirect = () => {
  const { user, isAuthenticated, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 text-gray-500">
        <div className="flex flex-col items-center space-y-2">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs uppercase tracking-widest text-gray-400">Loading Dashboard...</span>
        </div>
      </div>
    );
  }
  if (!isAuthenticated || !user) return <Navigate to="/login" replace />;
  const target = getRoleDashboard(user.role);
  return <Navigate to={target} replace />;
};

const Unauthorized = () => (
  <div className="flex h-screen items-center justify-center flex-col text-center bg-gray-50 p-6">
    <div className="p-4 bg-red-50 border border-red-200 rounded-2xl max-w-sm">
      <p className="text-4xl font-extrabold text-red-500 mb-2">403</p>
      <h3 className="text-base font-bold text-gray-900 mb-1">Access Restricted</h3>
      <p className="text-xs text-gray-600 mb-5">
        Your current account role does not have authorization to view this section.
      </p>
      <a
        href="/dashboard"
        className="inline-flex items-center justify-center px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition"
      >
        Return to Authorized Dashboard
      </a>
    </div>
  </div>
);

function App() {
  return (
    <Router>
      <Routes>
        {/* ── Universal Authentication (Single Login for All Roles) ── */}
        <Route path="/"                element={<LoginPage />} />
        <Route path="/login"           element={<LoginPage />} />
        <Route path="/admin/login"     element={<Navigate to="/login" replace />} />
        <Route path="/register"        element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/dashboard"       element={<DashboardRedirect />} />
        <Route path="/unauthorized"    element={<Unauthorized />} />

        {/* ── Student Onboarding & Self-Registration ───────────────── */}
        <Route path="/student/register"         element={<StudentRegister />} />
        <Route path="/student/change-password"  element={<StudentChangePassword />} />
        <Route path="/student/complete-profile" element={<ProtectedRoute allowedRoles={['Student']}><StudentCompleteProfile /></ProtectedRoute>} />
        <Route path="/student/pending-approval" element={<StudentPendingApproval />} />
        <Route path="/student/activate-account" element={<StudentActivation />} />
        <Route path="/activate"                 element={<Navigate to="/student/register" replace />} />

        {/* ── Student Routes ────────────────────────────────────────── */}
        <Route path="/student/dashboard" element={<ProtectedRoute allowedRoles={['Student']}><StudentDashboard /></ProtectedRoute>} />
        <Route path="/student/profile"   element={<ProtectedRoute allowedRoles={['Student', 'Admin', 'Warden', 'Staff', 'HOD']}><StudentProfile /></ProtectedRoute>} />
        <Route path="/student/apply"     element={<ProtectedRoute allowedRoles={['Student']}><ApplyPass /></ProtectedRoute>} />
        <Route path="/student/passes"    element={<ProtectedRoute allowedRoles={['Student']}><StudentPasses /></ProtectedRoute>} />

        {/* ── Staff Routes ──────────────────────────────────────────── */}
        <Route path="/staff/pending"     element={<ProtectedRoute allowedRoles={['Staff', 'Admin', 'Warden']}><StaffPending /></ProtectedRoute>} />

        {/* ── HOD Routes ────────────────────────────────────────────── */}
        <Route path="/hod/pending"       element={<ProtectedRoute allowedRoles={['HOD', 'Admin', 'Warden']}><HODPending /></ProtectedRoute>} />

        {/* ── Warden & Administrative Routes ────────────────────────── */}
        <Route path="/warden/dashboard"  element={<ProtectedRoute allowedRoles={['Warden', 'Admin', 'Super Admin', 'SuperAdmin']}><WardenDashboard /></ProtectedRoute>} />
        <Route path="/admin/dashboard"   element={<ProtectedRoute allowedRoles={['Admin', 'Super Admin', 'SuperAdmin', 'Warden']}><WardenDashboard /></ProtectedRoute>} />
        <Route path="/super-admin/dashboard" element={<ProtectedRoute allowedRoles={['Admin', 'Super Admin', 'SuperAdmin']}><WardenDashboard /></ProtectedRoute>} />
        <Route path="/warden/approvals"  element={<ProtectedRoute allowedRoles={['Warden', 'Admin', 'Super Admin', 'SuperAdmin']}><WardenApproval /></ProtectedRoute>} />
        <Route path="/warden/passes"     element={<ProtectedRoute allowedRoles={['Warden', 'Admin', 'Super Admin', 'SuperAdmin']}><WardenPasses /></ProtectedRoute>} />

        {/* ── Administrative Tools ──────────────────────────────────── */}
        <Route path="/admin/gate-passes"    element={<ProtectedRoute allowedRoles={['Admin', 'Super Admin', 'SuperAdmin', 'Warden', 'Staff', 'HOD']}><AdminGatePasses /></ProtectedRoute>} />
        <Route path="/admin/students"       element={<ProtectedRoute allowedRoles={['Admin', 'Super Admin', 'SuperAdmin', 'Warden', 'Staff', 'HOD']}><StudentManagement /></ProtectedRoute>} />
        <Route path="/admin/create-user"    element={<ProtectedRoute allowedRoles={['Admin', 'Super Admin', 'SuperAdmin', 'Warden']}><CreateAdminUser /></ProtectedRoute>} />
        <Route path="/admin/holiday-mode"   element={<ProtectedRoute allowedRoles={['Admin', 'Super Admin', 'SuperAdmin', 'Warden', 'HOD']}><HolidayMode /></ProtectedRoute>} />
        <Route path="/admin/bulk-upload"    element={<ProtectedRoute allowedRoles={['Admin', 'Super Admin', 'SuperAdmin', 'Warden', 'Staff']}><BulkStudentUpload /></ProtectedRoute>} />

        {/* ── Legacy Security Redirects ──────────────────────────────── */}
        <Route path="/security/*" element={<Navigate to="/admin/gate-passes" replace />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
