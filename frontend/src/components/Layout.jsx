import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { LogOut, Home, ClipboardList, Shield, FileText, CheckCircle, Users, Bell, MapPin, LayoutDashboard, Sun, Upload, Zap } from 'lucide-react';

const NotificationBell = () => {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // poll every 30s
    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await axios.get('/api/security/notifications');
      setNotifications(res.data);
    } catch {}
  };

  const markRead = async () => {
    try {
      await axios.put('/api/security/notifications/read');
      setNotifications(prev => prev.map(n => ({ ...n, IsRead: 1 })));
    } catch {}
  };

  const unread = notifications.filter(n => !n.IsRead).length;

  return (
    <>
      {/* Bell Button */}
      <button
        onClick={() => { setOpen(true); if (unread > 0) markRead(); }}
        className="relative p-2 rounded-full hover:bg-gray-100 transition"
      >
        <Bell className="h-5 w-5 text-gray-500" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Centered Modal Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-blue-600 to-indigo-600">
              <div className="flex items-center space-x-2">
                <Bell className="h-5 w-5 text-white" />
                <span className="text-base font-bold text-white">Notifications</span>
                {unread > 0 && (
                  <span className="text-xs bg-white text-blue-600 font-bold px-2 py-0.5 rounded-full">
                    {unread} new
                  </span>
                )}
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-white opacity-75 hover:opacity-100 text-xl leading-none font-bold"
              >
                ✕
              </button>
            </div>

            {/* List */}
            <div className="overflow-y-auto" style={{ maxHeight: '60vh' }}>
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                  <Bell className="h-10 w-10 mb-3 opacity-30" />
                  <p className="text-sm font-medium">No notifications yet</p>
                  <p className="text-xs mt-1">You'll see updates here when passes are approved or scanned.</p>
                </div>
              ) : (
                notifications.map((n, i) => (
                  <div
                    key={n.ID}
                    className={`flex items-start px-5 py-4 border-b border-gray-50 transition-colors ${
                      !n.IsRead ? 'bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    {/* Unread dot */}
                    <div className={`mt-1.5 mr-3 w-2 h-2 rounded-full flex-shrink-0 ${!n.IsRead ? 'bg-blue-500' : 'bg-gray-200'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 leading-snug">{n.Message}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(n.CreatedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex justify-between items-center">
                <span className="text-xs text-gray-400">{notifications.length} total notification{notifications.length !== 1 ? 's' : ''}</span>
                <button
                  onClick={() => setOpen(false)}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [pendingCount, setPendingCount] = useState(0);

  // Which nav path gets the badge, keyed by role
  const badgePathByRole = {
    Staff:  '/staff/pending',
    HOD:    '/hod/pending',
    Warden: '/warden/approvals',
    Admin:  '/warden/approvals',
  };

  const pendingEndpointByRole = {
    Staff:  '/api/requests/staff/pending',
    HOD:    '/api/requests/hod/pending',
    Warden: '/api/requests/warden/pending',
    Admin:  '/api/requests/warden/pending',
  };

  useEffect(() => {
    const endpoint = pendingEndpointByRole[user?.role];
    if (!endpoint) return;

    const fetchCount = async () => {
      try {
        const res = await axios.get(endpoint);
        setPendingCount(Array.isArray(res.data) ? res.data.length : 0);
      } catch {}
    };

    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, [user?.role]);

  const handleLogout = () => { logout(); navigate('/login'); };

  const getNavLinks = () => {
    switch (user?.role) {
      case 'Student':
        return [
          { name: 'Apply Pass', path: '/student/apply', icon: FileText },
          { name: 'My Passes', path: '/student/passes', icon: ClipboardList },
        ];
      case 'Staff':
        return [
          { name: 'Pending Requests', path: '/staff/pending', icon: ClipboardList },
          { name: 'Bulk Student Upload', path: '/admin/bulk-upload', icon: Upload },
        ];
      case 'HOD':
        return [
          { name: 'Final Approvals',  path: '/hod/pending',     icon: CheckCircle },
          { name: 'Holiday Mode',     path: '/admin/holiday-mode', icon: Sun },
        ];
      case 'Warden':
        return [
          { name: 'Occupancy Map',     path: '/warden/dashboard',   icon: LayoutDashboard },
          { name: 'Approve Requests',  path: '/warden/approvals',   icon: CheckCircle },
          { name: 'All Passes',        path: '/warden/passes',      icon: Users },
          { name: 'Security Logs',     path: '/security/logs',      icon: Shield },
          { name: 'Create Admin User', path: '/admin/create-user',  icon: Users },
          { name: 'Bulk Upload',       path: '/admin/bulk-upload',   icon: Upload },
          { name: 'Holiday Mode',      path: '/admin/holiday-mode',  icon: Sun },
        ];
      case 'Security':
        return [
          { name: 'Scan QR', path: '/security/scan', icon: CheckCircle },
          { name: 'Gate Logs', path: '/security/logs', icon: ClipboardList },
        ];
      default:
        return [];
    }
  };

  const navLinks = getNavLinks();

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-64 bg-white shadow-md flex flex-col hidden md:flex">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-primary-600">Secure Hostel</h2>
          <p className="text-xs text-gray-500 mt-1 capitalize">{user?.role} Portal</p>
        </div>

        <div className="flex-1 overflow-y-auto py-4">
          <nav className="space-y-1 px-2">
            {navLinks.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path ||
                (item.path !== '/dashboard' && location.pathname.startsWith(item.path));
              const showBadge = item.path === badgePathByRole[user?.role] && pendingCount > 0;
              return (
                <Link
                  key={item.name} to={item.path}
                  className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                    isActive ? 'bg-primary-50 text-primary-600' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <Icon className={`mr-3 flex-shrink-0 h-5 w-5 ${isActive ? 'text-primary-600' : 'text-gray-400 group-hover:text-gray-500'}`} />
                  <span className="flex-1">{item.name}</span>
                  {showBadge && (
                    <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold bg-red-500 text-white animate-pulse">
                      {pendingCount > 99 ? '99+' : pendingCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-medium text-gray-700">{user?.name}</p>
              <p className="text-xs font-medium text-gray-500">{user?.email}</p>
            </div>
            <NotificationBell />
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center w-full px-2 py-2 text-sm font-medium text-red-600 rounded-md hover:bg-red-50"
          >
            <LogOut className="mr-3 h-5 w-5 text-red-500" />Logout
          </button>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Header */}
        <header className="bg-white shadow-sm md:hidden">
          <div className="px-4 py-3 flex justify-between items-center">
            <h2 className="text-lg font-bold text-primary-600">Secure Hostel</h2>
            <div className="flex items-center space-x-2">
              <NotificationBell />
              <button onClick={handleLogout} className="text-red-600 hover:text-red-800">
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
