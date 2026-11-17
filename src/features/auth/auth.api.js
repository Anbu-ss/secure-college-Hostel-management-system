import axios from 'axios';

export const loginApi = async (identifier, password) => {
  const response = await axios.post('/api/auth/login', { identifier, password });
  return response.data;
};

export const logoutApi = async () => {
  const response = await axios.post('/api/auth/logout');
  return response.data;
};

export const getMeApi = async () => {
  const response = await axios.get('/api/auth/me');
  return response.data;
};

export const forgotPasswordApi = async (identifier) => {
  const response = await axios.post('/api/auth/forgot-password', { identifier });
  return response.data;
};

export const resetPasswordApi = async (payload) => {
  const response = await axios.post('/api/auth/reset-password', payload);
  return response.data;
};

export const googleLoginApi = async (credential) => {
  const response = await axios.post('/api/auth/google-login', { credential });
  return response.data;
};

