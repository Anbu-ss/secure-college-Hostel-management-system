import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import axios from 'axios';
import { loginApi, logoutApi, getMeApi, googleLoginApi } from './auth.api';
import { getRoleDashboard } from './auth.utils';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Synchronize token and user from storage on mount
  useEffect(() => {
    let isMounted = true;

    // Safety timeout: ensure loading always resolves within 1 second
    const safetyTimer = setTimeout(() => {
      if (isMounted) setLoading(false);
    }, 1000);

    const initAuth = async () => {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const storedUser = localStorage.getItem('user') || sessionStorage.getItem('user');

      if (token) {
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        if (storedUser) {
          try {
            setUser(JSON.parse(storedUser));
          } catch (_) {}
        }
        // Verify token with backend (with 2.5s timeout)
        try {
          const res = await axios.get('/api/auth/me', { timeout: 2500 });
          if (isMounted && res.data?.authenticated && res.data?.user) {
            setUser(res.data.user);
            const storage = localStorage.getItem('token') ? localStorage : sessionStorage;
            storage.setItem('user', JSON.stringify(res.data.user));
          }
        } catch (err) {
          if (err.response && (err.response.status === 401 || err.response.status === 403)) {
            // Token expired or invalid
            logoutClient();
          }
        }
      }
      if (isMounted) {
        setLoading(false);
        clearTimeout(safetyTimer);
      }
    };

    initAuth();

    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
    };
  }, []);

  const logoutClient = useCallback(() => {
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    delete axios.defaults.headers.common['Authorization'];
  }, []);

  // Universal login function
  const login = async (identifierOrUserData, passwordOrToken, rememberMe = true) => {
    // Check if called with (userData, token) for backward compatibility
    if (typeof identifierOrUserData === 'object' && identifierOrUserData !== null) {
      const userData = identifierOrUserData;
      const token = passwordOrToken;
      setUser(userData);
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(userData));
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      return { success: true, user: userData, redirectUrl: getRoleDashboard(userData.role) };
    }

    // Standard credential login (identifier, password, rememberMe)
    const identifier = identifierOrUserData;
    const password = passwordOrToken;
    const data = await loginApi(identifier, password);

    setUser(data.user);
    const storage = rememberMe ? localStorage : sessionStorage;
    storage.setItem('token', data.token);
    storage.setItem('user', JSON.stringify(data.user));

    // Clear the opposite storage
    if (rememberMe) {
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('user');
    } else {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }

    axios.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
    return {
      success: true,
      user: data.user,
      redirectUrl: data.redirectUrl || getRoleDashboard(data.user.role)
    };
  };

  const googleLogin = async (credential) => {
    const data = await googleLoginApi(credential);
    setUser(data.user);
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    axios.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
    return {
      success: true,
      user: data.user,
      redirectUrl: data.redirectUrl || getRoleDashboard(data.user.role)
    };
  };

  const logout = async () => {
    try {
      await logoutApi();
    } catch (_) {}
    logoutClient();
  };

  const refreshSession = async () => {
    try {
      const res = await getMeApi();
      if (res.authenticated && res.user) {
        setUser(res.user);
        const storage = localStorage.getItem('token') ? localStorage : sessionStorage;
        storage.setItem('user', JSON.stringify(res.user));
        return res.user;
      }
    } catch (_) {
      logoutClient();
    }
    return null;
  };

  const value = {
    user,
    role: user?.role || null,
    loading,
    isAuthenticated: !!user,
    login,
    googleLogin,
    logout,
    refreshSession,
    getRoleDashboard
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
