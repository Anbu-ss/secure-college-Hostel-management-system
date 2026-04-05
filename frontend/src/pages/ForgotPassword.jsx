import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';
import { sendPasswordResetEmail } from 'firebase/auth';
import { firebaseAuth } from '../config/firebase';
import { ShieldCheck, Mail, Lock, AlertCircle, ArrowLeft, CheckCircle, Hash } from 'lucide-react';

const ForgotPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const type = searchParams.get('type') || 'student'; // 'student' or 'admin'

  const [email, setEmail] = useState('');
  const [registerNumber, setRegisterNumber] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [step, setStep] = useState(1); // 1: Verify Identity, 2: Reset Password
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleAdminReset = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await sendPasswordResetEmail(firebaseAuth, email);
      setSuccess('A password reset link has been sent to your email.');
    } catch (err) {
      console.error('Firebase reset error:', err);
      if (err.code === 'auth/user-not-found') {
        setError('No account found with this email.');
      } else {
        setError('Error sending reset email. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleStudentVerify = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await axios.post('/api/auth/verify-student-identity', {
        email,
        registerNumber
      });
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.message || 'Verification failed. Please check your details.');
    } finally {
      setLoading(false);
    }
  };

  const handleStudentReset = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await axios.post('/api/auth/reset-student-password', {
        email,
        registerNumber,
        newPassword
      });
      setSuccess('Password updated successfully! Redirecting to login...');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Reset failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="bg-white p-3 rounded-full shadow-md">
            <ShieldCheck className="h-10 w-10 text-blue-600" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Reset Password
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          {type === 'admin' ? 'Admin Portal Recovery' : 'Student Portal Recovery'}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-lg sm:rounded-xl sm:px-10 relative">
          <Link
            to={type === 'admin' ? '/admin/login' : '/login'}
            className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-800 mb-6 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Back to login
          </Link>

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center">
              <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center">
              <CheckCircle className="h-5 w-5 mr-2 flex-shrink-0" />
              <span className="text-sm">{success}</span>
            </div>
          )}

          {/* Admin Flow */}
          {type === 'admin' && !success && (
            <form className="space-y-5" onSubmit={handleAdminReset}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Admin Email</label>
                <div className="relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="email"
                    required
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="john.staff@dmice.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className={`w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors ${loading ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                {loading ? 'Processing...' : 'Send Reset Link'}
              </button>
            </form>
          )}

          {/* Student Flow - Step 1 */}
          {type === 'student' && step === 1 && !success && (
            <form className="space-y-5" onSubmit={handleStudentVerify}>
              <div className="bg-blue-50 p-3 rounded-lg text-xs text-blue-700 mb-4 border border-blue-100 leading-relaxed">
                Enter your registered Email and Register Number to verify your identity.
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
                <div className="relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="email"
                    required
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="you@college.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Register Number</label>
                <div className="relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Hash className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    required
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="e.g. 2105..."
                    value={registerNumber}
                    onChange={(e) => setRegisterNumber(e.target.value)}
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className={`w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors ${loading ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                {loading ? 'Verifying...' : 'Verify Details'}
              </button>
            </form>
          )}

          {/* Student Flow - Step 2 */}
          {type === 'student' && step === 2 && !success && (
            <form className="space-y-5" onSubmit={handleStudentReset}>
              <div className="bg-green-50 p-3 rounded-lg text-xs text-green-700 mb-4 border border-green-100 flex items-center">
                <CheckCircle className="h-4 w-4 mr-1.5 flex-shrink-0" />
                Identity verified! Enter your new password below.
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                <div className="relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="password"
                    required
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                <div className="relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="password"
                    required
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className={`w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors ${loading ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                {loading ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          )}

          {success && type === 'admin' && (
            <div className="mt-6 text-center">
              <Link to="/admin/login" className="text-sm font-medium text-blue-600 hover:text-blue-500">
                Go back to login
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
