declare global {
  interface Window {
    addNotification?: (notification: Omit<Notification, 'id' | 'timestamp'>) => void;
  }
}

export interface User {
  id: number;
  email: string;
  name: string;
  role: 'admin' | 'engineer' | 'viewer';
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface DashboardDataPoint {
  date: string;
  oil_production: number;
  gas_production: number;
  wellhead_pressure: number;
  temperature: number;
}

export interface Metric {
  current: number;
  unit: string;
  date: string;
}

export interface UploadStatus {
  id: string;
  name: string;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  progress: number;
  error?: string;
}

export interface OCRResult {
  parameter_name: string;
  parameter_value: number;
  unit: string;
  confidence_score: number;
}

