import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  ShieldCheck, 
  UserCheck, 
  KeyRound, 
  Lock, 
  ArrowRight, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  ArrowLeft,
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import PasswordInput from '../auth/PasswordInput';

const StudentActivation = () => {
  const navigate = useNavigate();

  const [step, setStep] = useState(1); // 1: Verify RegNo, 2: Enter Code & Password, 3: Success
  const [registerNumber, setRegisterNumber] = useState('');
  const [activationCode, setActivationCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [studentInfo, setStudentInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Step 1: Verify Register Number
  const handleInitiate = async (e) => {
    e.preventDefault();
    setError('');
    const cleanReg = registerNumber.trim();
    if (!cleanReg) {
      setError('Please enter your official Register Number.');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post('/api/auth/activation/initiate', { registerNumber: cleanReg });
      setStudentInfo(res.data);
      if (res.data.activationCode) {
        setActivationCode(res.data.activationCode);
      }
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.message || 'Verification failed. Please contact your college administrator.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Complete Password Setup & Activation
  const handleComplete = async (e) => {
    e.preventDefault();
    setError('');

    if (!activationCode.trim()) {
      setError('Please enter your activation code.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post('/api/auth/activation/complete', {
        registerNumber: registerNumber.trim(),
        activationCode: activationCode.trim(),
        password,
        confirmPassword
      });

      setSuccessMsg(res.data.message || 'Account activated successfully!');
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.message || 'Activation failed. Please check your activation code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex flex-col justify-between items-center bg-slate-50 text-slate-900 font-sans px-4 py-8 overflow-hidden">
      {/* Ambient background glows */}
      <div className="absolute top-0 -left-20 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 -right-20 w-96 h-96 bg-indigo-400/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header */}
      <header className="relative z-10 flex items-center space-x-2 text-xs font-semibold text-slate-500 uppercase tracking-widest pt-2">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span>DMICE Student Portal</span>
      </header>

      {/* Main Activation Card */}
      <main className="relative z-10 w-full max-w-[440px] my-auto">
        <div className="bg-white/95 backdrop-blur-xl border border-white/80 shadow-xl shadow-slate-200/50 rounded-3xl p-7 sm:p-9 transition-all">
          
          {/* Header */}
          <div className="text-center mb-6">
            <div className="inline-flex p-3 bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 text-white rounded-2xl shadow-lg shadow-indigo-500/25 mb-4">
              <UserCheck className="h-7 w-7" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
              Account Activation
            </h1>
            <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
              Activate your official student account and create your personal password
            </p>
          </div>

          {/* Stepper Indicator */}
          <div className="flex items-center justify-center space-x-3 mb-6">
            <div className={`flex items-center space-x-1.5 text-xs font-semibold ${step >= 1 ? 'text-blue-600' : 'text-slate-400'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step >= 1 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'}`}>1</span>
              <span>Verify</span>
            </div>
            <span className="w-8 h-0.5 bg-slate-200" />
            <div className={`flex items-center space-x-1.5 text-xs font-semibold ${step >= 2 ? 'text-blue-600' : 'text-slate-400'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step >= 2 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'}`}>2</span>
              <span>Set Password</span>
            </div>
            <span className="w-8 h-0.5 bg-slate-200" />
            <div className={`flex items-center space-x-1.5 text-xs font-semibold ${step === 3 ? 'text-emerald-600' : 'text-slate-400'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 3 ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'}`}>3</span>
              <span>Complete</span>
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div role="alert" className="mb-5 flex items-start space-x-3 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 animate-fadeIn">
              <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
              <span className="leading-relaxed font-medium">{error}</span>
            </div>
          )}

          {/* STEP 1: Enter Register Number */}
          {step === 1 && (
            <form onSubmit={handleInitiate} className="space-y-4">
              <div>
                <label htmlFor="regNo" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Official Register Number
                </label>
                <input
                  id="regNo"
                  type="text"
                  required
                  disabled={loading}
                  value={registerNumber}
                  onChange={(e) => setRegisterNumber(e.target.value)}
                  placeholder="e.g. 210523205004"
                  className="block w-full px-3.5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 transition"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Provided on your official college ID card or admission receipt.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center py-3 px-4 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20 active:scale-[0.99] transition disabled:opacity-60"
              >
                {loading ? (
                  <span className="inline-flex items-center space-x-2">
                    <Loader2 className="animate-spin h-4 w-4 text-white" />
                    <span>Locating Student Record...</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center space-x-1.5">
                    <span>Verify Identity</span>
                    <ArrowRight className="h-4 w-4" />
                  </span>
                )}
              </button>

              <div className="text-center pt-2">
                <Link to="/login" className="inline-flex items-center text-xs font-semibold text-slate-500 hover:text-slate-800 transition">
                  <ArrowLeft className="h-3 w-3 mr-1" />
                  Back to Sign In
                </Link>
              </div>
            </form>
          )}

          {/* STEP 2: Enter Code & Password */}
          {step === 2 && (
            <form onSubmit={handleComplete} className="space-y-4">
              {/* Verified Student Callout */}
              {studentInfo && (
                <div className="p-3 bg-blue-50/80 border border-blue-200/80 rounded-2xl text-xs space-y-1">
                  <div className="flex items-center justify-between font-bold text-slate-900">
                    <span>{studentInfo.studentName}</span>
                    <span className="text-blue-700 font-mono">{studentInfo.registerNumber}</span>
                  </div>
                  <p className="text-slate-500">
                    Account email: <strong className="text-slate-700">{studentInfo.maskedEmail}</strong>
                  </p>
                </div>
              )}

              {/* Activation Code Input */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="code" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    One-Time Activation Code
                  </label>
                  <span className="text-[11px] text-blue-600 font-medium">6-character code</span>
                </div>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                  <input
                    id="code"
                    type="text"
                    required
                    disabled={loading}
                    value={activationCode}
                    onChange={(e) => setActivationCode(e.target.value.toUpperCase())}
                    placeholder="e.g. ACT-A9X4B2"
                    className="block w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono tracking-wider text-slate-900 focus:outline-hidden focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 transition"
                  />
                </div>
              </div>

              {/* Create Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Create Account Password
                </label>
                <PasswordInput
                  id="newPassword"
                  name="newPassword"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  placeholder="Min 6 characters"
                />
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Confirm Password
                </label>
                <PasswordInput
                  id="confirmPassword"
                  name="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                  placeholder="Repeat your password"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center py-3 px-4 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-500/20 active:scale-[0.99] transition disabled:opacity-60"
              >
                {loading ? (
                  <span className="inline-flex items-center space-x-2">
                    <Loader2 className="animate-spin h-4 w-4 text-white" />
                    <span>Activating Account...</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center space-x-1.5">
                    <CheckCircle className="h-4 w-4" />
                    <span>Activate Account & Proceed</span>
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-full text-center text-xs font-semibold text-slate-500 hover:text-slate-800 transition pt-1"
              >
                &larr; Re-enter Register Number
              </button>
            </form>
          )}

          {/* STEP 3: Complete & Ready */}
          {step === 3 && (
            <div className="text-center py-4 space-y-4 animate-fadeIn">
              <div className="w-16 h-16 mx-auto bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shadow-inner">
                <CheckCircle2 className="h-9 w-9" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Account Activated!</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                  {successMsg || 'Your official student credentials have been created. You can now log in using your Register Number and password.'}
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="w-full inline-flex items-center justify-center py-3 px-4 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20 transition"
                >
                  <span>Go to Student Login</span>
                  <ArrowRight className="h-4 w-4 ml-1.5" />
                </button>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 flex items-center justify-center space-x-2 text-[11px] text-slate-400 pb-2">
        <Lock className="h-3 w-3" />
        <span>Secure College Hostel Management • Authorized Activation</span>
      </footer>
    </div>
  );
};

export default StudentActivation;

