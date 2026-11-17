import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import PasswordInput from './PasswordInput';
import { ShieldCheck, Mail, ArrowLeft, CheckCircle, AlertCircle, KeyRound, Loader2, RefreshCw } from 'lucide-react';

const ForgotPassword = () => {
  const navigate = useNavigate();

  const [step, setStep] = useState(1); // 1: Request Reset, 2: Enter Token & New Password
  const [identifier, setIdentifier] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [infoToken, setInfoToken] = useState('');

  // Check for token in URL query params (e.g., /forgot-password?token=...) or sessionStorage
  React.useEffect(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const queryToken = urlParams.get('token') || sessionStorage.getItem('reset_token');
      if (queryToken) {
        setToken(queryToken);
        setInfoToken(queryToken);
        setStep(2);
      }
    } catch (_) {}
  }, []);

  // Step 1: Submit email / registerNumber
  const handleRequestReset = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const res = await axios.post('/api/auth/forgot-password', {
        identifier: identifier.trim()
      });

      const returnedToken = res.data.resetToken || res.data.token || res.data.reset_token || '';
      if (returnedToken) {
        setInfoToken(returnedToken);
        setToken(returnedToken);
        try { sessionStorage.setItem('reset_token', returnedToken); } catch (_) {}
      }
      setSuccess(res.data.message || 'Password reset initiated.');
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to process password reset request.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Submit new password with token
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post('/api/auth/reset-password', {
        token: token.trim(),
        newPassword
      });

      try { sessionStorage.removeItem('reset_token'); } catch (_) {}
      setSuccess(res.data.message || 'Password updated successfully! Redirecting to login...');
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Password reset failed. Invalid or expired token.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 sm:p-6 lg:p-8 font-sans">
      <div className="w-full max-w-md">
        {/* Back to Login link */}
        <div className="mb-6">
          <Link
            to="/login"
            className="inline-flex items-center text-xs font-semibold text-gray-500 hover:text-blue-600 transition"
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Back to Universal Login
          </Link>
        </div>

        {/* Card */}
        <div className="bg-white p-7 sm:p-8 rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100">
          <div className="flex items-center space-x-3 mb-6">
            <div className="p-2.5 bg-blue-50 border border-blue-100 rounded-xl text-blue-600">
              <KeyRound className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Password Recovery</h2>
              <p className="text-xs text-gray-500">Universal Account Access</p>
            </div>
          </div>

          {error && (
            <div className="mb-5 flex items-start space-x-3 p-3.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-5 flex items-start space-x-3 p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-800">
              <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          {step === 1 ? (
            <form onSubmit={handleRequestReset} className="space-y-5">
              <p className="text-xs text-gray-500 leading-relaxed">
                Enter your registered Email ID or Student Register Number. A secure reset token will be generated to update your password.
              </p>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                  Email ID or Register Number
                </label>
                <div className="relative rounded-md shadow-xs">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                    <Mail className="h-5 w-5" />
                  </div>
                  <input
                    type="text"
                    required
                    disabled={loading}
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="e.g. 210523205004 or name@dmice.edu"
                    className="block w-full pl-10 pr-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center py-2.5 px-4 rounded-lg shadow-sm text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 transition"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                    Searching Account...
                  </>
                ) : (
                  'Continue with Recovery'
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-4">
              {infoToken && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900">
                  <span className="font-semibold block mb-1">Generated Security Token:</span>
                  <div className="font-mono bg-white p-2 rounded border border-blue-100 break-all select-all text-[11px]">
                    {infoToken}
                  </div>
                  <span className="text-[11px] text-blue-700 mt-1 block">Valid for 15 minutes. Automatically populated below.</span>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Reset Token
                  </label>
                  {token && (
                    <span className="text-[11px] font-medium text-emerald-600 flex items-center">
                      <CheckCircle className="h-3.5 w-3.5 mr-1 inline" /> Auto-filled
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  required
                  disabled={loading}
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Paste your reset token here"
                  className="block w-full px-3.5 py-2 bg-blue-50/40 border border-blue-200 rounded-lg text-xs font-mono text-gray-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  New Password
                </label>
                <PasswordInput
                  id="newPassword"
                  name="newPassword"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Confirm New Password
                </label>
                <PasswordInput
                  id="confirmPassword"
                  name="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your new password"
                  disabled={loading}
                />
              </div>

              <div className="flex items-center space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  disabled={loading}
                  className="w-1/3 py-2.5 px-3 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-2/3 flex items-center justify-center py-2.5 px-4 rounded-lg shadow-sm text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 transition"
                >
                  {loading ? (
                    <>
                      <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                      Updating...
                    </>
                  ) : (
                    'Set New Password'
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
