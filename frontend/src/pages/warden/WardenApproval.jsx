import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '../../components/Layout';
import { format } from 'date-fns';
import { CheckCircle, XCircle, Home, MapPin, Clock, BookOpen, X } from 'lucide-react';

const DEPARTMENTS = ['ALL', 'IT', 'CSE', 'ECE', 'EEE', 'MECH', 'AIML', 'AIDS', 'CIVIL'];

const WardenApproval = () => {
  const [pending, setPending]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [processing, setProcessing] = useState(null);
  const [message, setMessage]       = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');

  // Rejection Modal State
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason]       = useState('');
  const [rejectRequestId, setRejectRequestId] = useState(null);
  const [manualCodes, setManualCodes]       = useState({}); // Tracks manual QR per requestID

  useEffect(() => { fetchPending(); }, []);

  const fetchPending = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/requests/warden/pending');
      setPending(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id, status, reason = null) => {
    setProcessing(id);
    setMessage('');
    try {
      const manualQRCode = manualCodes[id] || null;
      await axios.put(`/api/requests/warden/approve/${id}`, { status, reason, manualQRCode });
      setMessage(status === 'WardenApproved' ? '✅ Pass approved and QR code generated!' : '❌ Request rejected.');
      setShowRejectModal(false);
      setRejectReason('');
      fetchPending();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Error processing request.');
    } finally {
      setProcessing(null);
    }
  };

  const openRejectModal = (id) => {
    setRejectRequestId(id);
    setShowRejectModal(true);
  };

  const filtered = deptFilter === 'ALL'
    ? pending
    : pending.filter(r => r.StudentDept === deptFilter || r.Department === deptFilter);

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Approval Queue</h1>
        <p className="text-sm text-gray-500 mb-4">
          Local passes await direct approval · Home passes arrive after HOD clearance
        </p>

        {/* Department filter pills */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-5">
          <p className="text-xs text-gray-400 font-medium mb-2 flex items-center">
            <BookOpen className="h-3.5 w-3.5 mr-1" />Filter by Department
          </p>
          <div className="flex flex-wrap gap-2">
            {DEPARTMENTS.map(d => {
              const count = d === 'ALL' ? pending.length : pending.filter(r => r.StudentDept === d || r.Department === d).length;
              return (
                <button key={d} onClick={() => setDeptFilter(d)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                    deptFilter === d
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                  }`}>
                  {d} <span className="ml-1 opacity-70">({count})</span>
                </button>
              );
            })}
          </div>
        </div>

        {message && (
          <div className={`mb-4 p-3 rounded-lg text-sm font-medium ${message.startsWith('✅') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
            {message}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading pending requests...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
            <CheckCircle className="h-10 w-10 text-green-400 mx-auto mb-2" />
            <p className="text-gray-500 font-medium">
              {deptFilter === 'ALL' ? 'All caught up! No pending approvals.' : `No pending requests for ${deptFilter} department.`}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-gray-400">
              Showing <span className="font-semibold text-gray-700">{filtered.length}</span> request{filtered.length !== 1 ? 's' : ''}
              {deptFilter !== 'ALL' && ` for ${deptFilter} dept`}
            </p>
            {filtered.map(req => {
              const isLocal = req.PassType === 'Local';
              const dept    = req.StudentDept || req.Department || null;
              return (
                <div key={req.ID} className={`bg-white rounded-xl border-l-4 shadow-sm p-5 ${isLocal ? 'border-blue-400' : 'border-purple-400'}`}>
                  <div className="flex items-start justify-between flex-wrap gap-3">
                    <div className="flex-1">
                      <div className="flex items-center flex-wrap gap-2 mb-1">
                        <span className={`inline-flex items-center space-x-1 text-xs font-bold px-2 py-0.5 rounded-full ${isLocal ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                          {isLocal ? <MapPin className="h-3 w-3" /> : <Home className="h-3 w-3" />}
                          <span>{req.PassType} Outpass</span>
                        </span>
                        {!isLocal && <span className="text-xs text-purple-500 font-medium">HOD ✅ Cleared</span>}
                        {dept && (
                          <span className="text-xs bg-gray-100 text-gray-600 font-semibold px-2 py-0.5 rounded-full">{dept}</span>
                        )}
                      </div>
                      <h3 className="text-base font-bold text-gray-900">{req.Name} <span className="text-gray-400 font-normal text-sm">({req.RegisterNumber})</span></h3>
                      <p className="text-xs text-gray-500">Block {req.Block} — Room {req.RoomNumber}</p>
                      <p className="text-sm text-gray-700 mt-2"><span className="font-medium">Destination:</span> {req.Destination}</p>
                      <p className="text-sm text-gray-500 mt-0.5">{req.Reason}</p>
                      <div className="flex items-center text-xs text-gray-400 mt-2 space-x-3">
                        <span><Clock className="inline h-3 w-3 mr-1" />Exit: {format(new Date(req.OutTime), 'PPp')}</span>
                        <span>Return: {format(new Date(req.ExpectedReturnTime), 'PPp')}</span>
                      </div>
                      {isLocal && (
                        <p className="text-xs text-blue-600 mt-1 font-medium">⏱ QR will be valid for 24 hours after approval</p>
                      )}
                      {!isLocal && (
                        <p className="text-xs text-purple-600 mt-1 font-medium">🔓 QR stays active until student returns and scans in</p>
                      )}
                      
                      {/* Manual QR Code Input */}
                      <div className="mt-4 pt-3 border-t border-gray-100">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Manual QR Code (Optional)</label>
                        <input 
                          type="text"
                          placeholder="Leave empty for auto-generated QR"
                          className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                          value={manualCodes[req.ID] || ''}
                          onChange={(e) => setManualCodes(prev => ({ ...prev, [req.ID]: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="flex flex-col space-y-2 min-w-[120px]">
                      <button
                        onClick={() => handleApprove(req.ID, 'WardenApproved')}
                        disabled={processing === req.ID}
                        className="flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        {processing === req.ID ? 'Processing...' : 'Approve'}
                      </button>
                      <button
                        onClick={() => openRejectModal(req.ID)}
                        disabled={processing === req.ID}
                        className="flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 disabled:opacity-50"
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Rejection Reason Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-500/75 backdrop-blur-sm" onClick={() => setShowRejectModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Reason for Rejection</h3>
              <button onClick={() => setShowRejectModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-sm text-gray-500 mb-4">
              Please provide a clear reason for rejecting this outpass. The student will see this note on their dashboard.
            </p>

            <textarea
              className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all"
              rows={4}
              placeholder="e.g. Incomplete details, pending fees, or CGPA restrictions..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />

            <div className="mt-6 flex space-x-3">
              <button
                onClick={() => setShowRejectModal(false)}
                className="flex-1 px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 bg-white transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={!rejectReason.trim() || processing === rejectRequestId}
                onClick={() => handleApprove(rejectRequestId, 'Rejected', rejectReason)}
                className="flex-1 px-4 py-2 rounded-xl bg-red-600 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {processing === rejectRequestId ? 'Processing...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default WardenApproval;
