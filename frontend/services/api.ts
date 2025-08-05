// src/services/api.ts
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

// Helper function to get auth headers
const getAuthHeaders = () => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` })
  };
};

// Helper function to get auth headers for file uploads
const getAuthHeadersForUpload = () => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return {
    ...(token && { 'Authorization': `Bearer ${token}` })
  };
};

// Helper function to handle API responses
const handleResponse = async (response: Response) => {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Network error' }));
    throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
  }
  return response.json();
};

// ================================
// AUTHENTICATION API
// ================================
export const authAPI = {
  login: async (email: string, password: string) => {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    return handleResponse(response);
  },

  getProfile: async () => {
    const response = await fetch(`${API_BASE}/auth/profile`, {
      headers: getAuthHeaders()
    });
    return handleResponse(response);
  },

  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
    }
  }
};

// ================================
// DASHBOARD DATA API
// ================================
export const dashboardAPI = {
  getDashboardData: async (fieldId?: number, days: number = 30) => {
    const params = new URLSearchParams();
    if (fieldId) params.append('field_id', fieldId.toString());
    params.append('days', days.toString());
    
    const response = await fetch(`${API_BASE}/data/dashboard?${params}`, {
      headers: getAuthHeaders()
    });
    return handleResponse(response);
  },

  getCurrentMetrics: async (fieldId?: number) => {
    const params = new URLSearchParams();
    if (fieldId) params.append('field_id', fieldId.toString());
    
    const response = await fetch(`${API_BASE}/data/metrics?${params}`, {
      headers: getAuthHeaders()
    });
    return handleResponse(response);
  }
};

// ================================
// FIELD DATA API
// ================================
export const fieldDataAPI = {
  // Save tabular OCR data
  saveTabularData: async (data: {
    extractedData: any[];
    uploadedAt: string;
    processingMethod: string;
    reportDate: string;
    fieldName: string;
    totalWells: number;
    totalParameters: number;
    imageMetadata?: any;
  }) => {
    const response = await fetch(`${API_BASE}/field-data/tabular`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(response);
  },

  // Save simple field data (legacy format)
  saveFieldData: async (data: {
    extractedData: any[];
    uploadedAt: string;
    processingMethod: string;
    reportDate: string;
    fieldName: string;
  }) => {
    const response = await fetch(`${API_BASE}/field-data`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(response);
  },

  // Get enhanced reports list
  getEnhancedReports: async (params: {
    page?: number;
    limit?: number;
    field_id?: number;
    date_from?: string;
    date_to?: string;
    status?: string;
    min_confidence?: number;
  } = {}) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.append(key, value.toString());
      }
    });

    const response = await fetch(`${API_BASE}/field-data/reports/enhanced?${searchParams}`, {
      headers: getAuthHeaders()
    });
    return handleResponse(response);
  },

  // Get detailed report
  getDetailedReport: async (reportId: number) => {
    const response = await fetch(`${API_BASE}/field-data/reports/${reportId}/detailed`, {
      headers: getAuthHeaders()
    });
    return handleResponse(response);
  },

  // Bulk update field data
  bulkUpdateFieldData: async (updates: Array<{
    id: number;
    value: string;
    unit: string;
    isVerified: boolean;
  }>) => {
    const response = await fetch(`${API_BASE}/field-data/bulk-update`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ updates })
    });
    return handleResponse(response);
  },

  // Update single field data item
  updateFieldData: async (dataId: number, data: {
    value?: string;
    unit?: string;
    confidence?: number;
  }) => {
    const response = await fetch(`${API_BASE}/field-data/${dataId}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(response);
  },

  // Delete field data item
  deleteFieldData: async (dataId: number) => {
    const response = await fetch(`${API_BASE}/field-data/${dataId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    return handleResponse(response);
  },

  // Bulk approve field data
  bulkApprove: async (dataIds: number[], minConfidence: number = 0.8) => {
    const response = await fetch(`${API_BASE}/field-data/bulk-approve`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ dataIds, minConfidence })
    });
    return handleResponse(response);
  },

  // Get validation report
  getValidationReport: async (reportId: number) => {
    const response = await fetch(`${API_BASE}/field-data/validation-report/${reportId}`, {
      headers: getAuthHeaders()
    });
    return handleResponse(response);
  },

  // Export data
  exportData: async (reportId: number, options: {
    format?: 'csv' | 'json';
    include_unverified?: boolean;
  } = {}) => {
    const params = new URLSearchParams();
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined) {
        params.append(key, value.toString());
      }
    });

    const response = await fetch(`${API_BASE}/field-data/export/${reportId}?${params}`, {
      headers: getAuthHeaders()
    });

    if (options.format === 'csv') {
      const blob = await response.blob();
      return blob;
    }
    
    return handleResponse(response);
  }
};

// ================================
// ANALYTICS API
// ================================
export const analyticsAPI = {
  // Get enhanced statistics
  getEnhancedStats: async (params: {
    field_id?: number;
    date_from?: string;
    date_to?: string;
  } = {}) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.append(key, value.toString());
      }
    });

    const response = await fetch(`${API_BASE}/field-data/enhanced-stats?${searchParams}`, {
      headers: getAuthHeaders()
    });
    return handleResponse(response);
  },

  // Get production trends
  getProductionTrends: async (params: {
    field_id?: number;
    date_from?: string;
    date_to?: string;
    well_ids?: string;
  } = {}) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.append(key, value.toString());
      }
    });

    const response = await fetch(`${API_BASE}/analytics/production-trends?${searchParams}`, {
      headers: getAuthHeaders()
    });
    return handleResponse(response);
  },

  // Export analytics data
  exportAnalytics: async (params: {
    format?: 'csv' | 'json';
    date_from?: string;
    date_to?: string;
    field_id?: number;
  } = {}) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.append(key, value.toString());
      }
    });

    const response = await fetch(`${API_BASE}/field-data/export-analytics?${searchParams}`, {
      headers: getAuthHeaders()
    });

    if (params.format === 'csv') {
      const blob = await response.blob();
      return blob;
    }
    
    return handleResponse(response);
  }
};

// ================================
// UPLOAD API
// ================================
export const uploadAPI = {
  // Upload images for OCR processing
  uploadImages: async (files: FileList | File[], reportId?: number, metadata?: any) => {
    const formData = new FormData();
    
    Array.from(files).forEach((file, index) => {
      formData.append('images', file);
    });

    if (reportId) {
      formData.append('reportId', reportId.toString());
    }

    if (metadata) {
      formData.append('metadata', JSON.stringify(metadata));
    }

    const response = await fetch(`${API_BASE}/upload/images`, {
      method: 'POST',
      headers: getAuthHeadersForUpload(),
      body: formData
    });
    return handleResponse(response);
  },

  // Upload enhanced images with preprocessing info
  uploadEnhancedImages: async (file: File, options: {
    reportId?: number;
    imageWidth?: number;
    imageHeight?: number;
    preprocessing?: string;
  } = {}) => {
    const formData = new FormData();
    formData.append('image', file);
    
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined) {
        formData.append(key, value.toString());
      }
    });

    const response = await fetch(`${API_BASE}/upload/enhanced-images`, {
      method: 'POST',
      headers: getAuthHeadersForUpload(),
      body: formData
    });
    return handleResponse(response);
  }
};

// ================================
// VALIDATION API
// ================================
export const validationAPI = {
  // Get validation rules
  getRules: async () => {
    const response = await fetch(`${API_BASE}/validation/rules`, {
      headers: getAuthHeaders()
    });
    return handleResponse(response);
  },

  // Create validation rule
  createRule: async (rule: {
    parameter_name: string;
    rule_type: 'range' | 'format' | 'dependency' | 'consistency';
    rule_definition: any;
    severity: 'error' | 'warning' | 'info';
  }) => {
    const response = await fetch(`${API_BASE}/validation/rules`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(rule)
    });
    return handleResponse(response);
  },

  // Update validation rule
  updateRule: async (ruleId: number, updates: any) => {
    const response = await fetch(`${API_BASE}/validation/rules/${ruleId}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(updates)
    });
    return handleResponse(response);
  },

  // Delete validation rule
  deleteRule: async (ruleId: number) => {
    const response = await fetch(`${API_BASE}/validation/rules/${ruleId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    return handleResponse(response);
  }
};

// ================================
// SYSTEM API
// ================================
export const systemAPI = {
  // Health check
  getHealth: async () => {
    const response = await fetch(`${API_BASE}/health`);
    return handleResponse(response);
  },

  // Get fields and wells for dropdowns
  getFieldsWells: async () => {
    const response = await fetch(`${API_BASE}/fields-wells`, {
      headers: getAuthHeaders()
    });
    return handleResponse(response);
  },

  // Get notifications
  getNotifications: async () => {
    const response = await fetch(`${API_BASE}/notifications`, {
      headers: getAuthHeaders()
    });
    return handleResponse(response);
  },

  // Log error
  logError: async (errorDetails: any) => {
    try {
      const response = await fetch(`${API_BASE}/logs/error`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(errorDetails)
      });
      return handleResponse(response);
    } catch (error) {
      console.error('Failed to log error to server:', error);
    }
  }
};

// ================================
// COMBINED API OBJECT (for convenience)
// ================================
export const api = {
  auth: authAPI,
  dashboard: dashboardAPI,
  fieldData: fieldDataAPI,
  analytics: analyticsAPI,
  upload: uploadAPI,
  validation: validationAPI,
  system: systemAPI
};

// ================================
// UTILITY FUNCTIONS
// ================================
export const apiUtils = {
  // Check if user is authenticated
  isAuthenticated: () => {
    return typeof window !== 'undefined' && !!localStorage.getItem('token');
  },

  // Get current user from token (basic JWT decode)
  getCurrentUser: () => {
    if (typeof window === 'undefined') return null;
    
    const token = localStorage.getItem('token');
    if (!token) return null;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload;
    } catch (error) {
      console.error('Failed to decode token:', error);
      return null;
    }
  },

  // Download blob as file
  downloadBlob: (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  // Format API errors for display
  formatError: (error: any): string => {
    if (typeof error === 'string') return error;
    if (error.message) return error.message;
    if (error.error) return error.error;
    return 'An unexpected error occurred';
  },

  // Retry API call with exponential backoff
  retryApiCall: async <T>(
    apiCall: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> => {
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await apiCall();
      } catch (error) {
        lastError = error;
        
        if (attempt === maxRetries) {
          throw error;
        }

        // Don't retry certain types of errors
        if (error instanceof Error) {
          const message = error.message.toLowerCase();
          if (message.includes('unauthorized') || 
              message.includes('forbidden') || 
              message.includes('not found')) {
            throw error;
          }
        }

        // Wait before retrying (exponential backoff)
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }
};

export const dataAPI = {
  getDashboardData: async (fieldId: number, days: number = 30) => {
    const response = await fetch(`${API_BASE}/data/dashboard?field_id=${fieldId}&days=${days}`, {
      headers: getAuthHeaders()
    });
    return response.json();
  },

  getCurrentMetrics: async (fieldId: number) => {
    const response = await fetch(`${API_BASE}/data/metrics?field_id=${fieldId}`, {
      headers: getAuthHeaders()
    });
    return response.json();
  }
};

// Export everything as default for convenience
export default api;