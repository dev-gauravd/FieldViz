// ================================
// COMPLETE DASHBOARD COMPONENT
// ================================

// components/Dashboard.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { dataAPI } from '../services/api';
import { TrendingUp, TrendingDown, Activity, BarChart3 } from 'lucide-react';
import { motion } from 'framer-motion';
import type { DashboardDataPoint, Metric } from '../types';

export const Dashboard: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<DashboardDataPoint[]>([]);
  const [metrics, setMetrics] = useState<{ [key: string]: Metric }>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
    // Simulate real-time updates
    const interval = setInterval(() => {
      simulateDataUpdate();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [dashboardRes, metricsRes] = await Promise.all([
        dataAPI.getDashboardData(1, 30),
        dataAPI.getCurrentMetrics(1)
      ]);

      setDashboardData(dashboardRes.data || []);
      setMetrics(metricsRes.metrics || {});
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      // Use fallback data if API fails
      setDashboardData([
        { date: '2024-07-22', oil_production: 1200, gas_production: 3800, wellhead_pressure: 2100, temperature: 185 },
        { date: '2024-07-23', oil_production: 1180, gas_production: 3750, wellhead_pressure: 2140, temperature: 183 },
        { date: '2024-07-24', oil_production: 1220, gas_production: 3900, wellhead_pressure: 2160, temperature: 187 },
        { date: '2024-07-25', oil_production: 1190, gas_production: 3820, wellhead_pressure: 2145, temperature: 184 },
        { date: '2024-07-26', oil_production: 1240, gas_production: 3950, wellhead_pressure: 2170, temperature: 189 },
        { date: '2024-07-27', oil_production: 1210, gas_production: 3870, wellhead_pressure: 2155, temperature: 186 },
        { date: '2024-07-28', oil_production: 1250, gas_production: 3920, wellhead_pressure: 2165, temperature: 188 }
      ]);
      setMetrics({
        oil_production: { current: 1250, unit: 'BBL', date: '2024-07-28' },
        gas_production: { current: 3920, unit: 'MCF', date: '2024-07-28' },
        wellhead_pressure: { current: 2165, unit: 'PSI', date: '2024-07-28' },
        temperature: { current: 188, unit: '°F', date: '2024-07-28' }
      });
    } finally {
      setLoading(false);
    }
  };

  const simulateDataUpdate = () => {
    setMetrics(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(key => {
        if (updated[key]) {
          const change = (Math.random() - 0.5) * 20; // ±10% change
          updated[key] = {
            ...updated[key],
            current: Math.max(0, updated[key].current + change)
          };
        }
      });
      return updated;
    });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const chartData = dashboardData.map(item => ({
    ...item,
    date: formatDate(item.date)
  }));

  const metricCards = [
    {
      key: 'oil_production',
      label: 'Oil Production',
      icon: '🛢️',
      color: 'from-blue-500 to-blue-600',
      textColor: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      key: 'gas_production',
      label: 'Gas Production',
      icon: '🔥',
      color: 'from-green-500 to-green-600',
      textColor: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      key: 'wellhead_pressure',
      label: 'Wellhead Pressure',
      icon: '⚡',
      color: 'from-yellow-500 to-yellow-600',
      textColor: 'text-yellow-600',
      bgColor: 'bg-yellow-50'
    },
    {
      key: 'temperature',
      label: 'Temperature',
      icon: '🌡️',
      color: 'from-red-500 to-red-600',
      textColor: 'text-red-600',
      bgColor: 'bg-red-50'
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="rounded-full h-12 w-12 border-b-2 border-blue-500"
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <motion.h1 
            className="text-3xl font-bold text-gray-900"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            Production Dashboard
          </motion.h1>
          <motion.p 
            className="text-gray-600 mt-2"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            Real-time insights from West Texas Field A
          </motion.p>
        </div>
        <motion.div 
          className="flex items-center space-x-2 bg-green-100 text-green-700 px-4 py-2 rounded-full"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-sm font-medium">Live Data</span>
        </motion.div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metricCards.map(({ key, label, icon, color, textColor, bgColor }, index) => {
          const metric = metrics[key];
          const value = metric?.current || 0;
          const unit = metric?.unit || '';
          const change = Math.random() * 10 - 5; // Demo change calculation

          return (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ y: -5, scale: 1.02 }}
              className="bg-white rounded-xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-all duration-300"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600 mb-1">{label}</p>
                  <motion.p 
                    className="text-3xl font-bold text-gray-900"
                    key={value}
                    initial={{ scale: 1.1 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    {Math.round(value).toLocaleString()}
                  </motion.p>
                  <p className="text-xs text-gray-500 mt-1">{unit}</p>
                </div>
                <div className="text-4xl ml-4">{icon}</div>
              </div>
              <div className="mt-4 flex items-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.3 + index * 0.1 }}
                  className="flex items-center"
                >
                  {change >= 0 ? (
                    <TrendingUp className="h-4 w-4 text-green-500" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-500" />
                  )}
                  <span className={`text-sm ml-1 font-medium ${
                    change >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {change >= 0 ? '+' : ''}{change.toFixed(1)}%
                  </span>
                </motion.div>
                <span className="text-sm text-gray-500 ml-2">from yesterday</span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Chart */}
      <motion.div 
        className="bg-white rounded-xl shadow-lg p-8 border border-gray-100"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Production Trends - Last 7 Days</h2>
          <img src="/imgs/logo_mid.png" alt="FieldViz Logo" className="h-30 w-30 mr-3" />
        </div>
        
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="date" 
              stroke="#666"
              fontSize={12}
            />
            <YAxis stroke="#666" fontSize={12} />
            <Tooltip 
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
              }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="oil_production"
              stroke="#3b82f6"
              strokeWidth={3}
              name="Oil Production (BBL)"
              dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 2 }}
            />
            <Line
              type="monotone"
              dataKey="gas_production"
              stroke="#10b981"
              strokeWidth={3}
              name="Gas Production (MCF)"
              dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, stroke: '#10b981', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </motion.div>
    </div>
  );
};
