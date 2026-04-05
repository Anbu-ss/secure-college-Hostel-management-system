import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '../../components/Layout';
import { format } from 'date-fns';
import { CheckCircle, X as RejectIcon, User, X } from 'lucide-react';

const HODPending = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);

  // Rejection Modal State
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason]       = useState('');
  const [rejectRequestId, setRejectRequestId] = useState(null);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const res = await axios.get('/api/requests/hod/pending');
      setRequests(res.data);
    } catch (error) {
      console.error('Error fetching HOD pending requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (id, status, reason = null) => {
    setProcessing(id);
    try {
      await axios.put(`/api/requests/hod/approve/${id}`, { status, reason });
      setRequests((prev) => prev.filter((req) => req.ID !== id));
      setShowRejectModal(false);
      setRejectReason('');
    } catch (error) {
      console.error(`Error marking request as ${status}:`, error);
      alert('Failed to update request.');
    } finally {
      setProcessing(null);
    }
  };

  const openRejectModal = (id) => {
    setRejectRequestId(id);
    setShowRejectModal(true);
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Final Approvals - HOD</h1>

        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          {loading ? (
            <div className="p-6 text-center text-gray-500">Loading requests...</div>
          ) : requests.length === 0 ? (
            <div className="p-6 text-center text-gray-500">No pending final approvals.</div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {requests.map((req) => (
                <li key={req.ID} className="p-4 hover:bg-gray-50 border-l-4 border-blue-500">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-start flex-1 min-w-0">
                      <div className="flex-shrink-0 mt-1">
                        <User className="h-10 w-10 text-blue-600 rounded-full bg-blue-100 p-2" />
                      </div>
                      <div className="ml-4 flex-1">
                        <div className="flex items-center space-x-2">
                             <h4 className="text-lg font-bold text-gray-900">{req.Name}</h4>
                             <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">Staff ✅</span>
                             <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-700">🏠 Home Outpass</span>
                             {req.StudentDept && (
                               <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-700">{req.StudentDept}</span>
                             )}
                        </div>
                        <p className="text-sm font-normal text-gray-500">{req.RegisterNumber} | Block {req.Block}, Room {req.RoomNumber}</p>
                        
                        <div className="mt-2 text-sm text-gray-700 bg-gray-50 p-3 rounded-md border border-gray-100">
                          <p><strong>Destination:</strong> {req.Destination}</p>
                          <p><strong>Reason:</strong> {req.Reason}</p>
                        </div>
                        <div className="mt-2 flex space-x-6 text-xs font-semibold text-gray-500">
                           <p>OUT: <span className="text-red-600">{format(new Date(req.OutTime), 'PPp')}</span></p>
                           <p>IN: <span className="text-green-600">{format(new Date(req.ExpectedReturnTime), 'PPp')}</span></p>
                        </div>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                       <button
                         onClick={() => handleAction(req.ID, 'HODApproved')}
                         className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 shadow-sm"
                       >
                         <CheckCircle className="mr-2 h-4 w-4" /> Forward to Warden
                       </button>
                       <button
                         onClick={() => openRejectModal(req.ID)}
                         disabled={processing === req.ID}
                         className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-gray-700 bg-gray-100 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 shadow-sm disabled:opacity-50"
                       >
                         <RejectIcon className="mr-2 h-4 w-4" /> Reject
                       </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
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
              Explain why this Home Outpass is being rejected. The student will see this note on their dashboard.
            </p>

            <textarea
              className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              rows={4}
              placeholder="e.g. Academic conflicts, internal exams, or disciplinary reasons..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />

            <div className="mt-6 flex space-x-3">
              <button
                onClick={() => setShowRejectModal(false)}
                className="flex-1 px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 bg-white"
              >
                Cancel
              </button>
              <button
                disabled={!rejectReason.trim() || processing === rejectRequestId}
                onClick={() => handleAction(rejectRequestId, 'Rejected', rejectReason)}
                className="flex-1 px-4 py-2 rounded-xl bg-blue-600 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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

export default HODPending;
