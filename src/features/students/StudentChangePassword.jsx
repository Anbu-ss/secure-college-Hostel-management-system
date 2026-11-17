import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import {
  KeyRound,
  Lock,
  Mail,
  ArrowRight,
  AlertCircle,
  CheckCircle,
  Loader2,
  ShieldAlert,
  Building2
} from 'lucide-react';
import PasswordInput from '../auth/PasswordInput';
import { useAuth } from '../auth/AuthContext';

const StudentChangePassword = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, login, logout } = useAuth();

  const initialEmail = location.state?.email || user?.email || '';
  const [email, setEmail] = useState(initialEmail);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Password rules validation
  const isLengthValid = newPassword.length >= 6;
  const doPasswordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Please provide your registered email address.');
      return;
    }

    if (!currentPassword) {
      setError('Please enter your current password.');
      return;
    }

    if (!isLengthValid) {
      setError('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword === currentPassword) {
      setError('New password must be different from your current password.');
      return;
    }

    if (!doPasswordsMatch) {
      setError('New passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await axios.post('/api/student/change-password', {
        email: email.trim(),
        currentPassword,
        newPassword,
        confirmPassword
      });

      if (res.data.success) {
        // Sign out active temporary session and clear auth state
        try {
          if (logout) logout();
        } catch (_) {}
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
        delete axios.defaults.headers.common['Authorization'];

        navigate('/login', { 
          replace: true, 
          state: { successMessage: 'Password updated successfully! Please login with your new password.' } 
        });
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Password update failed. Please check your current password and try again.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen relative flex flex-col justify-between items-center bg-slate-900 text-slate-100 font-sans px-4 py-8 overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-0 -left-20 w-[30rem] h-[30rem] bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 -right-20 w-[30rem] h-[30rem] bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 flex items-center space-x-2 text-xs font-semibold text-slate-400 uppercase tracking-widest pt-2">
        <Building2 className="h-4 w-4 text-amber-400" />
        <span>Mandatory Security Safeguard • Step 1 of 2</span>
      </header>

      {/* Main Container */}
      <main className="relative z-10 w-full max-w-[460px] my-auto">
        <div className="bg-slate-800/90 backdrop-blur-2xl border border-slate-700/80 shadow-2xl shadow-black/50 rounded-3xl p-7 sm:p-9">

          {/* Heading */}
          <div className="text-center mb-6">
            <div className="inline-flex p-3 bg-gradient-to-tr from-amber-500 to-orange-600 text-white rounded-2xl shadow-lg shadow-orange-500/20 mb-3">
              <KeyRound className="h-7 w-7" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white">
              Change Initial Password
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mb-5 p-3.5 bg-red-950/70 border border-red-800/80 rounded-2xl flex items-start space-x-2.5 text-red-200 text-xs">
              <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
              <span className="font-medium leading-relaxed">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Address */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Registered Student Email
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your.email@college.edu"
                  required
                  className="w-full px-4 py-3 bg-slate-900/60 border border-slate-700 rounded-2xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <Mail className="absolute right-3.5 top-3.5 h-4 w-4 text-slate-500 pointer-events-none" />
              </div>
            </div>

            {/* Current Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Current Password
              </label>
              <PasswordInput
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter your current password"
                required
                className="bg-slate-900/60 border-slate-700 text-white placeholder-slate-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">
              </p>
            </div>

            {/* New Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                New Private Password
              </label>
              <PasswordInput
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Choose a strong, private password"
                required
                className="bg-slate-900/60 border-slate-700 text-white placeholder-slate-500"
              />
            </div>

            {/* Confirm New Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Confirm New Password
              </label>
              <PasswordInput
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-type your new password"
                required
                className="bg-slate-900/60 border-slate-700 text-white placeholder-slate-500"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 px-4 rounded-2xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-sm shadow-lg shadow-amber-600/30 flex items-center justify-center space-x-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Updating in Supabase Auth...</span>
                </>
              ) : (
                <>
                  <span>Save Password & Proceed to Profile</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 text-center text-[11px] text-slate-400 py-2">
        DMI College of Engineering
      </footer>
    </div>
  );
};

export default StudentChangePassword;

