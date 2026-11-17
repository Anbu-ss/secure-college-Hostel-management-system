import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { 
  GraduationCap, 
  User, 
  Mail, 
  Phone, 
  Lock, 
  ArrowRight, 
  AlertCircle, 
  CheckCircle, 
  Loader2, 
  Info,
  ShieldCheck,
  Building2
} from 'lucide-react';
import PasswordInput from '../auth/PasswordInput';

const StudentRegister = () => {
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('dmi@1202');
  const [confirmPassword, setConfirmPassword] = useState('dmi@1202');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successData, setSuccessData] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!fullName.trim() || !email.trim()) {
      setError('Full name and email address are required.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Initial password and confirm password do not match.');
      return;
    }

    if (password !== 'dmi@1202') {
      setError('For institutional onboarding, the initial temporary password must be dmi@1202. You will set your private password upon your first sign in.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await axios.post('/api/student/register', {
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        confirmPassword,
        phoneNumber: phoneNumber.trim() || null
      });

      if (res.data.success) {
        setSuccessData(res.data);
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Registration failed. Please check your details and try again.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen relative flex flex-col justify-between items-center bg-slate-900 text-slate-100 font-sans px-4 py-8 overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-0 -left-20 w-[30rem] h-[30rem] bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 -right-20 w-[30rem] h-[30rem] bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 flex items-center space-x-2 text-xs font-semibold text-slate-400 uppercase tracking-widest pt-2">
        <Building2 className="h-4 w-4 text-blue-400" />
        <span>DMI College of Engineering • Student Onboarding</span>
      </header>

      {/* Main Container */}
      <main className="relative z-10 w-full max-w-[480px] my-auto">
        <div className="bg-slate-800/90 backdrop-blur-2xl border border-slate-700/80 shadow-2xl shadow-black/50 rounded-3xl p-7 sm:p-9">

          {/* Icon and Title */}
          <div className="text-center mb-6">
            <div className="inline-flex p-3 bg-gradient-to-tr from-blue-600 to-indigo-600 text-white rounded-2xl shadow-lg shadow-blue-500/20 mb-3">
              <GraduationCap className="h-7 w-7" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white">
              Student Self-Registration
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Register individually to create your official hostel profile in Supabase
            </p>
          </div>

          {/* Success State */}
          {successData ? (
            <div className="space-y-5 animate-fadeIn">
              <div className="p-4 bg-emerald-950/60 border border-emerald-800/80 rounded-2xl text-center">
                <CheckCircle className="h-10 w-10 text-emerald-400 mx-auto mb-2" />
                <h3 className="text-base font-bold text-white mb-1">Registration Complete!</h3>
                <p className="text-xs text-emerald-300 leading-relaxed">
                  Your student record has been generated and synchronized with Supabase.
                </p>
                
                <div className="mt-4 p-3 bg-slate-900/80 rounded-xl border border-slate-700 text-left space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">Assigned Student ID:</span>
                    <span className="font-mono font-bold text-blue-400 text-sm">{successData.studentCode || '001'}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">Registered Email:</span>
                    <span className="font-medium text-slate-200">{successData.email}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">Initial Password:</span>
                    <span className="font-mono font-bold text-amber-400">dmi@1202</span>
                  </div>
                </div>
              </div>

              <div className="p-3.5 bg-blue-950/50 border border-blue-800/60 rounded-2xl flex items-start space-x-2.5 text-xs text-blue-200">
                <Info className="h-4 w-4 text-blue-400 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>Next Step:</strong> Log in using your email and the temporary password (<code className="font-mono text-white">dmi@1202</code>). You will be prompted immediately to set your private password and complete your profile.
                </span>
              </div>

              <button
                type="button"
                onClick={() => navigate('/login')}
                className="w-full py-3.5 px-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm shadow-lg shadow-blue-600/30 flex items-center justify-center space-x-2 transition-all"
              >
                <span>Proceed to Student Login</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ) : (
            /* Registration Form */
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Error Box */}
              {error && (
                <div className="p-3 bg-red-950/70 border border-red-800/80 rounded-2xl flex items-start space-x-2.5 text-red-200 text-xs">
                  <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <span className="font-medium">{error}</span>
                </div>
              )}

              {/* Full Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Full Name (as per college records)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Arun Kumar"
                    required
                    className="w-full px-4 py-3 bg-slate-900/60 border border-slate-700 rounded-2xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <User className="absolute right-3.5 top-3.5 h-4 w-4 text-slate-500 pointer-events-none" />
                </div>
              </div>

              {/* Email Address */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Personal or College Email Address
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="student.name@college.edu or personal email"
                    required
                    className="w-full px-4 py-3 bg-slate-900/60 border border-slate-700 rounded-2xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <Mail className="absolute right-3.5 top-3.5 h-4 w-4 text-slate-500 pointer-events-none" />
                </div>
              </div>

              {/* Phone Number (Optional) */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Contact Mobile Number <span className="text-slate-500 font-normal lowercase">(optional)</span>
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="e.g. 9876543210"
                    className="w-full px-4 py-3 bg-slate-900/60 border border-slate-700 rounded-2xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <Phone className="absolute right-3.5 top-3.5 h-4 w-4 text-slate-500 pointer-events-none" />
                </div>
              </div>

              {/* Initial Temporary Password */}
              <div className="p-3.5 bg-slate-900/80 border border-slate-700/80 rounded-2xl space-y-3">
                <div className="flex items-start space-x-2">
                  <ShieldCheck className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-slate-300 leading-snug">
                    <strong>Initial Onboarding Password:</strong> The college standard initial onboarding credential is pre-filled as <code className="text-amber-400 font-mono">dmi@1202</code>. You will establish your private permanent password immediately upon your first sign in.
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Initial Password
                    </label>
                    <PasswordInput
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="dmi@1202"
                      required
                      className="bg-slate-800 border-slate-700 text-white text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Confirm Initial Password
                    </label>
                    <PasswordInput
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="dmi@1202"
                      required
                      className="bg-slate-800 border-slate-700 text-white text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 px-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm shadow-lg shadow-blue-600/30 flex items-center justify-center space-x-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Registering with Supabase...</span>
                  </>
                ) : (
                  <>
                    <span>Create Student Account</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>

              {/* Back to Login */}
              <div className="text-center pt-2">
                <p className="text-xs text-slate-400">
                  Already registered?{' '}
                  <Link to="/login" className="text-blue-400 hover:text-blue-300 font-semibold transition-colors">
                    Back to Student Login
                  </Link>
                </p>
              </div>
            </form>
          )}

        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 text-center text-[11px] text-slate-400 py-2">
        DMI College of Engineering • Supabase PostgreSQL Authentication
      </footer>
    </div>
  );
};

export default StudentRegister;

