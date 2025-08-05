'use client';

import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell,
  AreaChart, Area, ScatterChart, Scatter
} from 'recharts';
import { 
  TrendingUp, TrendingDown, Activity, AlertTriangle, 
  CheckCircle2, Clock, Filter, Download, RefreshCw,
  Eye, Database, Zap, BarChart3
} from 'lucide-react';
import { motion } from 'framer-motion';

// Types for analytics data
interface AnalyticsData {
  overview: {
    totalReports: number;
    totalWells: number;
    totalParameters: number;
    avgConfidence: number;
    verificationRate: number;
    uniqueDates: number;
  };
  parameterDistribution: Array<{
    name: string;
    count: number;
    avgConfidence: number;
    verificationRate: number;
    valueRange: {
      min: number;
      max: number;
      avg: number;
    };
  }>;
  topWells: Array<{
    wellName: string;
    apiNumber: string;
    fieldName: string;
    parameterCount: number;
    avgConfidence: number;
    avgOilProduction: number;
  }>;
  monthlyTrends: Array<{
    month: string;
    reportsCount: number;
    wellsCount: number;
    parametersCount: number;
    avgConfidence: number;
  }>;
}

interface ProductionTrend {
  date: string;
  oil_production: number;
  gas_production: number;
  water_production: number;
  wells_count: number;
  avg_confidence: number;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];

const AnalyticsDashboard: React.FC = () => {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [productionTrends, setProductionTrends] = useState<ProductionTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedField, setSelectedField] = useState<string>('all');
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0]
  });
  const [fields, setFields] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchAnalyticsData();
    fetchFields();
  }, [selectedField, dateRange]);

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      const params = new URLSearchParams({
        date_from: dateRange.from,
        date_to: dateRange.to,
        ...(selectedField !== 'all' && { field_id: selectedField })
      });

      const [statsResponse, trendsResponse] = await Promise.all([
        fetch(`http://localhost:3001/api/field-data/enhanced-stats?${params}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`http://localhost:3001/api/analytics/production-trends?${params}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      const statsData = await statsResponse.json();
      const trendsData = await trendsResponse.json();

      if (statsData.success) {
        setAnalyticsData(statsData.stats);
      }

      if (trendsData.success) {
        setProductionTrends(trendsData.trends);
      }

    } catch (error) {
      console.error('Failed to fetch analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFields = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3001/api/fields-wells', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      
      if (data.success) {
        setFields(data.fields);
      }
    } catch (error) {
      console.error('Failed to fetch fields:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAnalyticsData();
    setRefreshing(false);
  };

  const exportData = async (format: 'csv' | 'json' = 'csv') => {
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        format,
        date_from: dateRange.from,
        date_to: dateRange.to,
        ...(selectedField !== 'all' && { field_id: selectedField })
      });

      const response = await fetch(`http://localhost:3001/api/field-data/export-analytics?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analytics_${dateRange.from}_to_${dateRange.to}.${format}`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-600 bg-green-100';
    if (confidence >= 60) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const tabs = [
    { id: 'overview', name: 'Overview', icon: BarChart3 },
    { id: 'production', name: 'Production Trends', icon: TrendingUp },
    { id: 'quality', name: 'Data Quality', icon: CheckCircle2 },
    { id: 'wells', name: 'Well Performance', icon: Activity },
  ];

  if (loading && !analyticsData) {
    return (
      <div className="flex items-center justify-center h-64">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="rounded-full h-12 w-12 border-b-2 border-blue-500"
        />
        <span className="ml-3 text-lg text-gray-600">Loading analytics...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center">
              <Database className="h-6 w-6 mr-3 text-blue-600" />
              OCR Data Analytics
            </h2>
            <p className="text-gray-600 mt-1">
              Comprehensive insights from extracted field data
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={selectedField}
              onChange={(e) => setSelectedField(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Fields</option>
              {fields.map(field => (
                <option key={field.id} value={field.id}>
                  {field.name}
                </option>
              ))}
            </select>
            
            <input
              type="date"
              value={dateRange.from}
              onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            
            <input
              type="date"
              value={dateRange.to}
              onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 text-gray-600 hover:text-blue-600 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            
            <button
              onClick={() => exportData('csv')}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center"
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100">
        <div className="border-b border-gray-200">
          <div className="flex space-x-8 px-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors flex items-center ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="h-4 w-4 mr-2" />
                {tab.name}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'overview' && analyticsData && (
            <div className="space-y-6">
              {/* Overview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  {
                    title: 'Total Reports',
                    value: analyticsData.overview.totalReports,
                    icon: '📊',
                    color: 'from-blue-500 to-blue-600',
                    change: '+12%'
                  },
                  {
                    title: 'Wells Processed',
                    value: analyticsData.overview.totalWells,
                    icon: '🛢️',
                    color: 'from-green-500 to-green-600',
                    change: '+8%'
                  },
                  {
                    title: 'Parameters Extracted',
                    value: analyticsData.overview.totalParameters,
                    icon: '📋',
                    color: 'from-purple-500 to-purple-600',
                    change: '+15%'
                  },
                  {
                    title: 'Avg Confidence',
                    value: `${analyticsData.overview.avgConfidence}%`,
                    icon: '🎯',
                    color: 'from-yellow-500 to-yellow-600',
                    change: '+3%'
                  }
                ].map((card, index) => (
                  <motion.div
                    key={card.title}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="bg-gradient-to-r from-white to-gray-50 rounded-xl p-6 border border-gray-100 hover:shadow-lg transition-shadow"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">{card.title}</p>
                        <p className="text-3xl font-bold text-gray-900 mt-1">
                          {typeof card.value === 'number' ? formatNumber(card.value) : card.value}
                        </p>
                        <div className="flex items-center mt-2">
                          <TrendingUp className="h-4 w-4 text-green-500" />
                          <span className="text-sm text-green-600 ml-1">{card.change}</span>
                        </div>
                      </div>
                      <div className="text-4xl">{card.icon}</div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Parameter Distribution */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Parameter Distribution
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={analyticsData.parameterDistribution.slice(0, 6)}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="count"
                      >
                        {analyticsData.parameterDistribution.slice(0, 6).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Monthly Processing Trends
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={analyticsData.monthlyTrends}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Area 
                        type="monotone" 
                        dataKey="parametersCount" 
                        stackId="1"
                        stroke="#3B82F6" 
                        fill="#3B82F6" 
                        fillOpacity={0.6}
                        name="Parameters"
                      />
                      <Area 
                        type="monotone" 
                        dataKey="reportsCount" 
                        stackId="2"
                        stroke="#10B981" 
                        fill="#10B981" 
                        fillOpacity={0.6}
                        name="Reports"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'production' && (
            <div className="space-y-6">
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Production Trends Over Time
                </h3>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={productionTrends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="oil_production" 
                      stroke="#3B82F6" 
                      strokeWidth={3}
                      name="Oil Production (BBL)"
                      dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="gas_production" 
                      stroke="#10B981" 
                      strokeWidth={3}
                      name="Gas Production (MCF)"
                      dot={{ fill: '#10B981', strokeWidth: 2, r: 4 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="water_production" 
                      stroke="#F59E0B" 
                      strokeWidth={3}
                      name="Water Production (BBL)"
                      dot={{ fill: '#F59E0B', strokeWidth: 2, r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Production Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {productionTrends.length > 0 && [
                  {
                    title: 'Total Oil Production',
                    value: productionTrends.reduce((sum, trend) => sum + trend.oil_production, 0),
                    unit: 'BBL',
                    color: 'text-blue-600 bg-blue-50',
                    icon: '🛢️'
                  },
                  {
                    title: 'Total Gas Production',
                    value: productionTrends.reduce((sum, trend) => sum + trend.gas_production, 0),
                    unit: 'MCF',
                    color: 'text-green-600 bg-green-50',
                    icon: '🔥'
                  },
                  {
                    title: 'Average Wells Active',
                    value: Math.round(productionTrends.reduce((sum, trend) => sum + trend.wells_count, 0) / productionTrends.length),
                    unit: 'wells',
                    color: 'text-purple-600 bg-purple-50',
                    icon: '⚡'
                  }
                ].map((item, index) => (
                  <motion.div
                    key={item.title}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className={`${item.color} rounded-xl p-6 border`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium opacity-75">{item.title}</p>
                        <p className="text-2xl font-bold mt-1">
                          {formatNumber(item.value)} {item.unit}
                        </p>
                      </div>
                      <div className="text-3xl">{item.icon}</div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'quality' && analyticsData && (
            <div className="space-y-6">
              {/* Data Quality Overview */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-green-50 border border-green-200 rounded-xl p-6">
                  <div className="flex items-center">
                    <CheckCircle2 className="h-8 w-8 text-green-600" />
                    <div className="ml-3">
                      <p className="text-sm font-medium text-green-600">Verified Rate</p>
                      <p className="text-2xl font-bold text-green-900">
                        {analyticsData.overview.verificationRate}%
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
                  <div className="flex items-center">
                    <Zap className="h-8 w-8 text-blue-600" />
                    <div className="ml-3">
                      <p className="text-sm font-medium text-blue-600">Avg Confidence</p>
                      <p className="text-2xl font-bold text-blue-900">
                        {analyticsData.overview.avgConfidence}%
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
                  <div className="flex items-center">
                    <Clock className="h-8 w-8 text-yellow-600" />
                    <div className="ml-3">
                      <p className="text-sm font-medium text-yellow-600">Needs Review</p>
                      <p className="text-2xl font-bold text-yellow-900">
                        {analyticsData.overview.totalParameters - Math.round(analyticsData.overview.totalParameters * analyticsData.overview.verificationRate / 100)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-purple-50 border border-purple-200 rounded-xl p-6">
                  <div className="flex items-center">
                    <Eye className="h-8 w-8 text-purple-600" />
                    <div className="ml-3">
                      <p className="text-sm font-medium text-purple-600">Data Points</p>
                      <p className="text-2xl font-bold text-purple-900">
                        {formatNumber(analyticsData.overview.totalParameters)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Parameter Quality Details */}
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Parameter Quality Breakdown
                </h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Parameter</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Count</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Avg Confidence</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Verification Rate</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Value Range</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analyticsData.parameterDistribution.map((param, index) => (
                        <motion.tr
                          key={param.name}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className="border-b border-gray-100 hover:bg-gray-50"
                        >
                          <td className="py-3 px-4 font-medium text-gray-900">{param.name}</td>
                          <td className="py-3 px-4 text-gray-600">{formatNumber(param.count)}</td>
                          <td className="py-3 px-4">
                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getConfidenceColor(param.avgConfidence)}`}>
                              {param.avgConfidence}%
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center">
                              <div className="w-20 bg-gray-200 rounded-full h-2 mr-2">
                                <div 
                                  className="bg-green-500 h-2 rounded-full"
                                  style={{ width: `${param.verificationRate}%` }}
                                />
                              </div>
                              <span className="text-sm text-gray-600">{param.verificationRate}%</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-gray-600">
                            {param.valueRange.min?.toFixed(1)} - {param.valueRange.max?.toFixed(1)}
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'wells' && analyticsData && (
            <div className="space-y-6">
              {/* Top Performing Wells */}
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Top Performing Wells
                </h3>
                <div className="grid gap-4">
                  {analyticsData.topWells.map((well, index) => (
                    <motion.div
                      key={well.wellName}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="bg-gradient-to-r from-blue-50 to-purple-50 border border-gray-200 rounded-lg p-4"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="bg-blue-100 rounded-full p-3 mr-4">
                            <Activity className="h-6 w-6 text-blue-600" />
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-900">{well.wellName}</h4>
                            <p className="text-sm text-gray-600">{well.fieldName}</p>
                            <p className="text-xs text-gray-500">API: {well.apiNumber}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center space-x-4">
                            <div>
                              <p className="text-sm text-gray-600">Avg Oil Production</p>
                              <p className="text-xl font-bold text-blue-600">
                                {formatNumber(well.avgOilProduction)} BBL
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-600">Parameters</p>
                              <p className="text-lg font-semibold text-gray-900">
                                {well.parameterCount}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-600">Confidence</p>
                              <span className={`px-2 py-1 rounded-full text-sm font-medium ${getConfidenceColor(well.avgConfidence)}`}>
                                {well.avgConfidence}%
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Well Performance Chart */}
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Well Performance vs Data Quality
                </h3>
                <ResponsiveContainer width="100%" height={400}>
                  <ScatterChart data={analyticsData.topWells}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="avgOilProduction" 
                      name="Oil Production"
                      unit=" BBL"
                    />
                    <YAxis 
                      dataKey="avgConfidence" 
                      name="Confidence"
                      unit="%"
                    />
                    <Tooltip 
                      cursor={{ strokeDasharray: '3 3' }}
                      content={({ active, payload }) => {
                        if (active && payload && payload[0]) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                              <p className="font-semibold">{data.wellName}</p>
                              <p className="text-sm text-gray-600">{data.fieldName}</p>
                              <p className="text-sm">Oil: {formatNumber(data.avgOilProduction)} BBL</p>
                              <p className="text-sm">Confidence: {data.avgConfidence}%</p>
                              <p className="text-sm">Parameters: {data.parameterCount}</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Scatter fill="#3B82F6" />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;