import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Clock, 
  ShieldCheck, 
  CheckCircle, 
  RefreshCw, 
  LogOut, 
  Building2, 
  User, 
  GraduationCap, 
  AlertCircle 
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';

const StudentPendingApproval = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [checking, setChecking] = useState(false);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    setChecking(true);
    try {
      const res = await axios.get('/api/student/profile');
      if (res.data?.profile) {
        setProfile(res.data.profile);
        if (res.data.profile.status === 'ACTIVE') {
          navigate('/student/dashboard', { replace: true });
        }
      }
    } catch (_) {}
    finally {
      setChecking(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between items-center px-4 py-10 font-sans">
      {/* Brand Header */}
      <header className="flex items-center space-x-2 text-xs font-semibold text-slate-400 uppercase tracking-widest">
        <Building2 className="h-4 w-4 text-amber-400" />
        <span>DMI College of Engineering • Registration Status</span>
      </header>

      {/* Main Status Card */}
      <main className="w-full max-w-lg my-auto">
        <div className="bg-slate-800/90 border border-slate-700/80 rounded-3xl p-8 shadow-2xl shadow-black/50 text-center">

          {/* Icon */}
          <div className="inline-flex p-4 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-3xl mb-5 animate-pulse">
            <Clock className="h-10 w-10" />
          </div>

          <h1 className="text-2xl font-extrabold text-white mb-2">
            Registration Submitted for Approval
          </h1>
          <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed mb-6">
            Your student profile has been recorded in Supabase PostgreSQL. An administrator or hostel warden will review your application and allocate your hostel room shortly.
          </p>

          {/* Student Identity Card */}
          <div className="p-4 bg-slate-900/80 border border-slate-700/80 rounded-2xl text-left space-y-2 mb-6">
            <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-800">
              <span className="text-slate-400">Assigned Student ID:</span>
              <span className="font-mono font-bold text-amber-400 text-sm">{profile?.studentCode || '001'}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400">Full Name:</span>
              <span className="font-medium text-slate-200">{profile?.studentName || user?.name}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400">Department:</span>
              <span className="font-medium text-slate-200">{profile?.department || 'CSE'}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400">Account Status:</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 border border-amber-800 text-amber-300">
                PENDING APPROVAL
              </span>
            </div>
          </div>

          {/* What happens next */}
          <div className="p-3.5 bg-blue-950/40 border border-blue-800/50 rounded-2xl text-left text-xs text-blue-200 mb-6 space-y-1">
            <p className="font-semibold text-blue-300">Upon Administrator Approval:</p>
            <ul className="list-disc list-inside space-y-0.5 text-slate-300 text-[11px]">
              <li>Hostel Block and Room Number will be assigned</li>
              <li>Student Dashboard will unlock automatically</li>
              <li>Gate pass applications and attendance tracking will be activated</li>
            </ul>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <button
              onClick={fetchStatus}
              disabled={checking}
              className="w-full sm:flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl flex items-center justify-center space-x-1.5 transition-all disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} />
              <span>Check Approval Status</span>
            </button>
            <button
              onClick={handleLogout}
              className="w-full sm:w-auto py-3 px-4 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white font-semibold text-xs rounded-xl flex items-center justify-center space-x-1.5 transition-all"
            >
              <LogOut className="h-4 w-4" />
              <span>Log Out</span>
            </button>
          </div>

        </div>
      </main>

      <footer className="text-center text-[11px] text-slate-400">
        DMI College of Engineering • Secure College Hostel System
      </footer>
    </div>
  );
};

export default StudentPendingApproval;

