'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { BarChart3, Upload, FileText, LogOut, User, Activity, Settings } from 'lucide-react';
import { Dashboard } from '../components/Dashboard';
import EnhancedOilFieldOCR from '../components/EnhancedOilFieldOCR';
import DataValidationReview from '../components/DataValidationReview';
import AnalyticsDashboard from '../components/AnalyticsDashboard';

function MainApp() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [notifications, setNotifications] = useState<any[]>([]);

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  // Check for notifications on component mount
  useEffect(() => {
    fetchNotifications();
    // Set up periodic notification checks
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3001/api/notifications', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  };

  const tabs = [
    { id: 'dashboard', name: '📊 Dashboard', icon: BarChart3, description: 'Production overview and key metrics' },
    { id: 'ocr-upload', name: '📷 OCR Upload', icon: Upload, description: 'Upload and process field data images' },
    { id: 'data-review', name: '✅ Data Review', icon: FileText, description: 'Validate and verify extracted data' },
    { id: 'analytics', name: '📈 Analytics', icon: Activity, description: 'Advanced data analysis and insights' },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'ocr-upload':
        return <EnhancedOilFieldOCR />;
      case 'data-review':
        return <DataValidationReview />;
      case 'analytics':
        return <AnalyticsDashboard />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <img src="/imgs/logo_mid.png" alt="FieldViz Logo" className="h-12 w-12 mr-3" />
              <div>
                <h1 className="text-3xl font-bold">FieldViz</h1>
                <p className="text-lg opacity-90">Intelligent Oil Field Data Management</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-6">
              {notifications.length > 0 && (
                <div className="relative">
                  <button className="relative p-2 text-white/80 hover:text-white transition-colors">
                    <Activity className="h-5 w-5" />
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {notifications.length}
                    </span>
                  </button>
                </div>
              )}
              
              <div className="flex items-center text-white/90">
                <User className="h-4 w-4 mr-2" />
                <div className="text-right">
                  <div className="font-medium">{user?.name}</div>
                  <div className="text-sm opacity-75">{user?.role}</div>
                </div>
              </div>
              
              <button
                onClick={handleLogout}
                className="flex items-center text-white/80 hover:text-white transition-colors"
              >
                <LogOut className="h-4 w-4 mr-1" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8 -mb-px">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`group py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center">
                  <tab.icon className="h-4 w-4 mr-2" />
                  {tab.name}
                </div>
                {activeTab === tab.id && (
                  <div className="text-xs text-gray-500 mt-1">
                    {tab.description}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {renderContent()}
      </main>

      {/* Footer with system status */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <div>
              FieldViz OCR System © 2024 - Processing oil field data with AI
            </div>
            <div className="flex items-center space-x-4">
              <span className="flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                System Online
              </span>
              <span>Last updated: {new Date().toLocaleTimeString()}</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function DashboardPage() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      window.location.href = '/login';
    }
  }, [user, loading]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading FieldViz...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <MainApp />;
}
