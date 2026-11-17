import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from './AuthContext';
import PasswordInput from './PasswordInput';
import { GoogleLogin } from '@react-oauth/google';
import { 
  User, 
  Mail, 
  GraduationCap, 
  ArrowRight, 
  AlertCircle, 
  CheckCircle,
  Loader2 
} from 'lucide-react';

const LoginForm = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, googleLogin } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  // Intelligent detector for student register number vs staff/admin email
  const cleanId = identifier.trim();
  const isStudentId = /^\d+$/.test(cleanId) && cleanId.length >= 3;
  const isEmailId = cleanId.includes('@');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!cleanId || !password) {
      setError('Please provide your Register Number or Email along with your Password.');
      return;
    }

    setLoading(true);
    try {
      const result = await login(cleanId, password, rememberMe);
      if (result.success) {
        navigate(result.redirectUrl, { replace: true });
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Invalid credentials. Please verify your details.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setError('');
    setGoogleLoading(true);
    try {
      if (!credentialResponse?.credential) {
        throw new Error('No credential received from Google.');
      }
      const result = await googleLogin(credentialResponse.credential);
      if (result.success) {
        navigate(result.redirectUrl, { replace: true });
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Google Sign-In failed. Please try again.';
      setError(msg);
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGoogleError = () => {
    setError('Google Sign-In was cancelled or failed to initialize.');
  };

  const isSubmitting = loading || googleLoading;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Success Notification Banner */}
      {location.state?.successMessage && !error && (
        <div
          role="status"
          className="flex items-start space-x-3 p-3.5 bg-emerald-50/90 border border-emerald-200/80 rounded-2xl text-xs text-emerald-800 animate-fadeIn"
        >
          <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
          <span className="leading-relaxed font-medium">{location.state.successMessage}</span>
        </div>
      )}

      {/* Dynamic Error Banner */}
      {error && (
        <div
          role="alert"
          className="flex items-start space-x-3 p-3.5 bg-rose-50/90 border border-rose-200/80 rounded-2xl text-xs text-rose-800 animate-fadeIn"
        >
          <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
          <span className="leading-relaxed font-medium">{error}</span>
        </div>
      )}

      {/* Identifier Input (Register Number or Email) */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label 
            htmlFor="identifier" 
            className="block text-xs font-semibold text-slate-700 tracking-wide"
          >
            Register No. or Email
          </label>
          {/* Smart detection badge */}
          {isStudentId && (
            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-700 animate-fadeIn">
              <GraduationCap className="h-3 w-3" />
              <span>Student ID</span>
            </span>
          )}
          {isEmailId && (
            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-100 text-indigo-700 animate-fadeIn">
              <Mail className="h-3 w-3" />
              <span>Faculty / Staff</span>
            </span>
          )}
        </div>

        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-600 transition-colors">
            {isStudentId ? (
              <GraduationCap className="h-4 w-4 text-blue-600 transition-colors" />
            ) : isEmailId ? (
              <Mail className="h-4 w-4 text-indigo-600 transition-colors" />
            ) : (
              <User className="h-4 w-4" />
            )}
          </div>
          <input
            id="identifier"
            name="identifier"
            type="text"
            required
            autoComplete="username"
            disabled={isSubmitting}
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="e.g. 210523205004 or name@dmice.edu"
            className="block w-full pl-10 pr-3.5 py-2.5 bg-slate-50/80 hover:bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-600 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-4 focus:ring-blue-600/10 transition-all disabled:opacity-50"
          />
        </div>
      </div>

      {/* Password Input */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label 
            htmlFor="password" 
            className="block text-xs font-semibold text-slate-700 tracking-wide"
          >
            Password
          </label>
          <Link
            to="/forgot-password"
            className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 transition"
          >
            Forgot?
          </Link>
        </div>
        <PasswordInput
          id="password"
          name="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isSubmitting}
          placeholder="••••••••"
        />
      </div>

      {/* Remember Me */}
      <div className="flex items-center justify-between pt-0.5">
        <label className="flex items-center space-x-2 text-slate-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            disabled={isSubmitting}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded cursor-pointer transition"
          />
          <span className="text-xs text-slate-600 font-medium">Keep me signed in</span>
        </label>
        <span className="text-[11px] text-slate-400">Auto-routes to role</span>
      </div>

      {/* Submit Action */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full relative group overflow-hidden flex items-center justify-center py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800 shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-indigo-500/30 active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading ? (
          <span className="inline-flex items-center space-x-2">
            <Loader2 className="animate-spin h-4 w-4 text-white" />
            <span>Authenticating...</span>
          </span>
        ) : (
          <span className="inline-flex items-center space-x-2">
            <span>Sign In</span>
            <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
          </span>
        )}
      </button>

      {/* Divider */}
      <div className="relative py-1">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-200/80" />
        </div>
        <div className="relative flex justify-center text-[11px]">
          <span className="px-3 bg-white text-slate-400 font-medium">or continue with</span>
        </div>
      </div>

      {/* Google OAuth Button */}
      <div className="w-full flex justify-center min-h-[40px] [&>div]:w-full [&>div>iframe]:!mx-auto">
        {googleLoading ? (
          <div className="w-full flex items-center justify-center py-2.5 px-4 border border-slate-200 rounded-xl bg-slate-50 text-xs font-semibold text-slate-600 space-x-2">
            <Loader2 className="animate-spin h-4 w-4 text-slate-500" />
            <span>Connecting Google Account...</span>
          </div>
        ) : (
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={handleGoogleError}
            theme="outline"
            size="large"
            shape="rectangular"
            text="continue_with"
            width="100%"
          />
        )}
      </div>

      {/* Secondary registration option */}
      <div className="pt-3 text-center text-xs text-slate-500 border-t border-slate-100">
        New student or hosteler?{' '}
        <Link to="/register" className="font-semibold text-blue-600 hover:text-blue-700 hover:underline">
          Create student account
        </Link>
      </div>
    </form>
  );
};

export default LoginForm;
