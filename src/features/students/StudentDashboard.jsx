import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Layout from '../../shared/components/Layout';
import { useAuth } from '../auth/AuthContext';
import { 
  FileText, 
  User, 
  Home, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  ArrowRight, 
  Sparkles,
  QrCode,
  ShieldCheck,
  Lock,
  Unlock,
  Calendar,
  HelpCircle,
  ChevronRight,
  GraduationCap,
  Loader2,
  MapPin
} from 'lucide-react';
import { format } from 'date-fns';

const StudentDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [recentPasses, setRecentPasses] = useState([]);
  const [activePassStatus, setActivePassStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Verify dashboard status
      await axios.get('/api/student/dashboard').catch(err => {
        if (err.response?.data?.code === 'MUST_CHANGE_PASSWORD') {
          navigate('/student/change-password', { replace: true });
        } else if (err.response?.data?.code === 'PENDING_PROFILE_COMPLETION') {
          navigate('/student/complete-profile', { replace: true });
        } else if (err.response?.data?.code === 'PENDING_APPROVAL') {
          navigate('/student/pending-approval', { replace: true });
        }
        return { data: null };
      });

      // 2. Fetch student profile, gate passes & active scanner status
      const [profileRes, passesRes, scannerRes] = await Promise.all([
        axios.get('/api/student/profile').catch(() => ({ data: { profile: null } })),
        axios.get('/api/gate-passes/my').catch(() => ({ data: { requests: [] } })),
        axios.get('/api/gate-passes/scanner-status').catch(() => ({ data: null }))
      ]);

      if (profileRes.data?.profile) {
        setProfile(profileRes.data.profile);
      }
      
      if (passesRes.data?.success && Array.isArray(passesRes.data.requests)) {
        setRecentPasses(passesRes.data.requests.slice(0, 3));
      } else if (Array.isArray(passesRes.data)) {
        setRecentPasses(passesRes.data.slice(0, 3));
      }

      if (scannerRes.data) {
        setActivePassStatus(scannerRes.data);
      }
    } catch (_) {}
    finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="max-w-5xl mx-auto py-24 flex flex-col items-center justify-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-xs font-semibold text-slate-500">Loading your resident dashboard...</p>
        </div>
      </Layout>
    );
  }

  const studentName = profile?.studentName || user?.name || 'Student';
  const studentId = profile?.studentCode || 'Pending';
  const dept = profile?.department && profile.department !== 'General' ? profile.department : (user?.department || '—');
  const hostelName = profile?.hostelName || 'Pending Allocation';
  const roomNumber = profile?.roomNumber || 'Pending Allocation';
  const isAllocated = hostelName !== 'Pending Allocation';

  const isScannerLocked = activePassStatus?.isLocked ?? true;
  const currentStatus = (activePassStatus?.status || 'NO_PASS').toUpperCase();

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-6 pb-12">
        
        {/* ── Welcome Banner ────────────────────────────────────────────── */}
        <div className="relative overflow-hidden bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-indigo-500/15">
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center space-x-4">
              {/* Profile Photo */}
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/10 border-2 border-white/20 overflow-hidden flex items-center justify-center flex-shrink-0">
                {profile?.profilePhotoUrl ? (
                  <img src={profile.profilePhotoUrl} alt={studentName} className="w-full h-full object-cover" />
                ) : (
                  <User className="h-10 w-10 text-blue-200" />
                )}
              </div>

              <div className="space-y-1">
                <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 bg-white/15 backdrop-blur-xs rounded-full text-[11px] font-semibold text-blue-100">
                  <Sparkles className="h-3 w-3 text-amber-300" />
                  <span>DMI College Hostel Resident</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
                  Welcome, {studentName}
                </h1>
                <p className="text-xs text-blue-200">
                  Student ID: <span className="font-mono font-bold text-white bg-blue-900/60 px-1.5 py-0.5 rounded-md">{studentId}</span> • {dept}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <Link
                to="/student/passes"
                className="py-2.5 px-4 bg-white hover:bg-blue-50 text-blue-900 text-xs font-bold rounded-2xl shadow-md flex items-center justify-center space-x-2 transition-all hover:scale-[1.02]"
              >
                <QrCode className="h-4 w-4 text-blue-700" />
                <span>Gate Pass & QR Scanner</span>
              </Link>
              <Link
                to="/student/profile"
                className="py-2.5 px-4 bg-white/15 hover:bg-white/25 text-white text-xs font-semibold rounded-2xl border border-white/20 flex items-center justify-center space-x-1.5 transition-all"
              >
                <span>View My Profile</span>
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* ── Active Gate Pass Status Alert Banner ──────────────────────── */}
        {currentStatus === 'PENDING' && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-3xl flex items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-amber-100 text-amber-700 rounded-2xl">
                <Lock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-amber-900">Gate Pass Waiting for Admin Approval</p>
                <p className="text-[11px] text-amber-700">QR scanner is locked until an administrator reviews and approves your pass.</p>
              </div>
            </div>
            <Link
              to="/student/passes"
              className="text-xs font-bold text-amber-800 bg-amber-200/80 hover:bg-amber-300 px-3 py-1.5 rounded-xl transition flex-shrink-0"
            >
              View Status
            </Link>
          </div>
        )}

        {currentStatus === 'APPROVED' && (
          <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-3xl flex items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-2xl">
                <Unlock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-emerald-900">Gate Pass Approved! Ready to Exit</p>
                <p className="text-[11px] text-emerald-700">Scan the permanent QR code at the main college gate to record your exit.</p>
              </div>
            </div>
            <Link
              to="/student/passes"
              className="text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-3.5 py-1.5 rounded-xl shadow transition flex-shrink-0"
            >
              Open Scanner
            </Link>
          </div>
        )}

        {currentStatus === 'EXITED' && (
          <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-3xl flex items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-indigo-100 text-indigo-700 rounded-2xl">
                <QrCode className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-indigo-900">Currently On Leave (Exit Recorded)</p>
                <p className="text-[11px] text-indigo-700">Remember to scan the college gate QR code when you return to campus.</p>
              </div>
            </div>
            <Link
              to="/student/passes"
              className="text-xs font-bold text-indigo-800 bg-indigo-200 hover:bg-indigo-300 px-3 py-1.5 rounded-xl transition flex-shrink-0"
            >
              Scan Return
            </Link>
          </div>
        )}

        {/* ── Key Cards Grid ────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Hostel Room Allocation Card */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Hostel Allocation</span>
              <Home className={`h-4 w-4 ${isAllocated ? 'text-emerald-500' : 'text-amber-500'}`} />
            </div>
            <div>
              <p className="text-lg font-bold text-slate-800">{hostelName}</p>
              <p className="text-xs text-slate-500">
                {isAllocated ? `Room Number: ${roomNumber}` : 'Room allocation pending warden assignment'}
              </p>
            </div>
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-400">Status</span>
              <span className={`font-semibold px-2 py-0.5 rounded-full text-[10px] ${
                isAllocated ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
              }`}>
                {isAllocated ? 'Allocated' : 'Pending Warden Review'}
              </span>
            </div>
          </div>

          {/* Academic Info Card */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Academic Standing</span>
              <GraduationCap className="h-4 w-4 text-indigo-500" />
            </div>
            <div>
              <p className="text-lg font-bold text-slate-800">{dept}</p>
              <p className="text-xs text-slate-500">
                {profile?.yearOfStudy ? `Year ${profile.yearOfStudy} • ` : ''}{profile?.academicYear ? `Batch ${profile.academicYear}` : 'Batch —'}
              </p>
            </div>
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-400">University Reg No</span>
              <span className="font-mono font-medium text-slate-700">{profile?.registerNumber || 'Pending'}</span>
            </div>
          </div>

          {/* Account Status Card */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Portal Security</span>
              <ShieldCheck className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <p className="text-lg font-bold text-slate-800">Verified & Active</p>
              <p className="text-xs text-slate-500">Hostel Portal Session Active</p>
            </div>
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-400">Profile Completion</span>
              <span className="font-bold text-blue-600">{profile?.profileCompletion ?? 100}%</span>
            </div>
          </div>
        </div>

        {/* ── Recent Passes & Support Box ───────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-slate-800">Recent Gate Passes</h2>
              <Link to="/student/passes" className="text-xs font-semibold text-blue-600 hover:text-blue-800">
                View All & Scanner
              </Link>
            </div>

            {recentPasses.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
                <FileText className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-medium text-slate-600">No gate passes recorded yet</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Need to step out? Apply for a gate pass with destination and timings.</p>
                <Link
                  to="/student/passes"
                  className="mt-3 inline-flex items-center space-x-1.5 py-1.5 px-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl"
                >
                  <span>Apply Now</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {recentPasses.map(pass => (
                  <div key={pass.id || pass.ID} className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-800">{pass.reason || pass.Reason || 'Campus Exit'}</p>
                      <p className="text-[11px] text-slate-500">
                        Pass #{pass.id || pass.ID} • To: {pass.destination || pass.Destination || 'Official'}
                      </p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      (pass.status || pass.Status) === 'APPROVED' || (pass.status || pass.Status) === 'Approved' ? 'bg-emerald-100 text-emerald-800' :
                      (pass.status || pass.Status) === 'PENDING' || (pass.status || pass.Status) === 'Pending' ? 'bg-amber-100 text-amber-800' :
                      (pass.status || pass.Status) === 'EXITED' ? 'bg-indigo-100 text-indigo-800' :
                      'bg-slate-200 text-slate-700'
                    }`}>
                      {pass.status || pass.Status || 'Active'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Student Support Box */}
          <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-3xl p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold flex items-center space-x-2">
              <HelpCircle className="h-4 w-4 text-blue-400" />
              <span>Hostel Assistance</span>
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              If your room allocation requires changing or if you experience maintenance issues, please contact your block warden.
            </p>
            <div className="p-3 bg-white/5 border border-white/10 rounded-2xl space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Chief Warden:</span>
                <span className="font-semibold text-slate-200">warden@hostel.edu</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Security Gate:</span>
                <span className="font-semibold text-slate-200">GATE_DMI_MAIN_01</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </Layout>
  );
};

export default StudentDashboard;
