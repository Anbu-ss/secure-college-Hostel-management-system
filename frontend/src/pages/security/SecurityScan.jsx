import React, { useState } from 'react';
import axios from 'axios';
import Layout from '../../components/Layout';
import { ShieldCheck, LogOut, LogIn, AlertCircle, Search, Camera, Home, MapPin, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

const SCAN_COLORS = {
  green:  { bg: 'bg-green-50',  border: 'border-green-400', text: 'text-green-700',  icon: <CheckCircle className="h-6 w-6 text-green-500" /> },
  blue:   { bg: 'bg-blue-50',   border: 'border-blue-400',  text: 'text-blue-700',   icon: <CheckCircle className="h-6 w-6 text-blue-500" /> },
  red:    { bg: 'bg-red-50',    border: 'border-red-400',   text: 'text-red-700',    icon: <XCircle className="h-6 w-6 text-red-500" /> },
  orange: { bg: 'bg-orange-50', border: 'border-orange-400',text: 'text-orange-700', icon: <AlertTriangle className="h-6 w-6 text-orange-500" /> },
};

const SecurityScan = () => {
  const [scanMode, setScanMode] = useState('manual');
  const [manualInput, setManualInput] = useState('');
  const [qrHash, setQrHash] = useState('');
  const [verifyData, setVerifyData] = useState(null);
  const [scanFeedback, setScanFeedback] = useState(null); // { color, message, scanResult }
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [CameraScanner, setCameraScanner] = useState(null);

  const loadScanner = async () => {
    try {
      const { Scanner } = await import('@yudiel/react-qr-scanner');
      setCameraScanner(() => Scanner);
      setScanMode('camera');
    } catch {
      setScanFeedback({ color: 'red', message: 'Camera scanner could not load. Use manual input.' });
    }
  };

  const handleCameraScan = async (results) => {
    if (results?.[0]?.rawValue && results[0].rawValue !== qrHash) {
      await verifyQR(results[0].rawValue);
    }
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    await verifyQR(manualInput.trim());
  };

  const verifyQR = async (hash) => {
    setLoading(true);
    setVerifyData(null);
    setScanFeedback(null);
    setQrHash(hash);
    try {
      const res = await axios.get(`/api/security/verify/${encodeURIComponent(hash)}`);
      setVerifyData(res.data);
      if (!res.data.valid) {
        setScanFeedback({ color: res.data.color || 'red', message: res.data.message, scanResult: res.data.scanResult });
      }
    } catch (err) {
      const data = err.response?.data;
      setScanFeedback({
        color: data?.color || 'red',
        message: data?.message || 'Invalid or unregistered QR code.',
        scanResult: data?.scanResult || 'INVALID'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogAction = async (action) => {
    setActionLoading(true);
    setScanFeedback(null);
    try {
      const res = await axios.post('/api/security/scan', { qrHash, action });
      setScanFeedback({
        color: res.data.color || 'green',
        message: res.data.message,
        scanResult: res.data.scanResult,
        detail: res.data
      });
      setVerifyData(null);
      setTimeout(() => resetAll(), 4000);
    } catch (err) {
      const data = err.response?.data;
      setScanFeedback({ color: data?.color || 'red', message: data?.message || `Failed to log ${action}.`, scanResult: data?.scanResult });
    } finally {
      setActionLoading(false);
    }
  };

  const resetAll = () => {
    setQrHash('');
    setVerifyData(null);
    setScanFeedback(null);
    setManualInput('');
    setScanMode('manual');
    setCameraScanner(null);
  };

  const pass = verifyData?.pass;
  const passTypeStyle = pass?.passType === 'Local'
    ? { icon: <MapPin className="h-3 w-3" />, color: 'bg-blue-100 text-blue-700' }
    : { icon: <Home className="h-3 w-3" />, color: 'bg-purple-100 text-purple-700' };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
          <ShieldCheck className="mr-3 h-7 w-7 text-green-600" />
          Security Checkpoint
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Input Panel */}
          <div className="bg-white p-6 rounded-xl shadow-md">
            <h3 className="text-lg font-semibold mb-4 text-gray-700">Scan / Enter QR Code</h3>

            <div className="flex rounded-lg overflow-hidden border border-gray-200 mb-4">
              <button onClick={() => { setScanMode('manual'); setCameraScanner(null); }}
                className={`flex-1 flex items-center justify-center px-3 py-2 text-sm font-medium ${scanMode === 'manual' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                <Search className="h-4 w-4 mr-1" />Manual
              </button>
              <button onClick={loadScanner}
                className={`flex-1 flex items-center justify-center px-3 py-2 text-sm font-medium ${scanMode === 'camera' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                <Camera className="h-4 w-4 mr-1" />Camera
              </button>
            </div>

            {scanMode === 'manual' && (
              <form onSubmit={handleManualSubmit} className="space-y-3">
                <textarea
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono focus:ring-2 focus:ring-blue-500"
                  placeholder="Paste JWT token / QR hash here..."
                  value={manualInput}
                  onChange={e => setManualInput(e.target.value)}
                />
                <button type="submit" disabled={loading || !manualInput.trim()}
                  className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  <Search className="mr-2 h-4 w-4" />{loading ? 'Verifying...' : 'Verify Pass'}
                </button>
              </form>
            )}

            {scanMode === 'camera' && CameraScanner && (
              <div>
                <CameraScanner onScan={handleCameraScan}
                  onError={() => { setScanFeedback({ color: 'red', message: 'Camera error. Use manual input.' }); setScanMode('manual'); }}
                  components={{ audio: false, finder: true }} />
                <button onClick={resetAll} className="mt-2 w-full text-sm text-gray-400 hover:text-gray-600">✕ Cancel</button>
              </div>
            )}

            {/* Color Legend */}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-500 font-medium mb-2">Scan Result Guide</p>
              <div className="space-y-1">
                {[
                  { color: 'text-green-600', label: '🟢 Exit Approved — First scan' },
                  { color: 'text-blue-600',  label: '🔵 Entry Confirmed — Pass Closed' },
                  { color: 'text-red-500',   label: '🔴 Expired — Local pass >24h' },
                  { color: 'text-orange-500',label: '🟠 Already Terminated — reuse' },
                ].map(({ color, label }) => (
                  <p key={label} className={`text-xs ${color}`}>{label}</p>
                ))}
              </div>
            </div>
          </div>

          {/* Result Panel */}
          <div className="bg-white p-6 rounded-xl shadow-md flex flex-col">
            <h3 className="text-lg font-semibold mb-4 text-gray-700">Verification Result</h3>

            {loading && <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Verifying pass…</div>}

            {/* Scan Feedback (colored result) */}
            {scanFeedback && !loading && (() => {
              const cfg = SCAN_COLORS[scanFeedback.color] || SCAN_COLORS.red;
              return (
                <div className={`${cfg.bg} ${cfg.border} border-l-4 rounded-lg p-4 mb-4`}>
                  <div className="flex items-start space-x-3">
                    {cfg.icon}
                    <div>
                      <p className={`text-sm font-bold ${cfg.text}`}>{scanFeedback.message}</p>
                      {scanFeedback.detail?.exitTime && (
                        <p className="text-xs text-gray-500 mt-1">Exited: {format(new Date(scanFeedback.detail.exitTime), 'PPp')}</p>
                      )}
                      {scanFeedback.detail?.entryTime && (
                        <p className="text-xs text-gray-500">Returned: {format(new Date(scanFeedback.detail.entryTime), 'PPp')}</p>
                      )}
                      {!['EXIT_APPROVED','ENTRY_CONFIRMED'].includes(scanFeedback.scanResult) && (
                        <button onClick={resetAll} className="mt-2 text-xs text-gray-500 hover:underline">Try another QR →</button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Valid Pass — show details + action buttons */}
            {verifyData?.valid && pass && !scanFeedback && !loading && (
              <div className="flex-1 flex flex-col">
                {/* Pre-scan status banner */}
                {verifyData.scanResult !== 'VALID' && (
                  <div className={`${SCAN_COLORS[verifyData.color]?.bg} ${SCAN_COLORS[verifyData.color]?.border} border-l-4 rounded-lg p-3 mb-3`}>
                    <p className={`text-xs font-medium ${SCAN_COLORS[verifyData.color]?.text}`}>{verifyData.message}</p>
                  </div>
                )}

                {/* Student card */}
                <div className="border border-gray-200 bg-gray-50 rounded-xl p-4 mb-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-lg font-bold text-gray-900">{pass.studentName}</p>
                      <p className="text-sm text-gray-500">{pass.registerNumber}</p>
                      <p className="text-xs text-gray-400">Block {pass.block} — Room {pass.room}</p>
                    </div>
                    <span className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-bold ${passTypeStyle.color}`}>
                      {passTypeStyle.icon}<span>{pass.passType}</span>
                    </span>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="bg-white p-3 rounded-lg border border-gray-100">
                    <p className="text-xs text-gray-400 uppercase">Destination</p>
                    <p className="text-sm font-semibold text-gray-800">{pass.destination}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-white p-3 rounded-lg border border-gray-100">
                      <p className="text-xs text-gray-400">Return by</p>
                      <p className="text-xs font-medium text-gray-700">{format(new Date(pass.expectedReturn), 'PPp')}</p>
                    </div>
                    {pass.validUntil && (
                      <div className={`p-3 rounded-lg border ${new Date() > new Date(pass.validUntil) ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                        <p className="text-xs text-gray-400">Expires</p>
                        <p className="text-xs font-medium text-gray-700">{format(new Date(pass.validUntil), 'p, MMM d')}</p>
                      </div>
                    )}
                  </div>
                  {pass.passStatus === 'OUT' && pass.exitTimestamp && (
                    <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg">
                      <p className="text-xs text-yellow-700 font-medium">⚡ Student is currently OUT — scan to confirm Entry</p>
                      <p className="text-xs text-gray-500 mt-0.5">Exited: {format(new Date(pass.exitTimestamp), 'PPp')}</p>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleLogAction('Exit')}
                    disabled={actionLoading || pass.passStatus === 'OUT'}
                    className="flex items-center justify-center px-4 py-3 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <LogOut className="mr-2 h-4 w-4" />{actionLoading ? '...' : 'Exit'}
                  </button>
                  <button
                    onClick={() => handleLogAction('Entry')}
                    disabled={actionLoading || pass.passStatus === 'Active'}
                    className="flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <LogIn className="mr-2 h-4 w-4" />{actionLoading ? '...' : 'Entry'}
                  </button>
                </div>
                <p className="text-xs text-gray-400 text-center mt-2">
                  {pass.passStatus === 'Active' ? 'Tap Exit to activate pass' : 'Tap Entry to close pass & terminate QR'}
                </p>
              </div>
            )}

            {!loading && !verifyData && !scanFeedback && (
              <div className="flex-1 flex items-center justify-center border-2 border-dashed border-gray-200 rounded-xl p-8">
                <p className="text-gray-400 text-sm text-center">Scan or enter a QR code to verify a student's gate pass</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default SecurityScan;
