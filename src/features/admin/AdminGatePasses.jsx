import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '../../shared/components/Layout';
import { 
  ClipboardList, 
  Search, 
  Filter, 
  CheckCircle, 
  XCircle, 
  Clock, 
  User, 
  QrCode, 
  MapPin, 
  Calendar, 
  Phone, 
  Building2, 
  AlertCircle, 
  ChevronRight, 
  Loader2, 
  Eye, 
  Printer, 
  X,
  ArrowRight,
  ShieldCheck,
  Ban
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

const PERMANENT_GATE_IDENTIFIER = 'GATE_DMI_MAIN_01';

const STATUS_CONFIG = {
  ALL: { label: 'All Requests', color: 'bg-slate-100 text-slate-700 border-slate-300' },
  PENDING: { label: 'Pending Approval', color: 'bg-amber-50 text-amber-800 border-amber-200', dot: 'bg-amber-400' },
  APPROVED: { label: 'Approved (Unlocked)', color: 'bg-emerald-50 text-emerald-800 border-emerald-200', dot: 'bg-emerald-500' },
  EXITED: { label: 'Exited Campus', color: 'bg-indigo-50 text-indigo-800 border-indigo-200', dot: 'bg-indigo-500' },
  RETURNED: { label: 'Returned', color: 'bg-teal-50 text-teal-800 border-teal-200', dot: 'bg-teal-500' },
  REJECTED: { label: 'Rejected', color: 'bg-rose-50 text-rose-800 border-rose-200', dot: 'bg-rose-500' },
  EXPIRED: { label: 'Expired', color: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400' }
};

const AdminGatePasses = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [yearFilter, setYearFilter] = useState('ALL');

  // Modals state
  const [selectedPass, setSelectedPass] = useState(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [gateQrModalOpen, setGateQrModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchGatePasses();
  }, [statusFilter, deptFilter, yearFilter]);

  const fetchGatePasses = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/admin/gate-passes', {
        params: {
          search,
          status: statusFilter,
          department: deptFilter,
          academicYear: yearFilter
        }
      });
      if (res.data?.requests) {
        setRequests(res.data.requests);
      }
    } catch (err) {
      console.error('Error fetching admin gate passes:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchGatePasses();
  };

  const handleApprove = async (passId) => {
    if (!window.confirm('Approve this Gate Pass? This will immediately unlock the student\'s gate QR scanner.')) return;
    setActionLoading(true);
    try {
      await axios.patch(`/api/admin/gate-passes/${passId}/approve`);
      if (viewModalOpen) setViewModalOpen(false);
      fetchGatePasses();
    } catch (err) {
      alert(err.response?.data?.message || 'Error approving gate pass.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectSubmit = async (e) => {
    e.preventDefault();
    if (!selectedPass) return;
    setActionLoading(true);
    try {
      await axios.patch(`/api/admin/gate-passes/${selectedPass.id}/reject`, {
        rejectionReason: rejectReason.trim() || 'Request rejected by administration.'
      });
      setRejectModalOpen(false);
      setRejectReason('');
      if (viewModalOpen) setViewModalOpen(false);
      fetchGatePasses();
    } catch (err) {
      alert(err.response?.data?.message || 'Error rejecting gate pass.');
    } finally {
      setActionLoading(false);
    }
  };

  // Compute stats
  const pendingCount = requests.filter(r => r.status === 'PENDING').length;
  const approvedCount = requests.filter(r => r.status === 'APPROVED').length;
  const exitedCount = requests.filter(r => r.status === 'EXITED').length;
  const returnedCount = requests.filter(r => r.status === 'RETURNED').length;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6 pb-16">

        {/* ── Top Header ────────────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-gradient-to-tr from-blue-600 to-indigo-600 text-white rounded-2xl shadow-md shadow-blue-500/20">
              <ClipboardList className="h-7 w-7" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
                  Gate Pass Management
                </h1>
                {pendingCount > 0 && (
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[11px] font-bold rounded-full border border-amber-200 animate-pulse">
                    {pendingCount} Pending
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Review, approve, and track student exit and return entries with permanent gate QR verification.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setGateQrModalOpen(true)}
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-2xl shadow-sm flex items-center space-x-2 transition-all hover:scale-[1.02]"
            >
              <QrCode className="h-4 w-4 text-emerald-400" />
              <span>College Gate QR Code</span>
            </button>
          </div>
        </div>

        {/* ── Status Overview Grid ──────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
              <span>PENDING REVIEW</span>
              <Clock className="h-4 w-4 text-amber-500" />
            </div>
            <p className="text-2xl font-black text-slate-800 mt-2">{pendingCount}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Awaiting admin decision</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
              <span>APPROVED (READY)</span>
              <CheckCircle className="h-4 w-4 text-emerald-500" />
            </div>
            <p className="text-2xl font-black text-slate-800 mt-2">{approvedCount}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Scanner unlocked for exit</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
              <span>EXITED CAMPUS</span>
              <ArrowRight className="h-4 w-4 text-indigo-500" />
            </div>
            <p className="text-2xl font-black text-slate-800 mt-2">{exitedCount}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Currently outside college</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
              <span>RETURNED SAFELY</span>
              <ShieldCheck className="h-4 w-4 text-teal-500" />
            </div>
            <p className="text-2xl font-black text-slate-800 mt-2">{returnedCount}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Completed gate pass cycle</p>
          </div>
        </div>

        {/* ── Status Tabs ───────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
          {Object.entries(STATUS_CONFIG).map(([key, config]) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={`px-3.5 py-1.5 rounded-2xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
                statusFilter === key
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <span>{config.label}</span>
              {key === 'PENDING' && pendingCount > 0 && (
                <span className="px-1.5 py-0.2 bg-amber-400 text-slate-900 rounded-full text-[10px]">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Search & Filter Controls ──────────────────────────────────── */}
        <div className="bg-white border border-slate-200 rounded-3xl p-4 shadow-sm flex flex-col md:flex-row gap-4">
          <form onSubmit={handleSearchSubmit} className="flex-1 relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by student name, Student ID (001), Register Number, or destination..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          </form>

          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-slate-400" />
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">All Departments</option>
                <option value="CSE">CSE</option>
                <option value="IT">IT</option>
                <option value="AIDS">AIDS</option>
                <option value="AIML">AIML</option>
                <option value="ECE">ECE</option>
                <option value="EEE">EEE</option>
                <option value="MECH">MECH</option>
                <option value="CIVIL">CIVIL</option>
              </select>
            </div>
          </div>
        </div>

        {/* ── Requests Table ────────────────────────────────────────────── */}
        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
          {loading ? (
            <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center space-y-3">
              <Loader2 className="h-7 w-7 animate-spin text-blue-600" />
              <span className="text-xs font-semibold">Loading Gate Pass applications...</span>
            </div>
          ) : requests.length === 0 ? (
            <div className="p-16 text-center">
              <ClipboardList className="h-10 w-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700">No gate passes found</p>
              <p className="text-xs text-slate-400 mt-1">Student applications matching this filter will be displayed here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4">Student</th>
                    <th className="py-3.5 px-4">Destination & Reason</th>
                    <th className="py-3.5 px-4">Departure Time</th>
                    <th className="py-3.5 px-4">Expected Return</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {requests.map((r) => {
                    const st = r.student || {};
                    const cfg = STATUS_CONFIG[r.status] || STATUS_CONFIG.ALL;
                    return (
                      <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-4 px-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-600 flex-shrink-0">
                              {st.profilePhotoUrl ? (
                                <img src={st.profilePhotoUrl} alt={st.name} className="w-full h-full object-cover rounded-xl" />
                              ) : (
                                <User className="h-4 w-4 text-slate-400" />
                              )}
                            </div>
                            <div>
                              <p className="font-bold text-slate-800">{st.name}</p>
                              <p className="text-[11px] text-slate-400">
                                ID: <span className="font-mono font-bold text-slate-700">{st.studentCode || st.registerNumber}</span> • {st.department}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="py-4 px-4 max-w-xs">
                          <div className="flex items-center space-x-1.5 text-slate-800 font-semibold">
                            <MapPin className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                            <span className="truncate">{r.destination}</span>
                          </div>
                          <p className="text-[11px] text-slate-500 truncate mt-0.5">{r.reason}</p>
                        </td>

                        <td className="py-4 px-4 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                          {r.departureAt ? new Date(r.departureAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                        </td>

                        <td className="py-4 px-4 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                          {r.expectedReturnAt ? new Date(r.expectedReturnAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                        </td>

                        <td className="py-4 px-4">
                          <span className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${cfg.color}`}>
                            {cfg.dot && <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />}
                            <span>{cfg.label}</span>
                          </span>
                        </td>

                        <td className="py-4 px-4 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => { setSelectedPass(r); setViewModalOpen(true); }}
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                              title="View Details"
                            >
                              <Eye className="h-4 w-4" />
                            </button>

                            {r.status === 'PENDING' && (
                              <>
                                <button
                                  onClick={() => handleApprove(r.id)}
                                  disabled={actionLoading}
                                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-xl shadow-xs transition"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => { setSelectedPass(r); setRejectModalOpen(true); }}
                                  disabled={actionLoading}
                                  className="px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-bold rounded-xl transition"
                                >
                                  Reject
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Modal: View Pass Details ──────────────────────────────────── */}
        {viewModalOpen && selectedPass && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-scale-up">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center space-x-2">
                  <ClipboardList className="h-5 w-5 text-blue-600" />
                  <h3 className="font-bold text-base text-slate-800">Gate Pass Application #{selectedPass.id.slice(0, 8)}</h3>
                </div>
                <button onClick={() => setViewModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Student Header */}
              <div className="flex items-center space-x-4 p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 overflow-hidden flex items-center justify-center font-bold text-slate-500">
                  {selectedPass.student?.profilePhotoUrl ? (
                    <img src={selectedPass.student.profilePhotoUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <User className="h-6 w-6 text-slate-400" />
                  )}
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 text-sm">{selectedPass.student?.name}</h4>
                  <p className="text-xs text-slate-500">
                    ID: <span className="font-mono font-bold text-slate-700">{selectedPass.student?.studentCode}</span> • Dept: {selectedPass.student?.department}
                  </p>
                  <p className="text-[11px] text-slate-400">Mobile: {selectedPass.student?.phoneNumber || '—'}</p>
                </div>
              </div>

              {/* Application Details */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                  <span className="text-slate-400 font-bold uppercase text-[10px]">Destination</span>
                  <p className="font-bold text-slate-800">{selectedPass.destination}</p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                  <span className="text-slate-400 font-bold uppercase text-[10px]">Reason</span>
                  <p className="font-bold text-slate-800">{selectedPass.reason}</p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                  <span className="text-slate-400 font-bold uppercase text-[10px]">Departure Time</span>
                  <p className="font-mono font-medium text-slate-700">
                    {new Date(selectedPass.departureAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                  </p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                  <span className="text-slate-400 font-bold uppercase text-[10px]">Expected Return</span>
                  <p className="font-mono font-medium text-slate-700">
                    {new Date(selectedPass.expectedReturnAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                  </p>
                </div>
              </div>

              {selectedPass.additionalDescription && (
                <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1">
                  <span className="text-slate-400 font-bold uppercase text-[10px]">Student Notes</span>
                  <p className="text-slate-700">{selectedPass.additionalDescription}</p>
                </div>
              )}

              {/* Status & Approval / Rejection Notes */}
              {selectedPass.rejectionReason && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 space-y-1">
                  <span className="font-bold uppercase text-[10px] text-rose-600">Rejection Reason</span>
                  <p>{selectedPass.rejectionReason}</p>
                </div>
              )}

              {/* Actions Footer */}
              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  onClick={() => setViewModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl"
                >
                  Close
                </button>
                {selectedPass.status === 'PENDING' && (
                  <>
                    <button
                      onClick={() => handleRejectSubmit({ preventDefault: () => {} })}
                      className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => handleApprove(selectedPass.id)}
                      disabled={actionLoading}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md"
                    >
                      Approve & Unlock Scanner
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Modal: Enter Rejection Reason ─────────────────────────────── */}
        {rejectModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="font-bold text-base text-slate-800">Reject Gate Pass Request</h3>
                <button onClick={() => setRejectModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <p className="text-xs text-slate-500">
                Please enter the reason for rejecting this pass. The student's scanner will remain locked and the reason will be displayed in their portal.
              </p>

              <form onSubmit={handleRejectSubmit} className="space-y-4">
                <textarea
                  required
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="e.g. Incomplete parent permission, academic test scheduled on departure date..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
                />

                <div className="flex items-center justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setRejectModalOpen(false)}
                    className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-md"
                  >
                    Confirm Rejection
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── Modal: Single Permanent College Gate QR Code ───────────────── */}
        {gateQrModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 shadow-2xl text-center space-y-5 animate-scale-up">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center space-x-2">
                  <QrCode className="h-5 w-5 text-emerald-600" />
                  <h3 className="font-bold text-base text-slate-800">Permanent College Gate QR</h3>
                </div>
                <button onClick={() => setGateQrModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-2xl inline-block mx-auto">
                <QRCodeSVG
                  value={PERMANENT_GATE_IDENTIFIER}
                  size={200}
                  level="H"
                  includeMargin={true}
                  className="mx-auto"
                />
                <p className="font-mono text-xs font-bold text-slate-800 mt-2">{PERMANENT_GATE_IDENTIFIER}</p>
                <p className="text-[11px] text-slate-400">DMI College Main Security Gate</p>
              </div>

              <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-2xl text-left text-xs text-blue-900 space-y-1">
                <p className="font-bold">Permanent Physical Gate QR Code</p>
                <p className="text-[11px] text-blue-800 leading-relaxed">
                  Print and physically display this single QR code at the college security gate. Approved students will scan this exact code with their student portal to record their Exit and Return.
                </p>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl flex items-center space-x-1.5"
                >
                  <Printer className="h-4 w-4" />
                  <span>Print Signage</span>
                </button>
                <button
                  onClick={() => setGateQrModalOpen(false)}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </Layout>
  );
};

export default AdminGatePasses;

