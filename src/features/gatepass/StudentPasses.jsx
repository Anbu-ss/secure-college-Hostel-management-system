import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Layout from '../../shared/components/Layout';
import { 
  FileText, 
  Lock, 
  Unlock, 
  Camera, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Clock, 
  Plus, 
  RefreshCw, 
  MapPin, 
  Send, 
  X, 
  ShieldCheck, 
  LogOut,
  LogIn,
  Info
} from 'lucide-react';
import { format } from 'date-fns';

const StudentPasses = () => {
  const [requests, setRequests] = useState([]);
  const [scannerStatus, setScannerStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [CameraScannerComp, setCameraScannerComp] = useState(null);

  // Application Modal state
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [applyForm, setApplyForm] = useState({
    reasonCategory: 'Academic Work',
    customReason: '',
    destination: '',
    departureDate: '',
    departureTime: '',
    returnDate: '',
    returnTime: '',
    additionalDescription: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // EPHEMERAL TOAST NOTIFICATIONS (NEVER PERSISTED TO SUPABASE OR BROWSER STORAGE)
  const [toast, setToast] = useState(null); // { title, message, type: 'success' | 'info' | 'error' }
  const toastTimeoutRef = useRef(null);
  const prevStatusRef = useRef(null);
  const pollTimerRef = useRef(null);

  const showToast = (title, message, type = 'success') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ title, message, type });
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, 7000);
  };

  useEffect(() => {
    fetchData();

    // Setup polling every 5 seconds for status updates without DB notification persistence
    pollTimerRef.current = setInterval(() => {
      pollScannerStatus();
    }, 5000);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      await Promise.all([fetchRequests(), pollScannerStatus()]);
    } finally {
      setLoading(false);
    }
  };

  const fetchRequests = async () => {
    try {
      const res = await axios.get('/api/gate-passes/my');
      if (res.data?.success && Array.isArray(res.data.requests)) {
        setRequests(res.data.requests);
      }
    } catch (err) {
      console.warn('Failed to fetch gate passes:', err.message);
    }
  };

  const pollScannerStatus = async () => {
    try {
      const res = await axios.get('/api/gate-passes/scanner-status');
      if (res.data) {
        const currentStatus = res.data.status;
        const previousStatus = prevStatusRef.current;

        // SPEC REQUIREMENT: When Admin approves, trigger approval toast in active session
        if (previousStatus === 'PENDING' && currentStatus === 'APPROVED') {
          showToast(
            'Gate Pass Approved!',
            'Your Gate Pass is Approved! Your request has been approved by the Admin. You can now scan the QR code at the college gate.',
            'success'
          );
        }

        prevStatusRef.current = currentStatus;
        setScannerStatus(res.data);
      }
    } catch (err) {
      console.warn('Failed to poll scanner status:', err.message);
    }
  };

  const handleOpenScanner = async () => {
    if (scannerStatus?.isLocked) {
      showToast('Scanner Locked', 'Your gate pass is still waiting for Administrator approval.', 'error');
      return;
    }

    try {
      const { Scanner } = await import('@yudiel/react-qr-scanner');
      setCameraScannerComp(() => Scanner);
      setCameraActive(true);
    } catch {
      showToast('Camera Notice', 'Could not access device camera. You can confirm scan using the button below.', 'info');
    }
  };

  const handleCloseScanner = () => {
    setCameraActive(false);
  };

  const processGateScan = async (scannedCode) => {
    const code = scannedCode || scannerStatus?.gateIdentifier || 'GATE_DMI_MAIN_01';
    setScanning(true);
    setCameraActive(false);

    try {
      const res = await axios.post('/api/gate-passes/scan-gate-qr', {
        gateIdentifier: code
      });

      if (res.data?.success) {
        // SPEC REQUIREMENT: Toast on successful scan
        showToast(
          res.data.title || 'Gate Pass Scan Successful!',
          res.data.message || 'Your Gate Pass is Successfully Verified! Your exit has been recorded.',
          'success'
        );
        await fetchData();
      } else {
        showToast('Scan Error', res.data?.message || 'Failed to record gate transaction.', 'error');
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Scan could not be processed. Ensure you have an active approved pass.';
      showToast('Scan Failed', msg, 'error');
    } finally {
      setScanning(false);
    }
  };

  const handleApplySubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    const reason = applyForm.reasonCategory === 'Other' 
      ? applyForm.customReason 
      : `${applyForm.reasonCategory}${applyForm.customReason ? ' - ' + applyForm.customReason : ''}`;

    if (!reason.trim()) {
      setFormError('Please specify the reason for leaving.');
      return;
    }

    if (!applyForm.destination.trim()) {
      setFormError('Please specify your destination.');
      return;
    }

    if (!applyForm.departureDate || !applyForm.departureTime || !applyForm.returnDate || !applyForm.returnTime) {
      setFormError('Departure and return dates and times are required.');
      return;
    }

    const departure = new Date(`${applyForm.departureDate}T${applyForm.departureTime}`);
    const expectedReturn = new Date(`${applyForm.returnDate}T${applyForm.returnTime}`);

    if (expectedReturn <= departure) {
      setFormError('Expected return time must be strictly after departure time.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        reason: reason.trim(),
        destination: applyForm.destination.trim(),
        departureDate: applyForm.departureDate,
        departureTime: applyForm.departureTime,
        returnDate: applyForm.returnDate,
        returnTime: applyForm.returnTime,
        additionalDescription: applyForm.additionalDescription.trim() || undefined
      };

      const res = await axios.post('/api/gate-passes', payload);
      if (res.data?.success) {
        setShowApplyModal(false);
        setApplyForm({
          reasonCategory: 'Academic Work',
          customReason: '',
          destination: '',
          departureDate: '',
          departureTime: '',
          returnDate: '',
          returnTime: '',
          additionalDescription: ''
        });
        showToast('Request Submitted', 'Your Gate Pass request has been submitted for Admin approval.', 'info');
        await fetchData();
      }
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to submit gate pass request.');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    const s = (status || '').toUpperCase();
    switch (s) {
      case 'APPROVED':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">APPROVED</span>;
      case 'PENDING':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">PENDING APPROVAL</span>;
      case 'EXITED':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">EXITED (CAMPUS OUT)</span>;
      case 'RETURNED':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">RETURNED</span>;
      case 'REJECTED':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">REJECTED</span>;
      case 'EXPIRED':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">EXPIRED</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-700">{s}</span>;
    }
  };

  const isLocked = scannerStatus?.isLocked ?? true;
  const currentStatus = (scannerStatus?.status || 'NO_PASS').toUpperCase();

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-6 pb-12">
        
        {/* ── EPHEMERAL TOAST NOTIFICATION CONTAINER (ZERO DB PERSISTENCE) ── */}
        {toast && (
          <div className="fixed top-5 right-5 z-50 max-w-md w-full">
            <div className={`p-4 rounded-2xl shadow-2xl border flex items-start space-x-3 text-sm ${
              toast.type === 'success' 
                ? 'bg-emerald-900/95 text-white border-emerald-500 shadow-emerald-900/30' 
                : toast.type === 'error'
                ? 'bg-rose-900/95 text-white border-rose-500 shadow-rose-900/30'
                : 'bg-slate-900/95 text-white border-indigo-500 shadow-indigo-900/30'
            }`}>
              {toast.type === 'success' ? (
                <CheckCircle className="h-6 w-6 text-emerald-400 flex-shrink-0 mt-0.5" />
              ) : toast.type === 'error' ? (
                <XCircle className="h-6 w-6 text-rose-400 flex-shrink-0 mt-0.5" />
              ) : (
                <Info className="h-6 w-6 text-indigo-400 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1 space-y-1">
                <p className="font-extrabold text-white tracking-wide">{toast.title}</p>
                <p className="text-xs text-slate-200 leading-relaxed">{toast.message}</p>
              </div>
              <button 
                onClick={() => setToast(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── Top Header ────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div>
            <div className="flex items-center space-x-2">
              <span className="p-2 bg-blue-50 text-blue-700 rounded-xl">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900">
                Gate Pass Management
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Apply for exit permission, monitor real-time approval status, and scan the college gate QR code.
            </p>
          </div>

          <button
            onClick={() => {
              setFormError('');
              setShowApplyModal(true);
            }}
            disabled={currentStatus === 'PENDING' || currentStatus === 'APPROVED' || currentStatus === 'EXITED'}
            className={`inline-flex items-center justify-center space-x-2 px-5 py-3 rounded-2xl text-xs font-bold transition-all shadow-md ${
              currentStatus === 'PENDING' || currentStatus === 'APPROVED' || currentStatus === 'EXITED'
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20 hover:scale-[1.02]'
            }`}
          >
            <Plus className="h-4 w-4" />
            <span>Apply New Gate Pass</span>
          </button>
        </div>

        {/* ── SECTION 4 & 5: DYNAMIC QR SCANNER CARD (LOCKED vs UNLOCKED) ── */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 sm:p-8">
            
            {/* Case A: LOCKED STATE – Waiting for Admin approval */}
            {isLocked ? (
              <div className="flex flex-col items-center text-center max-w-lg mx-auto py-6 space-y-4">
                <div className="relative">
                  <div className="w-20 h-20 bg-amber-50 rounded-3xl border-2 border-amber-200 flex items-center justify-center text-amber-600 shadow-inner">
                    <Lock className="h-10 w-10 animate-pulse" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-amber-500 border-2 border-white rounded-full flex items-center justify-center">
                    <Clock className="h-3.5 w-3.5 text-white" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
                    SCANNER LOCKED
                  </span>
                  <h2 className="text-lg sm:text-xl font-black text-slate-900">
                    {scannerStatus?.message || "Your Gate Pass is waiting for Admin approval."}
                  </h2>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Under institution safety protocols, camera access and scanning remain completely locked until an authorized administrator approves your gate pass.
                  </p>
                </div>

                {currentStatus === 'PENDING' && (
                  <div className="w-full bg-slate-50 p-4 rounded-2xl border border-slate-200 text-left text-xs space-y-2">
                    <div className="flex items-center justify-between text-slate-600 font-semibold border-b border-slate-200/80 pb-2">
                      <span>Application Status</span>
                      <span className="text-amber-600 font-bold flex items-center space-x-1">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping mr-1" />
                        Pending Admin Review
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Pass Reference:</span>
                      <span className="font-mono font-bold text-slate-800">#{scannerStatus?.passId || 'Active'}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 italic text-center pt-1">
                      This page monitors approval in real-time. The scanner unlocks automatically upon approval.
                    </p>
                  </div>
                )}

                {currentStatus === 'NO_PASS' && (
                  <p className="text-xs text-slate-500">
                    No active gate pass found. Click <strong>"Apply New Gate Pass"</strong> above to submit a pass.
                  </p>
                )}
              </div>
            ) : (
              /* Case B: UNLOCKED STATE – Admin Approved or Exited */
              <div className="flex flex-col items-center text-center max-w-xl mx-auto py-4 space-y-5">
                <div className="relative">
                  <div className="w-20 h-20 bg-emerald-50 rounded-3xl border-2 border-emerald-300 flex items-center justify-center text-emerald-600 shadow-emerald-500/10 shadow-lg">
                    <Unlock className="h-10 w-10" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 border-2 border-white rounded-full flex items-center justify-center">
                    <CheckCircle className="h-3.5 w-3.5 text-white" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-900 border border-emerald-300">
                    SCANNER UNLOCKED • {currentStatus === 'APPROVED' ? 'READY TO EXIT' : 'READY TO RETURN'}
                  </span>
                  <h2 className="text-xl font-black text-slate-900">
                    {scannerStatus?.message || "Scan Permanent College Gate QR Code"}
                  </h2>
                  <p className="text-xs text-slate-600">
                    Physical Permanent Gate: <span className="font-semibold text-slate-800">DMI College Main Security Gate ({scannerStatus?.gateIdentifier || 'GATE_DMI_MAIN_01'})</span>
                  </p>
                </div>

                {/* Camera Scanner Viewport when active */}
                {cameraActive && (
                  <div className="w-full max-w-sm rounded-3xl overflow-hidden border-4 border-emerald-500 shadow-2xl relative bg-black">
                    <div className="p-3 bg-emerald-600 text-white text-xs font-bold flex items-center justify-between">
                      <span>Point camera at Gate QR Code</span>
                      <button 
                        onClick={handleCloseScanner}
                        className="text-white hover:bg-emerald-700 p-1 rounded-lg"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="h-64 flex items-center justify-center bg-black text-white text-xs">
                      {CameraScannerComp ? (
                        <CameraScannerComp
                          onScan={(result) => {
                            if (result?.[0]?.rawValue) {
                              processGateScan(result[0].rawValue);
                            }
                          }}
                          onError={(error) => {
                            console.warn('QR error:', error);
                          }}
                        />
                      ) : (
                        <span>Initializing camera stream...</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Scan Action Controls */}
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full justify-center">
                  {!cameraActive && (
                    <button
                      onClick={handleOpenScanner}
                      disabled={scanning}
                      className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-bold shadow-lg shadow-emerald-600/20 transition-all hover:scale-[1.02]"
                    >
                      <Camera className="h-4 w-4" />
                      <span>Open Camera Scanner</span>
                    </button>
                  )}

                  {/* Immediate Permanent Gate Scan Confirmation */}
                  <button
                    onClick={() => processGateScan(scannerStatus?.gateIdentifier || 'GATE_DMI_MAIN_01')}
                    disabled={scanning}
                    className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-6 py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-xs font-bold transition-all shadow-md"
                  >
                    {currentStatus === 'APPROVED' ? (
                      <>
                        <LogOut className="h-4 w-4 text-emerald-400" />
                        <span>{scanning ? 'Verifying...' : 'Record Gate Exit Now'}</span>
                      </>
                    ) : (
                      <>
                        <LogIn className="h-4 w-4 text-blue-400" />
                        <span>{scanning ? 'Verifying...' : 'Record Gate Return Now'}</span>
                      </>
                    )}
                  </button>
                </div>

                <p className="text-[11px] text-slate-400">
                  There is ONLY ONE permanent physical QR code affixed at the security gate. No individual QR code needed.
                </p>
              </div>
            )}

          </div>
        </div>

        {/* ── GATE PASS APPLICATION MODAL (SECTION 2 REQUIREMENTS) ── */}
        {showApplyModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white rounded-3xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden animate-scale-up">
              
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Apply for Student Gate Pass</h2>
                  <p className="text-xs text-slate-500">Provide required departure and return details for admin approval.</p>
                </div>
                <button
                  onClick={() => setShowApplyModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleApplySubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                {formError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-semibold text-rose-700 flex items-center space-x-2">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Reason Category */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Reason for Leaving <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={applyForm.reasonCategory}
                    onChange={(e) => setApplyForm({ ...applyForm, reasonCategory: e.target.value })}
                    className="w-full text-xs p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Academic Work">Academic / Project / Library Visit</option>
                    <option value="Medical Emergency">Medical Consultation / Pharmacy</option>
                    <option value="Family / Personal">Family Visit / Home Stay</option>
                    <option value="Essential Supplies">Essential Supplies / Banking / Market</option>
                    <option value="Campus Placement">Placement Drive / Interview</option>
                    <option value="Other">Other Specific Reason</option>
                  </select>
                </div>

                {/* Specific Reason Notes */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Reason Details / Purpose <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Attending semester project review / Hospital appointment"
                    value={applyForm.customReason}
                    onChange={(e) => setApplyForm({ ...applyForm, customReason: e.target.value })}
                    className="w-full text-xs p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Destination */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Destination <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <MapPin className="h-4 w-4 text-slate-400 absolute left-3 top-3.5" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Apollo Hospital, Chennai / Central Library"
                      value={applyForm.destination}
                      onChange={(e) => setApplyForm({ ...applyForm, destination: e.target.value })}
                      className="w-full text-xs pl-9 p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Departure Date & Time */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                      Departure Date <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={applyForm.departureDate}
                      onChange={(e) => setApplyForm({ ...applyForm, departureDate: e.target.value })}
                      className="w-full text-xs p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                      Departure Time <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="time"
                      required
                      value={applyForm.departureTime}
                      onChange={(e) => setApplyForm({ ...applyForm, departureTime: e.target.value })}
                      className="w-full text-xs p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Return Date & Time */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                      Expected Return Date <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={applyForm.returnDate}
                      onChange={(e) => setApplyForm({ ...applyForm, returnDate: e.target.value })}
                      className="w-full text-xs p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                      Expected Return Time <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="time"
                      required
                      value={applyForm.returnTime}
                      onChange={(e) => setApplyForm({ ...applyForm, returnTime: e.target.value })}
                      className="w-full text-xs p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Optional Description */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Additional Description (Optional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Parent contact, transit mode, or relevant hostel notes..."
                    value={applyForm.additionalDescription}
                    onChange={(e) => setApplyForm({ ...applyForm, additionalDescription: e.target.value })}
                    className="w-full text-xs p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowApplyModal(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md flex items-center space-x-1.5"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>{submitting ? 'Submitting...' : 'Submit Request'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── GATE PASS HISTORY TABLE (SECTION 2 REQUIREMENTS) ── */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Gate Pass History</h2>
              <p className="text-xs text-slate-500">Official log of your past and active gate movements.</p>
            </div>
            <button
              onClick={fetchData}
              className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition"
              title="Refresh passes"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {requests.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <FileText className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-600">No gate passes recorded</p>
              <p className="text-[11px] text-slate-400 mt-0.5">When you submit an application, it will appear here with live status updates.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px] tracking-wider font-bold">
                    <th className="py-3 px-3">Pass Ref</th>
                    <th className="py-3 px-3">Reason & Destination</th>
                    <th className="py-3 px-3">Departure</th>
                    <th className="py-3 px-3">Expected Return</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Admin Notes / Scan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {requests.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-3 font-mono font-bold text-slate-800">
                        #{r.id}
                      </td>
                      <td className="py-3 px-3">
                        <p className="font-semibold text-slate-800">{r.reason}</p>
                        <p className="text-[11px] text-slate-500 flex items-center space-x-1 mt-0.5">
                          <MapPin className="h-3 w-3 text-slate-400" />
                          <span>{r.destination}</span>
                        </p>
                      </td>
                      <td className="py-3 px-3 text-slate-600">
                        {r.departureAt ? format(new Date(r.departureAt), 'dd MMM yyyy, hh:mm a') : '—'}
                      </td>
                      <td className="py-3 px-3 text-slate-600">
                        {r.expectedReturnAt ? format(new Date(r.expectedReturnAt), 'dd MMM yyyy, hh:mm a') : '—'}
                      </td>
                      <td className="py-3 px-3">
                        {getStatusBadge(r.status)}
                      </td>
                      <td className="py-3 px-3 text-[11px]">
                        {r.status === 'REJECTED' && r.rejectionReason && (
                          <span className="text-rose-600 font-medium">
                            Rejected: {r.rejectionReason}
                          </span>
                        )}
                        {r.approvedAt && (
                          <span className="text-emerald-700 font-medium block">
                            Approved at {format(new Date(r.approvedAt), 'hh:mm a')}
                          </span>
                        )}
                        {Array.isArray(r.transactions) && r.transactions.length > 0 && (
                          <div className="space-y-0.5 mt-1">
                            {r.transactions.map((tx, idx) => (
                              <span key={idx} className="block text-[10px] text-slate-500">
                                • {tx.type} recorded at {format(new Date(tx.scannedAt), 'hh:mm a')}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </Layout>
  );
};

export default StudentPasses;
