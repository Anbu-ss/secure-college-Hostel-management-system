import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from './AuthContext';
import PasswordInput from './PasswordInput';
import {
  ShieldCheck,
  GraduationCap,
  Lock,
  Mail,
  ArrowRight,
  AlertCircle,
  CheckCircle,
  Building2,
  UserPlus,
  ShieldAlert,
  Loader2,
  Sparkles
} from 'lucide-react';

const LoginPage = () => {
  const { user, isAuthenticated, loading, logout, getRoleDashboard, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [activePortal, setActivePortal] = useState('student'); // 'student' | 'admin'
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // If user opens root '/' while already authenticated, smoothly forward to their dashboard
  useEffect(() => {
    if (!loading && isAuthenticated && user && location.pathname === '/') {
      const target = getRoleDashboard(user.role);
      navigate(target, { replace: true });
    }
  }, [isAuthenticated, user, loading, navigate, location.pathname, getRoleDashboard]);

  // Clean form state when switching tabs
  const handlePortalSwitch = (portal) => {
    setActivePortal(portal);
    setError('');
    setPassword('');
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const cleanId = identifier.trim();
    if (!cleanId || !password) {
      setError(
        activePortal === 'student'
          ? 'Please enter your registered student email and password.'
          : 'Please enter your official administrator email or username and password.'
      );
      return;
    }

    setSubmitting(true);
    try {
      const result = await login(cleanId, password, rememberMe);
      if (result.success) {
        if (result.redirectUrl) {
          navigate(result.redirectUrl, { replace: true });
        } else {
          navigate('/dashboard', { replace: true });
        }
      }
    } catch (err) {
      const responseData = err.response?.data;
      if (responseData?.mustChangePassword) {
        navigate('/student/change-password', { replace: true, state: { email: cleanId } });
        return;
      }
      if (responseData?.pendingProfile) {
        navigate('/student/complete-profile', { replace: true });
        return;
      }
      if (responseData?.pendingApproval) {
        navigate('/student/pending-approval', { replace: true });
        return;
      }
      const msg = responseData?.message || 'Authentication failed. Please verify your credentials and portal selection.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen relative flex flex-col justify-between items-center bg-slate-900 text-slate-100 font-sans px-4 py-8 overflow-hidden">
      {/* ── Ambient Background Glows ────────────────────────────────────── */}
      <div className="absolute top-0 -left-20 w-[30rem] h-[30rem] bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 -right-20 w-[30rem] h-[30rem] bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40rem] h-[40rem] bg-emerald-600/5 rounded-full blur-3xl pointer-events-none" />

      {/* ── Institutional Top Bar ───────────────────────────────────────── */}
      <header className="relative z-10 flex items-center space-x-2 text-xs font-semibold text-slate-400 uppercase tracking-widest pt-2">
        <Building2 className="h-4 w-4 text-blue-400" />
        <span>DMI College of Engineering — Hostel Management</span>
      </header>

      {/* ── Centered Portal Container ───────────────────────────────────── */}
      <main className="relative z-10 w-full max-w-[460px] my-auto">
        <div className="bg-slate-800/90 backdrop-blur-2xl border border-slate-700/80 shadow-2xl shadow-black/50 rounded-3xl p-7 sm:p-9 transition-all">

          {/* Institutional Crest & Welcome */}
          <div className="text-center mb-6">
            <div className="inline-flex p-3 bg-gradient-to-tr from-blue-600 via-indigo-600 to-emerald-500 text-white rounded-2xl shadow-lg shadow-blue-500/20 mb-3">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white">
              Institutional Hostel Portal
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">

            </p>
          </div>

          {/* Active Session Notification */}
          {isAuthenticated && user && (
            <div className="mb-6 p-3.5 bg-blue-950/60 border border-blue-800/60 rounded-2xl">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-blue-300">Active Session Detected</span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-blue-900/80 text-blue-200 rounded-md">
                  {user.role}
                </span>
              </div>
              <p className="text-xs text-slate-300 truncate mb-3">
                Logged in as <strong className="text-white">{user.name || user.email}</strong>
              </p>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => navigate(getRoleDashboard(user.role))}
                  className="flex-1 py-1.5 px-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-xl flex items-center justify-center space-x-1.5 transition-colors"
                >
                  <span>Go to Dashboard</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={logout}
                  className="py-1.5 px-3 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white text-xs font-medium rounded-xl transition-colors"
                >
                  Switch Account
                </button>
              </div>
            </div>
          )}

          {/* Portal Switcher Tabs (Student vs Admin) */}
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-900/80 border border-slate-700/60 rounded-2xl mb-6">
            <button
              type="button"
              onClick={() => handlePortalSwitch('student')}
              className={`flex items-center justify-center space-x-2 py-2.5 px-3 rounded-xl text-xs font-semibold transition-all duration-200 ${activePortal === 'student'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
            >
              <GraduationCap className="h-4 w-4" />
              <span>Student Portal</span>
            </button>
            <button
              type="button"
              onClick={() => handlePortalSwitch('admin')}
              className={`flex items-center justify-center space-x-2 py-2.5 px-3 rounded-xl text-xs font-semibold transition-all duration-200 ${activePortal === 'admin'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
            >
              <ShieldAlert className="h-4 w-4" />
              <span>Admin Portal</span>
            </button>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mb-5 p-3.5 bg-red-950/70 border border-red-800/80 rounded-2xl flex items-start space-x-3 text-red-200 text-xs animate-shake">
              <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 font-medium leading-relaxed">{error}</div>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            {/* Identifier Field */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                {activePortal === 'student' ? 'Student Registered Email' : 'Official Email / Username'}
              </label>
              <div className="relative">
                <input
                  type={activePortal === 'student' ? 'email' : 'text'}
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder={activePortal === 'student' ? 'your.name@college.edu or personal email' : 'admin@college.edu'}
                  autoComplete="username"
                  required
                  className="w-full px-4 py-3 bg-slate-900/60 border border-slate-700 rounded-2xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
                <Mail className="absolute right-3.5 top-3.5 h-4 w-4 text-slate-500 pointer-events-none" />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors"
                >
                  Forgot Password?
                </Link>
              </div>
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                required
                className="bg-slate-900/60 border-slate-700 text-white placeholder-slate-500"
              />
              {activePortal === 'student' && (
                <p className="text-[11px] text-slate-400 mt-1">
                </p>
              )}
            </div>

            {/* Remember Me */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center space-x-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500 focus:ring-offset-slate-800"
                />
                <span className="text-xs text-slate-400">Remember credentials</span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              className={`w-full py-3.5 px-4 rounded-2xl text-white font-semibold text-sm shadow-lg flex items-center justify-center space-x-2 transition-all duration-200 ${activePortal === 'student'
                ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/25'
                : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/25'
                } disabled:opacity-60 disabled:cursor-not-allowed`}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>Sign In as {activePortal === 'student' ? 'Student' : 'Administrator'}</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Student Portal: Dedicated Registration Link */}
          {activePortal === 'student' ? (
            <div className="mt-6 pt-5 border-t border-slate-700/80 text-center">
              <p className="text-xs text-slate-400 mb-2">New to the hostel system?</p>
              <Link
                to="/student/register"
                className="inline-flex items-center space-x-1.5 py-2 px-4 rounded-xl bg-slate-900/80 hover:bg-slate-900 text-blue-400 hover:text-blue-300 text-xs font-semibold border border-blue-500/30 hover:border-blue-500/50 transition-all"
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span>Student Self-Registration</span>
              </Link>
            </div>
          ) : (
            <div className="mt-6 pt-5 border-t border-slate-700/80 text-center">
              <p className="text-[11px] text-slate-400 leading-relaxed">

              </p>
            </div>
          )}

        </div>
      </main>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="relative z-10 text-center text-[11px] text-slate-400 py-3">
        DMI College of Engineering
      </footer>
    </div>
  );
};

export default LoginPage;
