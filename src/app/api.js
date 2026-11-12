// src/app/api.js - Centralized Axios Client
import axios from 'axios';
import { APP_CONFIG } from './app.config';

const api = axios.create({
  baseURL: APP_CONFIG.apiUrl,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;

