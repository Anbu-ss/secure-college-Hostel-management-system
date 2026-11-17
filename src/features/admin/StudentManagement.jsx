import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '../../shared/components/Layout';
import { 
  Users, 
  Search, 
  Filter, 
  Download, 
  CheckCircle, 
  XCircle, 
  Ban, 
  Home, 
  Eye, 
  Clock, 
  AlertCircle, 
  Loader2, 
  RefreshCw, 
  GraduationCap, 
  Phone, 
  Mail, 
  MapPin, 
  Building2,
  X
} from 'lucide-react';

const StudentManagement = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [exporting, setExporting] = useState(false);

  // Modals state
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [allocateModalOpen, setAllocateModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  // Allocation form state
  const [hostelName, setHostelName] = useState('Main Boys Hostel');
  const [roomNumber, setRoomNumber] = useState('101');
  const [allocating, setAllocating] = useState(false);

  useEffect(() => {
    fetchStudents();
  }, [statusFilter, deptFilter]);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/admin/students', {
        params: {
          search,
          status: statusFilter,
          department: deptFilter
        }
      });
      if (res.data?.students) {
        setStudents(res.data.students);
      }
    } catch (err) {
      console.error('Error fetching students:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchStudents();
  };

  const handleApprove = async (studentId) => {
    if (!window.confirm('Approve this student application and activate their hostel account?')) return;
    try {
      await axios.patch(`/api/admin/students/${studentId}/approve`);
      fetchStudents();
    } catch (err) {
      alert(err.response?.data?.message || 'Error approving student.');
    }
  };

  const handleReject = async () => {
    if (!selectedStudent) return;
    try {
      await axios.patch(`/api/admin/students/${selectedStudent.id}/reject`, { reason: rejectReason });
      setRejectModalOpen(false);
      setRejectReason('');
      fetchStudents();
    } catch (err) {
      alert(err.response?.data?.message || 'Error rejecting student.');
    }
  };

  const handleToggleSuspend = async (studentId) => {
    try {
      await axios.patch(`/api/admin/students/${studentId}/suspend`);
      fetchStudents();
    } catch (err) {
      alert(err.response?.data?.message || 'Error toggling account suspension.');
    }
  };

  const handleAllocateRoom = async (e) => {
    e.preventDefault();
    if (!selectedStudent) return;
    setAllocating(true);
    try {
      await axios.post(`/api/admin/students/${selectedStudent.id}/allocate-room`, {
        hostelName,
        roomNumber
      });
      setAllocateModalOpen(false);
      fetchStudents();
    } catch (err) {
      alert(err.response?.data?.message || 'Error allocating room.');
    } finally {
      setAllocating(false);
    }
  };

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const response = await axios.get('/api/admin/students/export', {
        params: {
          status: statusFilter,
          department: deptFilter
        },
        responseType: 'blob'
      });

      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'Secure_Hostel_Student_Records.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to generate Excel export.');
    } finally {
      setExporting(false);
    }
  };

  const pendingCount = students.filter(s => s.status === 'PENDING_APPROVAL').length;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6 pb-12">
        
        {/* ── Top Header ────────────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl font-black text-slate-800">Student Directory & Approvals</h1>
              {pendingCount > 0 && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 animate-pulse">
                  {pendingCount} Pending Review
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Self-registered students in Supabase PostgreSQL • Review profiles, allocate rooms, and export reports
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleExportExcel}
              disabled={exporting}
              className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-2xl shadow-sm flex items-center space-x-2 transition-all disabled:opacity-60"
            >
              {exporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Generating Excel...</span>
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  <span>Export to Excel (.xlsx)</span>
                </>
              )}
            </button>
            <button
              onClick={fetchStudents}
              className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl transition-colors"
              title="Refresh Directory"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* ── Status Tabs ───────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
          {[
            { id: 'ALL', label: 'All Students' },
            { id: 'PENDING_APPROVAL', label: 'Pending Approvals' },
            { id: 'ACTIVE', label: 'Active Students' },
            { id: 'SUSPENDED', label: 'Suspended Students' },
            { id: 'REJECTED', label: 'Rejected Students' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all ${
                statusFilter === tab.id
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {tab.label}
              {tab.id === 'PENDING_APPROVAL' && pendingCount > 0 && (
                <span className="ml-1.5 px-1.5 py-0.2 bg-amber-400 text-slate-900 rounded-full text-[10px]">
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
              placeholder="Search by Student ID (e.g. 001), Name, Email, or Reg No..."
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

        {/* ── Students Table ────────────────────────────────────────────── */}
        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
          {loading ? (
            <div className="p-12 text-center text-slate-400 flex items-center justify-center space-x-2">
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
              <span className="text-xs font-medium">Loading Supabase student records...</span>
            </div>
          ) : students.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="h-10 w-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700">No student records match this criteria</p>
              <p className="text-xs text-slate-400 mt-1">Students will appear here immediately after self-registering.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-400 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Student ID</th>
                    <th className="py-3 px-4">Student Name</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Dept / Year</th>
                    <th className="py-3 px-4">Hostel / Room</th>
                    <th className="py-3 px-4">Account Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {students.map((student) => {
                    const isPending = student.status === 'PENDING_APPROVAL';
                    const isSuspended = student.status === 'SUSPENDED';

                    return (
                      <tr key={student.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-blue-600 text-xs">
                          {student.studentCode}
                        </td>
                        <td className="py-3.5 px-4 text-slate-900 font-semibold">
                          {student.studentName}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">
                          {student.email}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">
                          {student.department} • Year {student.yearOfStudy || 1}
                        </td>
                        <td className="py-3.5 px-4">
                          {student.hostelName !== 'Pending Allocation' ? (
                            <span className="text-slate-800 font-medium">
                              {student.hostelName} ({student.roomNumber})
                            </span>
                          ) : (
                            <span className="text-amber-600 font-semibold text-[11px]">
                              Pending Allocation
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            student.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' :
                            isPending ? 'bg-amber-100 text-amber-800 animate-pulse' :
                            isSuspended ? 'bg-red-100 text-red-800' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {student.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            {/* View Profile */}
                            <button
                              onClick={() => { setSelectedStudent(student); setViewModalOpen(true); }}
                              className="p-1.5 text-slate-600 hover:text-blue-600 bg-slate-100 hover:bg-blue-50 rounded-lg transition-colors"
                              title="View Full Profile"
                            >
                              <Eye className="h-4 w-4" />
                            </button>

                            {/* Allocate Room */}
                            <button
                              onClick={() => { setSelectedStudent(student); setAllocateModalOpen(true); }}
                              className="p-1.5 text-slate-600 hover:text-indigo-600 bg-slate-100 hover:bg-indigo-50 rounded-lg transition-colors"
                              title="Assign Room"
                            >
                              <Home className="h-4 w-4" />
                            </button>

                            {/* Approve (if pending) */}
                            {isPending && (
                              <button
                                onClick={() => handleApprove(student.id)}
                                className="px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 rounded-lg transition-colors flex items-center space-x-1"
                                title="Approve Registration"
                              >
                                <CheckCircle className="h-3.5 w-3.5" />
                                <span>Approve</span>
                              </button>
                            )}

                            {/* Reject (if pending) */}
                            {isPending && (
                              <button
                                onClick={() => { setSelectedStudent(student); setRejectModalOpen(true); }}
                                className="p-1.5 text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                                title="Reject Registration"
                              >
                                <XCircle className="h-4 w-4" />
                              </button>
                            )}

                            {/* Suspend / Reactivate */}
                            {!isPending && (
                              <button
                                onClick={() => handleToggleSuspend(student.id)}
                                className={`p-1.5 rounded-lg transition-colors ${
                                  isSuspended 
                                    ? 'text-emerald-600 hover:bg-emerald-50 bg-slate-100' 
                                    : 'text-amber-600 hover:bg-amber-50 bg-slate-100'
                                }`}
                                title={isSuspended ? 'Reactivate Account' : 'Suspend Account'}
                              >
                                <Ban className="h-4 w-4" />
                              </button>
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

        {/* ── MODAL 1: View Full Student Profile ─────────────────────────── */}
        {viewModalOpen && selectedStudent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 shadow-2xl">
              <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
                    <GraduationCap className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-800">{selectedStudent.studentName}</h3>
                    <p className="text-xs text-slate-400">Student ID: <span className="font-mono font-bold text-blue-600">{selectedStudent.studentCode}</span></p>
                  </div>
                </div>
                <button onClick={() => setViewModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 rounded-full">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="py-4 space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-2xl">
                  <div><span className="text-slate-400 block">Email:</span> <span className="font-semibold text-slate-800">{selectedStudent.email}</span></div>
                  <div><span className="text-slate-400 block">Phone:</span> <span className="font-semibold text-slate-800">{selectedStudent.phoneNumber || 'N/A'}</span></div>
                  <div><span className="text-slate-400 block">Department:</span> <span className="font-semibold text-slate-800">{selectedStudent.department}</span></div>
                  <div><span className="text-slate-400 block">Year of Study:</span> <span className="font-semibold text-slate-800">{selectedStudent.yearOfStudy || 1} Year</span></div>
                  <div><span className="text-slate-400 block">Academic Year:</span> <span className="font-semibold text-slate-800">{selectedStudent.academicYear || '2024-2028'}</span></div>
                  <div><span className="text-slate-400 block">Register Number:</span> <span className="font-semibold text-slate-800">{selectedStudent.registerNumber || 'Pending'}</span></div>
                </div>

                <div className="grid grid-cols-2 gap-4 p-4 bg-indigo-50/60 rounded-2xl border border-indigo-100">
                  <div><span className="text-slate-400 block">Hostel Block:</span> <span className="font-semibold text-indigo-900">{selectedStudent.hostelName}</span></div>
                  <div><span className="text-slate-400 block">Room Number:</span> <span className="font-semibold text-indigo-900">{selectedStudent.roomNumber}</span></div>
                </div>

                <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-2xl">
                  <div><span className="text-slate-400 block">Parent/Guardian Name:</span> <span className="font-semibold text-slate-800">{selectedStudent.guardianName || 'N/A'}</span></div>
                  <div><span className="text-slate-400 block">Guardian Phone:</span> <span className="font-semibold text-slate-800">{selectedStudent.guardianPhone || 'N/A'}</span></div>
                  <div><span className="text-slate-400 block">Emergency Contact:</span> <span className="font-semibold text-slate-800">{selectedStudent.emergencyContact || 'N/A'}</span></div>
                  <div><span className="text-slate-400 block">City / State:</span> <span className="font-semibold text-slate-800">{selectedStudent.city ? `${selectedStudent.city}, ${selectedStudent.state}` : 'N/A'}</span></div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <button onClick={() => setViewModalOpen(false)} className="py-2 px-5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl">
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── MODAL 2: Allocate Room ────────────────────────────────────── */}
        {allocateModalOpen && selectedStudent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <h3 className="text-base font-bold text-slate-800">Assign Hostel Room</h3>
                <button onClick={() => setAllocateModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleAllocateRoom} className="py-4 space-y-4 text-xs">
                <div className="p-3 bg-slate-50 rounded-2xl">
                  <p className="text-slate-500">Student: <strong className="text-slate-800">{selectedStudent.studentName}</strong> (ID: {selectedStudent.studentCode})</p>
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">Hostel Block</label>
                  <select
                    value={hostelName}
                    onChange={(e) => setHostelName(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                  >
                    <option value="Main Boys Hostel">Main Boys Hostel</option>
                    <option value="Annexe Boys Hostel">Annexe Boys Hostel</option>
                    <option value="Main Girls Hostel">Main Girls Hostel</option>
                    <option value="PG & Research Block">PG & Research Block</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">Room Number</label>
                  <input
                    type="text"
                    value={roomNumber}
                    onChange={(e) => setRoomNumber(e.target.value)}
                    placeholder="e.g. 101, 204, B-302"
                    required
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                  />
                </div>

                <div className="pt-2 flex justify-end space-x-2">
                  <button type="button" onClick={() => setAllocateModalOpen(false)} className="py-2 px-4 bg-slate-100 rounded-xl font-bold text-slate-600">
                    Cancel
                  </button>
                  <button type="submit" disabled={allocating} className="py-2 px-5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-md">
                    {allocating ? 'Saving Allocation...' : 'Save Allocation'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── MODAL 3: Reject Application ───────────────────────────────── */}
        {rejectModalOpen && selectedStudent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl">
              <h3 className="text-base font-bold text-red-600 mb-2">Reject Registration</h3>
              <p className="text-xs text-slate-500 mb-3">Provide a reason for rejecting {selectedStudent.studentName}'s application:</p>
              
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Reason (e.g. Incomplete verification, invalid identity proof)"
                rows={3}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-red-500"
              />

              <div className="pt-4 flex justify-end space-x-2">
                <button onClick={() => setRejectModalOpen(false)} className="py-2 px-4 bg-slate-100 text-xs font-bold text-slate-600 rounded-xl">
                  Cancel
                </button>
                <button onClick={handleReject} className="py-2 px-5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl shadow-md">
                  Confirm Rejection
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </Layout>
  );
};

export default StudentManagement;
