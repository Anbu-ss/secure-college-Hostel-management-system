import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Layout from '../../components/Layout';
import { format } from 'date-fns';
import { Users, Home, MapPin, AlertTriangle, RefreshCw, BookOpen, Sun, Sparkles } from 'lucide-react';

const DEPARTMENTS = ['ALL', 'IT', 'CSE', 'ECE', 'EEE', 'MECH', 'AIML', 'AIDS', 'CIVIL'];

const statusConfig = {
  IN_CAMPUS: { label: 'In Campus', color: 'bg-green-100 text-green-700 border-green-200', dot: 'bg-green-400', card: 'border-green-200' },
  LOCAL_OUT:  { label: 'Local Out', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', dot: 'bg-yellow-400', card: 'border-yellow-200' },
  HOME_OUT:   { label: 'Home Out',  color: 'bg-red-100 text-red-700 border-red-200',    dot: 'bg-red-400',    card: 'border-red-200'    },
};

const WardenDashboard = () => {
  const navigate = useNavigate();
  const [occupancy, setOccupancy]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [search, setSearch]         = useState('');

  useEffect(() => { fetchOccupancy(); }, []);

  const fetchOccupancy = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/security/occupancy');
      setOccupancy(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Compute unique departments from data (for dynamic pill labels)
  const deptCounts = DEPARTMENTS.slice(1).reduce((acc, d) => {
    acc[d] = occupancy.filter(s => s.department === d).length;
    return acc;
  }, {});

  const stats = {
    total:      occupancy.length,
    inCampus:   occupancy.filter(s => s.status === 'IN_CAMPUS').length,
    localOut:   occupancy.filter(s => s.status === 'LOCAL_OUT').length,
    homeOut:    occupancy.filter(s => s.status === 'HOME_OUT').length,
    lateReturn: occupancy.filter(s => s.lateReturn).length,
  };

  const filtered = occupancy.filter(s => {
    const matchDept   = deptFilter === 'ALL' || s.department === deptFilter;
    const matchStatus = statusFilter === 'ALL' || s.status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch = !q || s.name?.toLowerCase().includes(q) || s.registerNumber?.toLowerCase().includes(q) || s.room?.toLowerCase().includes(q);
    return matchDept && matchStatus && matchSearch;
  });

  // Group by department for display
  const grouped = deptFilter === 'ALL'
    ? DEPARTMENTS.slice(1).reduce((acc, d) => {
        const students = filtered.filter(s => s.department === d);
        if (students.length) acc[d] = students;
        return acc;
      }, {})
    : { [deptFilter]: filtered };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Live Occupancy Dashboard</h1>
            <p className="text-sm text-gray-500 mt-1">Real-time student presence tracking by department</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Holiday Mode shortcut */}
            <button
              id="holiday-mode-btn"
              onClick={() => navigate('/admin/holiday-mode')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold
                bg-gradient-to-r from-amber-500 to-orange-500 text-white
                hover:from-amber-600 hover:to-orange-600 shadow-sm transition-all"
            >
              <Sun className="h-4 w-4" />
              Holiday Mode
              <Sparkles className="h-3.5 w-3.5 opacity-80" />
            </button>
            <button onClick={fetchOccupancy} className="flex items-center text-sm text-gray-500 hover:text-gray-700">
              <RefreshCw className="h-4 w-4 mr-1" /> Refresh
            </button>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          {[
            { label: 'Total Students', value: stats.total,      color: 'text-gray-700',   bg: 'bg-gray-50'   },
            { label: 'In Campus',      value: stats.inCampus,   color: 'text-green-700',  bg: 'bg-green-50'  },
            { label: 'Local Out',      value: stats.localOut,   color: 'text-yellow-700', bg: 'bg-yellow-50' },
            { label: 'Home Out',       value: stats.homeOut,    color: 'text-red-700',    bg: 'bg-red-50'    },
            { label: 'Late Returns',   value: stats.lateReturn, color: 'text-orange-700', bg: 'bg-orange-50' },
          ].map(stat => (
            <div key={stat.label} className={`${stat.bg} rounded-xl p-4 border border-gray-100`}>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
              <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Filter Bar */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-5 space-y-3">

          {/* Search */}
          <input
            type="text" placeholder="Search by name, reg. no, or room..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            value={search} onChange={e => setSearch(e.target.value)}
          />

          {/* Department Filter */}
          <div>
            <p className="text-xs text-gray-400 font-medium mb-2 flex items-center">
              <BookOpen className="h-3.5 w-3.5 mr-1" />Department
            </p>
            <div className="flex flex-wrap gap-2">
              {DEPARTMENTS.map(d => {
                const count = d === 'ALL' ? occupancy.length : (deptCounts[d] || 0);
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

          {/* Status Filter */}
          <div>
            <p className="text-xs text-gray-400 font-medium mb-2">Status</p>
            <div className="flex flex-wrap gap-2">
              {['ALL', 'IN_CAMPUS', 'LOCAL_OUT', 'HOME_OUT'].map(f => (
                <button key={f} onClick={() => setStatusFilter(f)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                    statusFilter === f ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                  }`}>
                  {f.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results count */}
        <p className="text-xs text-gray-400 mb-3">
          Showing <span className="font-semibold text-gray-600">{filtered.length}</span> student{filtered.length !== 1 ? 's' : ''}
          {deptFilter !== 'ALL' && ` in ${deptFilter}`}
          {statusFilter !== 'ALL' && ` · ${statusFilter.replace('_', ' ')}`}
        </p>

        {/* Occupancy Grid — grouped by department */}
        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading occupancy data...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400">No students match this filter.</div>
        ) : (
          Object.entries(grouped).map(([dept, students]) => (
            <div key={dept} className="mb-8">
              {/* Department Header */}
              <div className="flex items-center space-x-3 mb-3">
                <div className="flex items-center space-x-2 bg-blue-600 text-white px-3 py-1 rounded-full">
                  <BookOpen className="h-3.5 w-3.5" />
                  <span className="text-xs font-bold">{dept}</span>
                </div>
                <span className="text-xs text-gray-400">{students.length} student{students.length !== 1 ? 's' : ''}</span>
                <div className="flex-1 h-px bg-gray-100" />
                {/* Mini dept stats */}
                <div className="flex items-center space-x-3 text-xs">
                  <span className="text-green-600">✅ {students.filter(s => s.status === 'IN_CAMPUS').length} in</span>
                  <span className="text-yellow-600">🟡 {students.filter(s => s.status === 'LOCAL_OUT').length} local</span>
                  <span className="text-red-600">🔴 {students.filter(s => s.status === 'HOME_OUT').length} home</span>
                </div>
              </div>

              {/* Cards grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {students.map((student, i) => {
                  const cfg = statusConfig[student.status] || statusConfig.IN_CAMPUS;
                  return (
                    <div key={i} className={`bg-white rounded-xl p-4 border-2 ${student.lateReturn ? 'border-red-400' : cfg.card} shadow-sm`}>
                      {student.lateReturn && (
                        <div className="flex items-center text-red-500 text-xs font-bold mb-2">
                          <AlertTriangle className="h-3 w-3 mr-1" />⚠️ Late Return
                        </div>
                      )}
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-bold text-gray-900">{student.name}</p>
                          <p className="text-xs text-gray-400">{student.registerNumber}</p>
                        </div>
                        <div className="flex items-center space-x-1">
                          <div className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${cfg.color}`}>{cfg.label}</span>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center text-xs text-gray-400">
                        <Users className="h-3 w-3 mr-1" />Block {student.block} — Room {student.room}
                      </div>
                      {student.status !== 'IN_CAMPUS' && (
                        <div className="mt-2 pt-2 border-t border-gray-100">
                          {student.passType === 'Local' ? (
                            <div className="flex items-center text-xs text-yellow-600">
                              <MapPin className="h-3 w-3 mr-1" />
                              {student.validUntil && <span>Expires {format(new Date(student.validUntil), 'p')}</span>}
                            </div>
                          ) : (
                            <div className="flex items-center text-xs text-red-500">
                              <Home className="h-3 w-3 mr-1" />
                              {student.expectedReturn && <span>Return by {format(new Date(student.expectedReturn), 'PPp')}</span>}
                            </div>
                          )}
                          {student.exitTimestamp && (
                            <p className="text-xs text-gray-400 mt-1">Exited: {format(new Date(student.exitTimestamp), 'PPp')}</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </Layout>
  );
};

export default WardenDashboard;
