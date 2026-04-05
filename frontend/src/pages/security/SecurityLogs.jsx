import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import Layout from '../../components/Layout';
import { format, differenceInMinutes, differenceInHours } from 'date-fns';
import * as XLSX from 'xlsx';
import {
  ClipboardList, RefreshCw, Search, Download, MapPin, Home,
  AlertTriangle, CheckCircle, LogOut, LogIn, ChevronDown, ChevronUp, X
} from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatDuration = (mins) => {
  if (mins === null || mins === undefined) return '—';
  const h = Math.floor(Math.abs(mins) / 60);
  const m = Math.abs(mins) % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const exportCSV = (rows, passType) => {
  const isLocal = passType === 'Local';
  const headers = isLocal
    ? ['Student Name', 'Reg No', 'Room', 'Destination', 'Exit Time', 'Entry Time', 'Duration', 'Status']
    : ['Student Name', 'Reg No', 'Room', 'Destination', 'Exit Date', 'Entry Date', 'Expected Return', 'Status'];

  // De-duplicate: build one row per unique pass (not per log line)
  const seen = new Set();
  const passList = [];
  rows.forEach(log => {
    const key = `${log.RegisterNumber}-${log.ExitTimestamp || log.Timestamp}`;
    if (!seen.has(key)) {
      seen.add(key);
      passList.push(log);
    }
  });

  const csvRows = passList.map(log => {
    const status = log.PassStatus === 'TERMINATED' ? (log.lateReturn ? 'Late Return' : 'Returned') : 'Still Out';
    const base = [
      log.StudentName, log.RegisterNumber, `Block ${log.Block} Rm ${log.RoomNumber}`,
      log.Destination,
      log.ExitTimestamp ? format(new Date(log.ExitTimestamp), 'dd/MM/yyyy HH:mm') : '—',
      log.EntryTimestamp ? format(new Date(log.EntryTimestamp), 'dd/MM/yyyy HH:mm') : '—',
    ];
    if (isLocal) return [...base, formatDuration(log.durationMinutes), status];
    return [...base, log.ExpectedReturnTime ? format(new Date(log.ExpectedReturnTime), 'dd/MM/yyyy HH:mm') : '—', status];
  });

  const csvContent = [headers, ...csvRows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${passType.toLowerCase()}-outpass-logs-${format(new Date(), 'yyyy-MM-dd')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

const exportXLSX = (rows, passType) => {
  const isLocal = passType === 'Local';
  const headers = isLocal
    ? ['Student Name', 'Reg No', 'Room', 'Destination', 'Exit Time', 'Entry Time', 'Duration', 'Status']
    : ['Student Name', 'Reg No', 'Room', 'Destination', 'Exit Date', 'Entry Date', 'Expected Return', 'Status'];

  const seen = new Set();
  const passList = [];
  rows.forEach(log => {
    const key = `${log.RegisterNumber}-${log.ExitTimestamp || log.Timestamp}`;
    if (!seen.has(key)) {
      seen.add(key);
      passList.push(log);
    }
  });

  const xlsxRows = passList.map(log => {
    const status = log.PassStatus === 'TERMINATED' ? (log.lateReturn ? 'Late Return' : 'Returned') : 'Still Out';
    const base = [
      log.StudentName, log.RegisterNumber, `Block ${log.Block} Rm ${log.RoomNumber}`,
      log.Destination,
      log.ExitTimestamp ? format(new Date(log.ExitTimestamp), 'dd/MM/yyyy HH:mm') : '—',
      log.EntryTimestamp ? format(new Date(log.EntryTimestamp), 'dd/MM/yyyy HH:mm') : '—',
    ];
    if (isLocal) return [...base, formatDuration(log.durationMinutes), status];
    return [...base, log.ExpectedReturnTime ? format(new Date(log.ExpectedReturnTime), 'dd/MM/yyyy HH:mm') : '—', status];
  });

  const ws = XLSX.utils.aoa_to_sheet([headers, ...xlsxRows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `${passType} Logs`);
  XLSX.writeFile(wb, `${passType.toLowerCase()}-outpass-logs-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
};

// ─── Approval Chain Modal (Home passes) ──────────────────────────────────────
const ApprovalChainModal = ({ log, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-purple-600 to-indigo-600">
        <span className="text-white font-bold text-base">Approval Chain — Home Outpass</span>
        <button onClick={onClose} className="text-white opacity-75 hover:opacity-100 font-bold text-lg">✕</button>
      </div>
      <div className="p-5">
        <p className="text-sm font-semibold text-gray-800 mb-1">{log.StudentName}</p>
        <p className="text-xs text-gray-400 mb-4">{log.RegisterNumber} · {log.Destination}</p>
        <div className="space-y-3">
          {[
            { step: 1, label: 'Staff Tutor', sublabel: 'Initial Review', done: true, color: 'bg-blue-500' },
            { step: 2, label: 'HOD',         sublabel: 'Academic Clearance', done: true, color: 'bg-indigo-500' },
            { step: 3, label: 'Warden',      sublabel: 'Final Approval + QR Generated', done: true, color: 'bg-purple-600' },
          ].map(({ step, label, sublabel, done, color }) => (
            <div key={step} className="flex items-center space-x-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${done ? color : 'bg-gray-200'}`}>
                {done ? '✓' : step}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800">{label} <span className="text-xs text-green-600 font-semibold">✅ Approved</span></p>
                <p className="text-xs text-gray-400">{sublabel}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-3 text-xs text-gray-500">
          {log.ExitTimestamp && <div><p className="font-medium text-gray-700">Exit</p><p>{format(new Date(log.ExitTimestamp), 'PPp')}</p></div>}
          {log.EntryTimestamp && <div><p className="font-medium text-gray-700">Entry</p><p>{format(new Date(log.EntryTimestamp), 'PPp')}</p></div>}
          {log.ExpectedReturnTime && <div><p className="font-medium text-gray-700">Expected</p><p>{format(new Date(log.ExpectedReturnTime), 'PPp')}</p></div>}
          {log.lateReturn && <div className="text-red-500 font-semibold"><p>⚠️ Late Return</p></div>}
        </div>
      </div>
    </div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
const SecurityLogs = () => {
  const [logs, setLogs]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [passType, setPassType]   = useState('Local'); // 'Local' | 'Home'
  const [search, setSearch]       = useState('');
  const [dateFrom, setDateFrom]   = useState('');
  const [dateTo, setDateTo]       = useState('');
  const [chainLog, setChainLog]   = useState(null); // for Home approval chain modal

  // Default date range: last 3 months
  const defaultFrom = new Date();
  defaultFrom.setMonth(defaultFrom.getMonth() - 3);
  const defaultFromStr = defaultFrom.toISOString().split('T')[0];

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { passType };
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo)   params.dateTo   = dateTo;
      const res = await axios.get('/api/security/logs', { params });
      setLogs(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch logs.');
    } finally {
      setLoading(false);
    }
  }, [passType, dateFrom, dateTo]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // De-duplicate logs into unique passes
  const passes = React.useMemo(() => {
    const map = new Map();
    logs.forEach(log => {
      const key = log.ExitTimestamp
        ? `${log.RegisterNumber}-${log.ExitTimestamp}`
        : `${log.RegisterNumber}-${log.Timestamp}`;
      if (!map.has(key)) map.set(key, log);
    });
    return Array.from(map.values());
  }, [logs]);

  const filtered = passes.filter(p => {
    const q = search.toLowerCase();
    return !q || p.StudentName?.toLowerCase().includes(q) || p.RegisterNumber?.toLowerCase().includes(q) || p.Destination?.toLowerCase().includes(q);
  });

  const stats = {
    total: filtered.length,
    returned: filtered.filter(p => p.PassStatus === 'TERMINATED').length,
    stillOut: filtered.filter(p => p.PassStatus === 'OUT' || p.PassStatus === 'Active').length,
    lateReturn: filtered.filter(p => p.lateReturn).length,
  };

  const isLocal = passType === 'Local';

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <ClipboardList className="mr-3 h-7 w-7 text-blue-600" />
              Security Logs
            </h1>
            <p className="text-sm text-gray-500 mt-1">3-month outpass audit history</p>
          </div>
          <div className="flex items-center space-x-2">
            <button onClick={fetchLogs}
              className="flex items-center px-3 py-2 text-sm text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
              <RefreshCw className="mr-1.5 h-4 w-4" />Refresh
            </button>
            <button onClick={() => exportCSV(filtered, passType)}
              className="flex items-center px-3 py-2 text-sm text-white bg-green-600 border border-green-700 rounded-lg hover:bg-green-700">
              <Download className="mr-1.5 h-4 w-4" />Export CSV
            </button>
            <button onClick={() => exportXLSX(filtered, passType)}
              className="flex items-center px-3 py-2 text-sm text-white bg-emerald-600 border border-emerald-700 rounded-lg hover:bg-emerald-700">
              <Download className="mr-1.5 h-4 w-4" />Export Excel
            </button>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
          {[
            { label: 'Total Passes', value: stats.total, color: 'text-gray-700', bg: 'bg-gray-50' },
            { label: 'Returned', value: stats.returned, color: 'text-green-700', bg: 'bg-green-50' },
            { label: 'Still Out', value: stats.stillOut, color: 'text-yellow-700', bg: 'bg-yellow-50' },
            { label: '⚠️ Late Returns', value: stats.lateReturn, color: 'text-red-700', bg: 'bg-red-50' },
          ].map(s => (
            <div key={s.label} className={`${s.bg} rounded-xl p-4 border border-gray-100`}>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filters Row */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-5">
          <div className="flex flex-col sm:flex-row gap-3 flex-wrap">

            {/* Type Toggle */}
            <div className="flex rounded-lg overflow-hidden border border-gray-200 self-start">
              <button onClick={() => setPassType('Local')}
                className={`flex items-center px-4 py-2 text-sm font-semibold transition-all ${isLocal ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                <MapPin className="h-4 w-4 mr-1.5" />Local
              </button>
              <button onClick={() => setPassType('Home')}
                className={`flex items-center px-4 py-2 text-sm font-semibold transition-all ${!isLocal ? 'bg-purple-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                <Home className="h-4 w-4 mr-1.5" />Home
              </button>
            </div>

            {/* Search */}
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input type="text" placeholder="Search name, reg. no, destination..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                value={search} onChange={e => setSearch(e.target.value)} />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2 top-2.5 text-gray-400 hover:text-gray-600">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Date Range */}
            <div className="flex items-center space-x-2">
              <span className="text-xs text-gray-400 font-medium whitespace-nowrap">Date range:</span>
              <input type="date" className="text-sm border border-gray-200 rounded-lg px-2 py-2 focus:ring-2 focus:ring-blue-500"
                value={dateFrom || defaultFromStr} onChange={e => setDateFrom(e.target.value)} max={dateTo || undefined} />
              <span className="text-gray-400 text-xs">to</span>
              <input type="date" className="text-sm border border-gray-200 rounded-lg px-2 py-2 focus:ring-2 focus:ring-blue-500"
                value={dateTo} onChange={e => setDateTo(e.target.value)} min={dateFrom || defaultFromStr} />
              {(dateFrom || dateTo) && (
                <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="text-xs text-blue-600 hover:underline whitespace-nowrap">Reset</button>
              )}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white shadow rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-10 text-center text-gray-400">Loading logs...</div>
          ) : error ? (
            <div className="p-10 text-center text-red-500">{error}</div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-gray-400">
              <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No {passType} outpass logs found for this range.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className={`${isLocal ? 'bg-blue-50' : 'bg-purple-50'}`}>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">#</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Student</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Reg No / Room</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Destination</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Exit Time</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Entry Time</th>
                    {isLocal && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Duration</th>}
                    {!isLocal && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Expected Return</th>}
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    {!isLocal && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Chain</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((log, i) => {
                    const returned    = log.PassStatus === 'TERMINATED';
                    const stillOut    = log.PassStatus === 'OUT' || log.PassStatus === 'Active';
                    const isLate      = log.lateReturn;
                    const rowBg       = isLate ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50';

                    return (
                      <tr key={`${log.RegisterNumber}-${i}`} className={`transition-colors ${rowBg}`}>
                        <td className="px-4 py-3 text-xs text-gray-400">{i + 1}</td>

                        <td className="px-4 py-3">
                          <p className="text-sm font-semibold text-gray-900">{log.StudentName}</p>
                        </td>

                        <td className="px-4 py-3">
                          <p className="text-xs font-mono text-gray-700">{log.RegisterNumber}</p>
                          <p className="text-xs text-gray-400">Blk {log.Block} · Rm {log.RoomNumber}</p>
                        </td>

                        <td className="px-4 py-3 text-sm text-gray-700 max-w-[140px] truncate">{log.Destination}</td>

                        <td className="px-4 py-3">
                          {log.ExitTimestamp ? (
                            <div>
                              <p className="text-xs font-medium text-red-700 flex items-center">
                                <LogOut className="h-3 w-3 mr-1" />{format(new Date(log.ExitTimestamp), 'dd MMM, p')}
                              </p>
                            </div>
                          ) : <span className="text-xs text-gray-300">—</span>}
                        </td>

                        <td className="px-4 py-3">
                          {log.EntryTimestamp ? (
                            <p className="text-xs font-medium text-green-700 flex items-center">
                              <LogIn className="h-3 w-3 mr-1" />{format(new Date(log.EntryTimestamp), 'dd MMM, p')}
                            </p>
                          ) : stillOut ? (
                            <span className="text-xs text-yellow-600 font-medium">⚡ Still Out</span>
                          ) : <span className="text-xs text-gray-300">—</span>}
                        </td>

                        {/* Duration (Local only) */}
                        {isLocal && (
                          <td className="px-4 py-3">
                            {log.durationMinutes !== null ? (
                              <span className={`text-xs font-semibold ${isLate ? 'text-red-600' : 'text-gray-700'}`}>
                                {isLate && '⚠️ '}{formatDuration(log.durationMinutes)}
                              </span>
                            ) : <span className="text-xs text-gray-300">—</span>}
                          </td>
                        )}

                        {/* Expected Return (Home only) */}
                        {!isLocal && (
                          <td className="px-4 py-3">
                            {log.ExpectedReturnTime ? (
                              <p className="text-xs text-gray-600">{format(new Date(log.ExpectedReturnTime), 'dd MMM yyyy, p')}</p>
                            ) : <span className="text-xs text-gray-300">—</span>}
                          </td>
                        )}

                        {/* Status */}
                        <td className="px-4 py-3">
                          {isLate ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">
                              <AlertTriangle className="h-3 w-3 mr-1" />Late Return
                            </span>
                          ) : returned ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                              <CheckCircle className="h-3 w-3 mr-1" />Returned
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                              ⚡ Still Out
                            </span>
                          )}
                        </td>

                        {/* Approval Chain (Home only) */}
                        {!isLocal && (
                          <td className="px-4 py-3">
                            <button onClick={() => setChainLog(log)}
                              className="text-xs text-purple-600 hover:text-purple-800 font-medium underline underline-offset-2">
                              View Path
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Table footer */}
              <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
                <p className="text-xs text-gray-400">
                  Showing <span className="font-semibold text-gray-600">{filtered.length}</span> {passType} pass record{filtered.length !== 1 ? 's' : ''}
                  {isLate => ''} — Last 3 months
                </p>
                {stats.lateReturn > 0 && (
                  <p className="text-xs text-red-600 font-semibold">⚠️ {stats.lateReturn} late return{stats.lateReturn !== 1 ? 's' : ''} detected</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Approval Chain Modal */}
      {chainLog && <ApprovalChainModal log={chainLog} onClose={() => setChainLog(null)} />}
    </Layout>
  );
};

export default SecurityLogs;
