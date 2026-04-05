import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, GraduationCap, ArrowRight } from 'lucide-react';

// The landing page — two large portal cards
const LandingLogin = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col" style={{
      background: 'linear-gradient(135deg, #1e3a5f 0%, #2d6a9f 50%, #1a5276 100%)'
    }}>
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
