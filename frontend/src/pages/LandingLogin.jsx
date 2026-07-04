import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, GraduationCap, ArrowRight } from 'lucide-react';
import axios from 'axios';

// The landing page — two large portal cards
const LandingLogin = () => {
  const navigate = useNavigate();
  const [serverState, setServerState] = useState('checking'); // 'checking' | 'sleeping' | 'connected'

  useEffect(() => {
    const checkServer = async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        setServerState('sleeping');
      }, 1500); // Alert user if server takes more than 1.5s (likely cold starting)

      try {
        await axios.get('/', { signal: controller.signal });
        setServerState('connected');
      } catch (err) {
        if (err.response) {
          setServerState('connected');
        } else {
          setServerState('sleeping');
        }
      } finally {
        clearTimeout(timeoutId);
      }
    };

    checkServer();
  }, []);

  return (
    <div className="min-h-screen flex flex-col relative" style={{
      background: 'linear-gradient(135deg, #1e3a5f 0%, #2d6a9f 50%, #1a5276 100%)'
    }}>
      {/* Server Status Pill */}
      <div className="fixed top-4 right-4 z-50">
        {serverState === 'checking' && (
          <div className="bg-white/10 backdrop-blur text-blue-200 text-xs font-semibold px-3 py-1.5 rounded-full flex items-center space-x-1.5 shadow-md">
            <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
            <span>Connecting...</span>
          </div>
        )}
        {serverState === 'sleeping' && (
          <div className="bg-amber-500/20 backdrop-blur text-amber-200 border border-amber-500/30 text-xs font-semibold px-3 py-1.5 rounded-full flex items-center space-x-1.5 shadow-md">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span>Waking up server (1 min)...</span>
          </div>
        )}
        {serverState === 'connected' && (
          <div className="bg-emerald-500/20 backdrop-blur text-emerald-200 border border-emerald-500/30 text-xs font-semibold px-3 py-1.5 rounded-full flex items-center space-x-1.5 shadow-md">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Connected</span>
          </div>
        )}
      </div>
      {/* Header */}
      <div className="text-center pt-14 pb-8 px-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 backdrop-blur mb-4">
          <ShieldCheck className="h-9 w-9 text-white" />
        </div>
        <h1 className="text-4xl font-extrabold text-white tracking-tight">Secure Hostel</h1>
        <p className="text-blue-200 mt-2 text-sm">Management System — Choose your portal to continue</p>
      </div>

      {/* Two Portal Cards */}
      <div className="flex-1 flex items-start justify-center px-6 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">

          {/* Student Portal */}
          <button
            onClick={() => navigate('/login')}
            className="group relative bg-white rounded-3xl p-8 shadow-2xl text-left hover:scale-105 transition-transform duration-300 overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-40 h-40 bg-blue-50 rounded-full -translate-y-10 translate-x-10" />
            <div className="relative">
              <div className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center mb-5">
                <GraduationCap className="h-8 w-8 text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Student Portal</h2>
              <p className="text-gray-500 text-sm leading-relaxed mb-6">
                Apply for local and home outpasses, track your approval status, and view your digital gate pass QR code.
              </p>
              <div className="flex flex-wrap gap-2 mb-6">
                {['Apply Outpass', 'Track Status', 'QR Gate Pass'].map(tag => (
                  <span key={tag} className="text-xs bg-blue-50 text-blue-600 font-medium px-3 py-1 rounded-full">{tag}</span>
                ))}
              </div>
              <div className="flex items-center text-blue-600 font-semibold text-sm group-hover:gap-3 gap-2 transition-all">
                <span>Enter Student Portal</span>
                <ArrowRight className="h-4 w-4" />
              </div>
            </div>
          </button>

          {/* Admin Portal */}
          <button
            onClick={() => navigate('/admin/login')}
            className="group relative rounded-3xl p-8 shadow-2xl text-left hover:scale-105 transition-transform duration-300 overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #1e3a5f, #2d6a9f)' }}
          >
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-10 translate-x-10" />
            <div className="relative">
              <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center mb-5">
                <ShieldCheck className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Admin Portal</h2>
              <p className="text-blue-200 text-sm leading-relaxed mb-6">
                Approve outpass requests, monitor live hostel occupancy, scan QR codes at the gate, and manage student records.
              </p>
              <div className="flex flex-wrap gap-2 mb-6">
                {['Staff / Tutor', 'HOD', 'Warden', 'Security'].map(tag => (
                  <span key={tag} className="text-xs bg-white/10 text-blue-100 font-medium px-3 py-1 rounded-full">{tag}</span>
                ))}
              </div>
              <div className="flex items-center text-blue-200 font-semibold text-sm group-hover:gap-3 gap-2 transition-all">
                <span>Enter Admin Portal</span>
                <ArrowRight className="h-4 w-4" />
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Footer */}
      <p className="text-center text-blue-300/60 text-xs pb-6">
        Secure Hostel Management System · Protected by Firebase & JWT Authentication
      </p>
    </div>
  );
};

export default LandingLogin;
