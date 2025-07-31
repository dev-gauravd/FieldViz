// app/page.tsx - Updated version with OCR integration
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { BarChart3, Upload, FileText, LogOut, User } from 'lucide-react';
import { Dashboard } from '../components/Dashboard'
import OilFieldOCR from '../components/OilFieldOCR';
import EnhancedOilFieldOCR from '../components/OilFieldOCR';

function MainApp() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  const tabs = [
    { id: 'dashboard', name: '📊 Dashboard', icon: BarChart3 },
    { id: 'ocr-upload', name: '📷 OCR Upload', icon: Upload },
    { id: 'data-review', name: '📝 Data Review', icon: FileText },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'ocr-upload':
        return <EnhancedOilFieldOCR  />;
      case 'data-review':
        return <DataReviewPlaceholder />;
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
              <img src="/imgs/logo_mid.png" alt="FieldViz Logo" className="h-30 w-30 mr-1" />
              <div>
                <h1 className="text-3xl font-bold">FieldViz</h1>
                <p className="text-lg opacity-90">Where Field Data Comes to Life</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center text-white/90">
                <User className="h-4 w-4 mr-2" />
                <span>{user?.name}</span>
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
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {renderContent()}
      </main>
    </div>
  );
}

// Placeholder component for Data Review tab
function DataReviewPlaceholder() {
  return (
    <div className="bg-white rounded-lg shadow-lg p-8 text-center">
      <FileText className="mx-auto h-16 w-16 text-gray-400 mb-4" />
      <h3 className="text-xl font-semibold text-gray-900 mb-2">Data Review</h3>
      <p className="text-gray-600 mb-6">
        Review and manage your extracted field data here.
      </p>
      <p className="text-sm text-gray-500">
        This feature will show processed OCR data, allow bulk editing, and provide data validation tools.
      </p>
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <MainApp />;
}