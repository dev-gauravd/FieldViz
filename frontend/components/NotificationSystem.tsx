// ================================
// NOTIFICATION SYSTEM (FIXED)
// ================================

// components/NotificationSystem.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { X, CheckCircle, AlertTriangle, Info, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Notification {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  title: string;
  message: string;
  timestamp: Date;
  autoHide?: boolean;
  duration?: number;
}

const NotificationSystem: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'timestamp'>) => {
    const newNotification: Notification = {
      ...notification,
      id: Math.random().toString(36),
      timestamp: new Date(),
      autoHide: notification.autoHide ?? true,
      duration: notification.duration ?? 5000
    };

    setNotifications(prev => [...prev, newNotification]);

    if (newNotification.autoHide) {
      setTimeout(() => {
        removeNotification(newNotification.id);
      }, newNotification.duration);
    }
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'success': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'warning': return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'error': return <XCircle className="h-5 w-5 text-red-500" />;
      case 'info': return <Info className="h-5 w-5 text-blue-500" />;
    }
  };

  const getStyles = (type: Notification['type']) => {
    switch (type) {
      case 'success': return 'bg-green-50 border-green-200 text-green-800';
      case 'warning': return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'error': return 'bg-red-50 border-red-200 text-red-800';
      case 'info': return 'bg-blue-50 border-blue-200 text-blue-800';
    }
  };

  // Expose addNotification globally with proper typing and dependency
  useEffect(() => {
    window.addNotification = addNotification;
    return () => {
      delete window.addNotification;
    };
  }, [addNotification]);

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      <AnimatePresence>
        {notifications.map((notification) => (
          <motion.div
            key={notification.id}
            initial={{ opacity: 0, x: 300, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 300, scale: 0.8 }}
            className={`max-w-sm p-4 rounded-lg border shadow-lg ${getStyles(notification.type)}`}
          >
            <div className="flex items-start">
              <div className="flex-shrink-0">
                {getIcon(notification.type)}
              </div>
              <div className="ml-3 flex-1">
                <h4 className="text-sm font-medium">{notification.title}</h4>
                <p className="text-sm mt-1 opacity-90">{notification.message}</p>
              </div>
              <button
                onClick={() => removeNotification(notification.id)}
                className="ml-2 flex-shrink-0 opacity-60 hover:opacity-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default NotificationSystem;