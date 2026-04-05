import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

// Portal landing + auth pages
import LandingLogin  from './pages/LandingLogin';
import Login         from './pages/Login';          // Student login (SQLite)
import AdminLogin    from './pages/AdminLogin';      // Admin login (Firebase)
import Register      from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';

// Student
import ApplyPass     from './pages/student/ApplyPass';
import StudentPasses from './pages/student/StudentPasses';

// Staff
import StaffPending  from './pages/staff/StaffPending';

// HOD
import HODPending    from './pages/hod/HODPending';

// Warden
import WardenDashboard from './pages/warden/WardenDashboard';
import WardenApproval  from './pages/warden/WardenApproval';
import WardenPasses    from './pages/warden/WardenPasses';

// Security
import SecurityScan  from './pages/security/SecurityScan';
import SecurityLogs  from './pages/security/SecurityLogs';

// Super Admin
import CreateAdminUser from './pages/admin/CreateAdminUser';
import HolidayMode     from './pages/admin/HolidayMode';
import BulkStudentUpload from './pages/admin/BulkStudentUpload';

// ─── Route guards ─────────────────────────────────────────────────────────────
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex h-screen items-center justify-center text-gray-500">Loading...</div>;
  if (!user)   return <Navigate to="/" />;
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/unauthorized" />;
  return children;
};

// Redirect to role-specific dashboard after login
const DashboardRedirect = () => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/" />;
  switch (user.role) {
    case 'Student':  return <Navigate to="/student/passes" />;
    case 'Staff':    return <Navigate to="/staff/pending" />;
    case 'HOD':      return <Navigate to="/hod/pending" />;
    case 'Warden':   return <Navigate to="/warden/dashboard" />;
    case 'Security': return <Navigate to="/security/scan" />;
    case 'Admin':    return <Navigate to="/warden/dashboard" />;
    default:         return <Navigate to="/" />;
  }
};

const Unauthorized = () => (
  <div className="flex h-screen items-center justify-center flex-col text-center">
    <p className="text-4xl font-bold text-red-500 mb-2">403</p>
    <p className="text-gray-600 mb-4">You don't have permission to view this page.</p>
    <a href="/" className="text-blue-600 underline text-sm">Go back</a>
  </div>
);

function App() {
  return (
    <Router>
      <Routes>
        {/* ── Portal selector ────────────────────── */}
        <Route path="/"              element={<LandingLogin />} />
        <Route path="/login"         element={<Login />} />          {/* Student */}
        <Route path="/admin/login"   element={<AdminLogin />} />     {/* Admin (Firebase) */}
        <Route path="/register"      element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/dashboard"     element={<DashboardRedirect />} />
        <Route path="/unauthorized"  element={<Unauthorized />} />

        {/* ── Student ────────────────────────────── */}
        <Route path="/student/apply"   element={<ProtectedRoute allowedRoles={['Student']}><ApplyPass /></ProtectedRoute>} />
        <Route path="/student/passes"  element={<ProtectedRoute allowedRoles={['Student']}><StudentPasses /></ProtectedRoute>} />
        <Route path="/student/dashboard" element={<Navigate to="/student/passes" />} />

        {/* ── Staff ──────────────────────────────── */}
        <Route path="/staff/pending"   element={<ProtectedRoute allowedRoles={['Staff']}><StaffPending /></ProtectedRoute>} />

        {/* ── HOD ────────────────────────────────── */}
        <Route path="/hod/pending"     element={<ProtectedRoute allowedRoles={['HOD']}><HODPending /></ProtectedRoute>} />

        {/* ── Warden ─────────────────────────────── */}
        <Route path="/warden/dashboard" element={<ProtectedRoute allowedRoles={['Warden','Admin']}><WardenDashboard /></ProtectedRoute>} />
        <Route path="/warden/approvals" element={<ProtectedRoute allowedRoles={['Warden','Admin']}><WardenApproval /></ProtectedRoute>} />
        <Route path="/warden/passes"    element={<ProtectedRoute allowedRoles={['Warden','Admin']}><WardenPasses /></ProtectedRoute>} />

        {/* ── Security ───────────────────────────── */}
        <Route path="/security/scan"   element={<ProtectedRoute allowedRoles={['Security','Admin','Warden']}><SecurityScan /></ProtectedRoute>} />
        <Route path="/security/logs"   element={<ProtectedRoute allowedRoles={['Security','Admin','Warden','HOD']}><SecurityLogs /></ProtectedRoute>} />

        {/* ── Super Admin ────────────────────────── */}
        <Route path="/admin/create-user"    element={<ProtectedRoute allowedRoles={['Admin','Warden']}><CreateAdminUser /></ProtectedRoute>} />
        <Route path="/admin/holiday-mode"   element={<ProtectedRoute allowedRoles={['Admin','Warden','HOD']}><HolidayMode /></ProtectedRoute>} />
        <Route path="/admin/bulk-upload"    element={<ProtectedRoute allowedRoles={['Admin','Warden','Staff']}><BulkStudentUpload /></ProtectedRoute>} />
      </Routes>
    </Router>
  );
}

export default App;
