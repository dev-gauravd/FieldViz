import axios from 'axios';
import type { LoginCredentials, User, DashboardDataPoint, Metric, OCRResult } from '../types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('fieldviz_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('fieldviz_token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: async (credentials: LoginCredentials) => {
    const response = await api.post('/auth/login', credentials);
    return response.data;
  },
  
  getProfile: async () => {
    const response = await api.get('/auth/profile');
    return response.data;
  },
};

export const dataAPI = {
  getDashboardData: async (oilFieldId = 1, days = 30) => {
    const response = await api.get(`/data/dashboard?oil_field_id=${oilFieldId}&days=${days}`);
    return response.data;
  },
  
  getCurrentMetrics: async (oilFieldId = 1) => {
    const response = await api.get(`/data/metrics?oil_field_id=${oilFieldId}`);
    return response.data;
  },
  
  saveFieldData: async (reportId: number, fieldData: OCRResult[]) => {
    const response = await api.post('/data/field-data', {
      report_id: reportId,
      field_data: fieldData
    });
    return response.data;
  },
};

export const uploadAPI = {
  uploadImages: async (formData: FormData) => {
    const response = await api.post('/upload/images', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
};

export default api;