import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import Layout from '../../components/Layout';
import {
  CalendarDays, Plus, Zap, Trash2, CheckCircle2, XCircle,
  Users, ChevronDown, ChevronUp, Sparkles, Sun, AlertCircle, RefreshCw
} from 'lucide-react';

const API = '/api/requests';

const formatDate = (d) =>
  new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const isActiveNow = (win) => {
  const today = new Date().toISOString().split('T')[0];
  return win.IsActive && win.StartDate <= today && win.EndDate >= today;
};

const isUpcoming = (win) => {
  const today = new Date().toISOString().split('T')[0];
  return win.IsActive && win.StartDate > today;
};

/* ─── Toast helper ─────────────────────────────────────────────────────────── */
const Toast = ({ msg, type, onClose }) => {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);
  const colors = type === 'success'
    ? 'bg-emerald-600 text-white'
    : type === 'error'
      ? 'bg-red-600 text-white'
      : 'bg-amber-500 text-white';
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl ${colors} animate-slide-up`}>
      {type === 'success' ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <AlertCircle className="h-5 w-5 shrink-0" />}
      <span className="text-sm font-medium">{msg}</span>
      <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100">✕</button>
    </div>
  );
};

/* ─── Window Card ──────────────────────────────────────────────────────────── */
const WindowCard = ({ win, onToggle, onBulkApply, bulkLoading }) => {
  const nowActive = isActiveNow(win);
  const upcoming = isUpcoming(win);
  const [expanded, setExpanded] = useState(false);

  const badgeClass = nowActive
    ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
    : upcoming
      ? 'bg-blue-100 text-blue-700 border-blue-200'
      : win.IsActive
        ? 'bg-gray-100 text-gray-500 border-gray-200'
        : 'bg-red-50 text-red-500 border-red-200';

  const badgeLabel = nowActive ? 'Active Now' : upcoming ? 'Upcoming' : win.IsActive ? 'Expired' : 'Disabled';

  return (
    <div className={`relative bg-white rounded-2xl border-2 shadow-sm transition-all duration-200 overflow-hidden
      ${nowActive ? 'border-emerald-300 shadow-emerald-100' : 'border-gray-100'}`}>

      {/* Glowing pulse for currently active */}
      {nowActive && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-400" />
      )}

      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${badgeClass}`}>
                {badgeLabel}
              </span>
              {nowActive && <Sparkles className="h-4 w-4 text-amber-400 animate-pulse" />}
            </div>
            <h3 className="text-base font-bold text-gray-900 mt-1 truncate">{win.Name}</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              <CalendarDays className="inline h-3.5 w-3.5 mr-1 text-gray-400" />
              {formatDate(win.StartDate)} — {formatDate(win.EndDate)}
            </p>
          </div>

          <div className="flex flex-col items-end gap-2 shrink-0">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-purple-700 bg-purple-50 border border-purple-100 rounded-xl px-3 py-1.5">
              <Users className="h-4 w-4" />
              {win.AutoApprovedCount ?? 0} fast-tracked
            </div>
            <button onClick={() => setExpanded(e => !e)} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              {expanded ? 'less' : 'actions'}
            </button>
          </div>
        </div>

        {win.CreatedByName && (
          <p className="text-xs text-gray-400 mt-2">Created by {win.CreatedByName}</p>
        )}

        {/* Expandable actions */}
        {expanded && (
          <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap gap-2">
            {/* Bulk Apply */}
            <button
              id={`bulk-apply-${win.ID}`}
              onClick={() => onBulkApply(win)}
              disabled={bulkLoading === win.ID}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold
                bg-gradient-to-r from-violet-600 to-purple-600 text-white
                hover:from-violet-700 hover:to-purple-700 disabled:opacity-60 transition-all shadow-sm"
            >
              {bulkLoading === win.ID
                ? <RefreshCw className="h-4 w-4 animate-spin" />
                : <Zap className="h-4 w-4" />}
              {bulkLoading === win.ID ? 'Applying...' : 'Bulk Apply to Existing'}
            </button>

            {/* Toggle active/disable */}
            <button
              id={`toggle-window-${win.ID}`}
              onClick={() => onToggle(win)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-all
                ${win.IsActive
                  ? 'border-red-200 text-red-600 bg-red-50 hover:bg-red-100'
                  : 'border-green-200 text-green-700 bg-green-50 hover:bg-green-100'}`}
            >
              {win.IsActive ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
              {win.IsActive ? 'Disable Window' : 'Re-enable'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

/* ─── Main Page ───────────────────────────────────────────────────────────── */
const HolidayMode = () => {
  const [windows, setWindows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bulkLoading, setBulkLoading] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [toast, setToast] = useState(null);

  const [form, setForm] = useState({
    name: '',
    startDate: '',
    endDate: '',
  });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const showToast = (msg, type = 'success') => setToast({ msg, type });

  const fetchWindows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/admin/holiday-windows`);
      setWindows(res.data);
    } catch (e) {
      showToast('Could not load holiday windows.', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchWindows(); }, [fetchWindows]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.name.trim() || !form.startDate || !form.endDate) {
      setFormError('All fields are required.');
      return;
    }
    if (form.startDate > form.endDate) {
      setFormError('Start date must be before or on the end date.');
      return;
    }
    setSubmitting(true);
    try {
      await axios.post(`${API}/admin/holiday-windows`, {
        name: form.name.trim(),
        startDate: form.startDate,
        endDate: form.endDate,
      });
      showToast(`Holiday window "${form.name}" created! 🎉`);
      setForm({ name: '', startDate: '', endDate: '' });
      setShowForm(false);
      fetchWindows();
    } catch (e) {
      showToast(e.response?.data?.message || 'Failed to create window.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (win) => {
    try {
      const res = await axios.delete(`${API}/admin/holiday-windows/${win.ID}`);
      showToast(res.data.message, 'info');
      fetchWindows();
    } catch (e) {
      showToast('Failed to update window.', 'error');
    }
  };

  const handleBulkApply = async (win) => {
    setBulkLoading(win.ID);
    try {
      const res = await axios.post(`${API}/admin/holiday-windows/${win.ID}/apply-bulk`, {});
      showToast(`${res.data.message}`, 'success');
      fetchWindows();
    } catch (e) {
      showToast(e.response?.data?.message || 'Bulk apply failed.', 'error');
    } finally {
      setBulkLoading(null);
    }
  };

  const activeNow = windows.filter(w => isActiveNow(w));
  const upcoming  = windows.filter(w => isUpcoming(w));
  const past      = windows.filter(w => !isActiveNow(w) && !isUpcoming(w));

  return (
    <Layout>
      <style>{`
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-up { animation: slide-up 0.3s ease-out; }
      `}</style>

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div className="max-w-4xl mx-auto">

        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sun className="h-6 w-6 text-amber-400" />
              <h1 className="text-2xl font-bold text-gray-900">Holiday Mode</h1>
            </div>
            <p className="text-sm text-gray-500">
              Define vacation windows to automatically fast-track home outpass requests,
              bypassing the Staff/HOD queues straight to Warden final approval.
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={fetchWindows} className="p-2 rounded-xl border border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-all">
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              id="create-holiday-window-btn"
              onClick={() => setShowForm(s => !s)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold
                bg-gradient-to-r from-amber-500 to-orange-500 text-white
                hover:from-amber-600 hover:to-orange-600 shadow-sm transition-all"
            >
              <Plus className="h-4 w-4" />
              New Holiday Window
            </button>
          </div>
        </div>

        {/* ── Info Banner ── */}
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6">
          <Zap className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <strong>How it works:</strong> When a student applies for a Home Outpass and their departure date falls inside an active Holiday Window, the system automatically promotes their request to <em>Warden Approval</em> — skipping Staff and HOD queues entirely.
            Use <strong>Bulk Apply</strong> to retroactively fast-track students who already applied before the window was created.
          </div>
        </div>

        {/* ── Create Form ── */}
        {showForm && (
          <div className="bg-white rounded-2xl border-2 border-amber-200 shadow-lg p-6 mb-6 animate-slide-up">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-amber-500" />
              Create Holiday Window
            </h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Window Name</label>
                <input
                  id="holiday-window-name"
                  type="text"
                  placeholder="e.g. Diwali Vacation 2025"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-amber-400 focus:border-transparent outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Start Date</label>
                  <input
                    id="holiday-window-start"
                    type="date"
                    value={form.startDate}
                    onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-amber-400 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">End Date</label>
                  <input
                    id="holiday-window-end"
                    type="date"
                    value={form.endDate}
                    onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-amber-400 focus:border-transparent outline-none"
                  />
                </div>
              </div>
              {formError && (
                <p className="text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" /> {formError}
                </p>
              )}
              <div className="flex gap-3 pt-1">
                <button
                  id="submit-holiday-window"
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold
                    bg-gradient-to-r from-amber-500 to-orange-500 text-white
                    hover:from-amber-600 hover:to-orange-600 disabled:opacity-60 transition-all shadow-sm"
                >
                  {submitting ? 'Creating...' : '🎉 Create Window'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setFormError(''); }}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Window Lists ── */}
        {loading ? (
          <div className="text-center py-16 text-gray-400">Loading holiday windows...</div>
        ) : windows.length === 0 ? (
          <div className="text-center py-16">
            <Sun className="h-12 w-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">No holiday windows yet. Create one above!</p>
          </div>
        ) : (
          <div className="space-y-6">

            {/* Active Now */}
            {activeNow.length > 0 && (
              <section>
                <h2 className="text-xs font-bold uppercase tracking-widest text-emerald-600 mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block" />
                  Active Now ({activeNow.length})
                </h2>
                <div className="space-y-3">
                  {activeNow.map(w => (
                    <WindowCard key={w.ID} win={w} onToggle={handleToggle} onBulkApply={handleBulkApply} bulkLoading={bulkLoading} />
                  ))}
                </div>
              </section>
            )}

            {/* Upcoming */}
            {upcoming.length > 0 && (
              <section>
                <h2 className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-3 flex items-center gap-2">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Upcoming ({upcoming.length})
                </h2>
                <div className="space-y-3">
                  {upcoming.map(w => (
                    <WindowCard key={w.ID} win={w} onToggle={handleToggle} onBulkApply={handleBulkApply} bulkLoading={bulkLoading} />
                  ))}
                </div>
              </section>
            )}

            {/* Past / Disabled */}
            {past.length > 0 && (
              <section>
                <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
                  Past / Disabled ({past.length})
                </h2>
                <div className="space-y-3">
                  {past.map(w => (
                    <WindowCard key={w.ID} win={w} onToggle={handleToggle} onBulkApply={handleBulkApply} bulkLoading={bulkLoading} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default HolidayMode;
