import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { firebaseAuth } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { ShieldCheck, Mail, Lock, AlertCircle, ArrowLeft, Eye, EyeOff } from 'lucide-react';

const AdminLogin = () => {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd]   = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const { login } = useAuth();
  const navigate  = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Step 1: Authenticate with Firebase
      const credential = await signInWithEmailAndPassword(firebaseAuth, email, password);
      const idToken    = await credential.user.getIdToken();

      // Step 2: Send Firebase ID token to our backend → get our own JWT + user info
      const res = await axios.post('/api/auth/admin-login', { idToken });
      login(res.data.user, res.data.token);
      navigate('/dashboard');
    } catch (err) {
      const code = err?.code;
      if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setError('Invalid email or password. Please check your credentials.');
      } else if (code === 'auth/too-many-requests') {
        setError('Too many failed attempts. Account temporarily locked. Try again later.');
      } else if (err.response?.status === 403) {
        setError(err.response.data?.message || 'Access denied. This account is not an admin.');
      } else {
        setError(err.response?.data?.message || 'Sign-in failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #2d6a9f 100%)' }}>
      {/* Left Branding Panel */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-12 text-white">
        <div>
          <Link to="/" className="flex items-center text-blue-200 hover:text-white text-sm mb-12">
            <ArrowLeft className="h-4 w-4 mr-1" />Back to portal selection
          </Link>
          <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center mb-6">
            <ShieldCheck className="h-9 w-9 text-white" />
          </div>
          <h1 className="text-4xl font-extrabold mb-4 leading-tight">Admin Portal<br />Secure Hostel</h1>
          <p className="text-blue-200 text-base leading-relaxed">
            Restricted access for college administrators. Your account is managed by your institution's Super Admin.
          </p>
        </div>

        <div className="space-y-3">
          {[
            { role: '🏫 HOD', desc: 'Department-level outpass approvals' },
            { role: '👤 Staff Tutor', desc: 'Initial Home Outpass review' },
            { role: '🔐 Warden', desc: 'Final approval & QR generation' },
            { role: '🛡️ Security', desc: 'Gate QR scanning & logs' },
          ].map(item => (
            <div key={item.role} className="flex items-center bg-white/10 rounded-xl px-4 py-3">
              <span className="font-semibold text-sm w-32">{item.role}</span>
              <span className="text-blue-200 text-xs">{item.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right Login Form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8">
          {/* Mobile back link */}
          <Link to="/" className="lg:hidden flex items-center text-gray-400 hover:text-gray-600 text-sm mb-6">
            <ArrowLeft className="h-4 w-4 mr-1" />Back
          </Link>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900">Admin Sign in</h2>
            <p className="text-sm text-gray-500 mt-1">
              Use your institution-issued email address to sign in.
            </p>
          </div>

          {error && (
            <div className="mb-5 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-start">
              <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Admin Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                <input type="email" required
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="john.staff@dmice.edu"
                  value={email} onChange={e => setEmail(e.target.value)} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                <input type={showPwd ? 'text' : 'password'} required
                  className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="••••••••"
                  value={password} onChange={e => setPassword(e.target.value)} />
                <button type="button" onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
                  {showPwd ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end">
              <Link to="/forgot-password?type=admin" className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors">
                Forgot password?
              </Link>
            </div>

            <button type="submit" disabled={loading}
              className={`w-full py-3 px-4 rounded-xl text-white font-semibold text-sm transition-all ${
                loading ? 'opacity-60 cursor-not-allowed' : 'hover:opacity-90'
              }`}
              style={{ background: 'linear-gradient(135deg, #1e3a5f, #2d6a9f)' }}>
              {loading ? 'Authenticating...' : 'Sign in to Admin Portal'}
            </button>
          </form>

          <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <p className="text-xs text-amber-700 font-medium">🔒 Don't have an account?</p>
            <p className="text-xs text-amber-600 mt-1">
              Admin accounts are created by your institution's Super Admin. Contact your college management office.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
