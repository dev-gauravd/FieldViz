'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  CheckCircle, AlertTriangle, XCircle, Edit3, Save, X, 
  Filter, Search, Download, Upload, RefreshCw, 
  Eye, EyeOff, ChevronDown, ChevronUp, Clock,
  AlertCircle, Info, Zap, FileText, BarChart3
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Types for validation system
interface ValidationRule {
  id: number;
  parameter_name: string;
  rule_type: 'range' | 'format' | 'dependency' | 'consistency';
  rule_definition: {
    min?: number;
    max?: number;
    pattern?: string;
    message: string;
    dependencies?: string[];
  };
  severity: 'error' | 'warning' | 'info';
  is_active: boolean;
}

interface FieldDataItem {
  id: number;
  wellName: string;
  parameterName: string;
  value: number | null;
  valueText: string;
  unit: string;
  confidence: number;
  isVerified: boolean;
  originalText: string;
  cellPosition: { row: number; col: number };
  validationIssues: ValidationIssue[];
  isEditing: boolean;
  reportDate: string;
  fieldName: string;
}

interface ValidationIssue {
  ruleId: number;
  severity: 'error' | 'warning' | 'info';
  message: string;
  suggestedValue?: string;
}

interface FilterOptions {
  confidence: { min: number; max: number };
  verification: 'all' | 'verified' | 'unverified';
  validation: 'all' | 'issues' | 'clean';
  parameter: string;
  well: string;
  severity: 'all' | 'error' | 'warning' | 'info';
}

const DataValidationReview: React.FC = () => {
  const [data, setData] = useState<FieldDataItem[]>([]);
  const [validationRules, setValidationRules] = useState<ValidationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [filters, setFilters] = useState<FilterOptions>({
    confidence: { min: 0, max: 100 },
    verification: 'all',
    validation: 'all',
    parameter: '',
    well: '',
    severity: 'all'
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'confidence' | 'parameter' | 'well' | 'date'>('confidence');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showFilters, setShowFilters] = useState(false);
  const [bulkEditMode, setBulkEditMode] = useState(false);
  const [validationStats, setValidationStats] = useState({
    total: 0,
    verified: 0,
    hasIssues: 0,
    errors: 0,
    warnings: 0
  });

  // Fetch data and validation rules
  useEffect(() => {
    fetchData();
    fetchValidationRules();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      // Get recent reports data for validation
      const response = await fetch('http://localhost:3001/api/field-data/reports/enhanced?limit=100', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Transform the data for validation interface
        const transformedData: FieldDataItem[] = [];
        
        // Fetch detailed data for each report
        for (const report of result.reports.slice(0, 5)) { // Limit for demo
          const detailResponse = await fetch(`http://localhost:3001/api/field-data/reports/${report.id}/detailed`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          
          const detailResult = await detailResponse.json();
          
          if (detailResult.success) {
            detailResult.report.wells.forEach((well: any) => {
              well.parameters.forEach((param: any) => {
                transformedData.push({
                  id: param.id,
                  wellName: well.wellName,
                  parameterName: param.parameterName,
                  value: param.value,
                  valueText: param.valueText,
                  unit: param.unit,
                  confidence: param.confidence,
                  isVerified: param.isVerified,
                  originalText: param.originalText,
                  cellPosition: param.cellPosition,
                  validationIssues: [],
                  isEditing: false,
                  reportDate: detailResult.report.report_date,
                  fieldName: detailResult.report.field_name
                });
              });
            });
          }
        }
        
        setData(transformedData);
        runValidation(transformedData);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
      // Mock data for demo if API fails
      const mockData: FieldDataItem[] = [
        {
          id: 1,
          wellName: 'WTA-001',
          parameterName: 'Oil Production',
          value: 1247,
          valueText: '1247',
          unit: 'BBL',
          confidence: 94,
          isVerified: false,
          originalText: 'Oil Production: 1247 BBL',
          cellPosition: { row: 1, col: 2 },
          validationIssues: [],
          isEditing: false,
          reportDate: '2024-01-15',
          fieldName: 'West Texas Field A'
        },
        {
          id: 2,
          wellName: 'WTA-001',
          parameterName: 'Gas Production',
          value: 3891,
          valueText: '3891',
          unit: 'MCF',
          confidence: 76,
          isVerified: false,
          originalText: 'Gas Production: 3891 MCF',
          cellPosition: { row: 1, col: 3 },
          validationIssues: [],
          isEditing: false,
          reportDate: '2024-01-15',
          fieldName: 'West Texas Field A'
        },
        {
          id: 3,
          wellName: 'WTA-002',
          parameterName: 'Wellhead Pressure',
          value: 2156,
          valueText: '2156',
          unit: 'PSI',
          confidence: 89,
          isVerified: true,
          originalText: 'Wellhead Pressure: 2156 PSI',
          cellPosition: { row: 2, col: 4 },
          validationIssues: [],
          isEditing: false,
          reportDate: '2024-01-15',
          fieldName: 'West Texas Field A'
        },
        {
          id: 4,
          wellName: 'WTA-002',
          parameterName: 'Temperature',
          value: 187,
          valueText: '187',
          unit: '°F',
          confidence: 52,
          isVerified: false,
          originalText: 'Temperature: 187°F',
          cellPosition: { row: 2, col: 5 },
          validationIssues: [],
          isEditing: false,
          reportDate: '2024-01-15',
          fieldName: 'West Texas Field A'
        },
        {
          id: 5,
          wellName: 'WTA-003',
          parameterName: 'Water Cut',
          value: 125,
          valueText: '125',
          unit: '%',
          confidence: 68,
          isVerified: false,
          originalText: 'Water Cut: 125%',
          cellPosition: { row: 3, col: 6 },
          validationIssues: [],
          isEditing: false,
          reportDate: '2024-01-15',
          fieldName: 'West Texas Field A'
        }
      ];
      
      setData(mockData);
      runValidation(mockData);
    } finally {
      setLoading(false);
    }
  };

  const fetchValidationRules = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3001/api/validation/rules', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const result = await response.json();
        setValidationRules(result.rules || []);
      }
    } catch (error) {
      console.error('Failed to fetch validation rules:', error);
      // Set default validation rules
      setValidationRules([
        {
          id: 1,
          parameter_name: 'Oil Production',
          rule_type: 'range',
          rule_definition: { min: 0, max: 10000, message: 'Oil production should be 0-10,000 BBL' },
          severity: 'warning',
          is_active: true
        },
        {
          id: 2,
          parameter_name: 'Water Cut',
          rule_type: 'range',
          rule_definition: { min: 0, max: 100, message: 'Water cut must be 0-100%' },
          severity: 'error',
          is_active: true
        }
      ]);
    }
  };

  // Run validation against all data
  const runValidation = useCallback((dataToValidate: FieldDataItem[]) => {
    const validatedData = dataToValidate.map(item => {
      const issues: ValidationIssue[] = [];
      
      // Apply validation rules
      validationRules.forEach(rule => {
        if (rule.parameter_name === item.parameterName || rule.parameter_name === '*') {
          const ruleDefinition = rule.rule_definition;
          
          switch (rule.rule_type) {
            case 'range':
              if (item.value !== null && ruleDefinition.min !== undefined && ruleDefinition.max !== undefined) {
                if (item.value < ruleDefinition.min || item.value > ruleDefinition.max) {
                  issues.push({
                    ruleId: rule.id,
                    severity: rule.severity,
                    message: `${ruleDefinition.message} (Expected: ${ruleDefinition.min}-${ruleDefinition.max})`,
                    suggestedValue: Math.max(ruleDefinition.min, Math.min(ruleDefinition.max, item.value)).toString()
                  });
                }
              }
              break;
              
            case 'format':
              if (ruleDefinition.pattern && !new RegExp(ruleDefinition.pattern).test(item.valueText)) {
                issues.push({
                  ruleId: rule.id,
                  severity: rule.severity,
                  message: ruleDefinition.message
                });
              }
              break;
              
            default:
              // Add other validation types as needed
              break;
          }
        }
      });
      
      // Low confidence warning
      if (item.confidence < 60) {
        issues.push({
          ruleId: -1,
          severity: 'warning',
          message: `Low OCR confidence (${item.confidence}%). Please verify manually.`
        });
      }
      
      return { ...item, validationIssues: issues };
    });
    
    setData(validatedData);
    
    // Update stats
    const stats = {
      total: validatedData.length,
      verified: validatedData.filter(item => item.isVerified).length,
      hasIssues: validatedData.filter(item => item.validationIssues.length > 0).length,
      errors: validatedData.filter(item => item.validationIssues.some(issue => issue.severity === 'error')).length,
      warnings: validatedData.filter(item => item.validationIssues.some(issue => issue.severity === 'warning')).length
    };
    
    setValidationStats(stats);
  }, [validationRules]);

  // Filter and sort data
  const filteredData = React.useMemo(() => {
    let filtered = data.filter(item => {
      // Search filter
      if (searchTerm && !item.wellName.toLowerCase().includes(searchTerm.toLowerCase()) &&
          !item.parameterName.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      
      // Confidence filter
      if (item.confidence < filters.confidence.min || item.confidence > filters.confidence.max) {
        return false;
      }
      
      // Verification filter
      if (filters.verification === 'verified' && !item.isVerified) return false;
      if (filters.verification === 'unverified' && item.isVerified) return false;
      
      // Validation filter
      if (filters.validation === 'issues' && item.validationIssues.length === 0) return false;
      if (filters.validation === 'clean' && item.validationIssues.length > 0) return false;
      
      // Parameter filter
      if (filters.parameter && !item.parameterName.toLowerCase().includes(filters.parameter.toLowerCase())) {
        return false;
      }
      
      // Well filter
      if (filters.well && !item.wellName.toLowerCase().includes(filters.well.toLowerCase())) {
        return false;
      }
      
      // Severity filter
      if (filters.severity !== 'all') {
        const hasMatchingSeverity = item.validationIssues.some(issue => issue.severity === filters.severity);
        if (!hasMatchingSeverity && item.validationIssues.length > 0) return false;
      }
      
      return true;
    });
    
    // Sort data
    filtered.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'confidence':
          aValue = a.confidence;
          bValue = b.confidence;
          break;
        case 'parameter':
          aValue = a.parameterName;
          bValue = b.parameterName;
          break;
        case 'well':
          aValue = a.wellName;
          bValue = b.wellName;
          break;
        case 'date':
          aValue = new Date(a.reportDate).getTime();
          bValue = new Date(b.reportDate).getTime();
          break;
        default:
          return 0;
      }
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      } else {
        return sortOrder === 'asc' ? (aValue as number) - (bValue as number) : (bValue as number) - (aValue as number);
      }
    });
    
    return filtered;
  }, [data, filters, searchTerm, sortBy, sortOrder]);

  // Handle item selection
  const handleItemSelect = (itemId: number, selected: boolean) => {
    const newSelected = new Set(selectedItems);
    if (selected) {
      newSelected.add(itemId);
    } else {
      newSelected.delete(itemId);
    }
    setSelectedItems(newSelected);
  };

  // Handle bulk selection
  const handleSelectAll = (selectAll: boolean) => {
    if (selectAll) {
      setSelectedItems(new Set(filteredData.map(item => item.id)));
    } else {
      setSelectedItems(new Set());
    }
  };

  // Handle individual item edit
  const handleEdit = (itemId: number, field: 'value' | 'unit', newValue: string) => {
    setData(prevData => prevData.map(item => {
      if (item.id === itemId) {
        const updatedItem = { 
          ...item, 
          [field === 'value' ? 'valueText' : field]: newValue 
        };
        
        if (field === 'value') {
          const numericValue = parseFloat(newValue);
          updatedItem.value = isNaN(numericValue) ? null : numericValue;
        }
        
        return updatedItem;
      }
      return item;
    }));
  };

  // Toggle edit mode for an item
  const toggleEdit = (itemId: number) => {
    setData(prevData => prevData.map(item => 
      item.id === itemId ? { ...item, isEditing: !item.isEditing } : item
    ));
  };

  // Save changes to backend
  const saveChanges = async (itemIds: number[]) => {
    try {
      const token = localStorage.getItem('token');
      const updates = itemIds.map(id => {
        const item = data.find(d => d.id === id);
        return {
          id,
          value: item?.valueText || '',
          unit: item?.unit || '',
          isVerified: item?.isVerified || false
        };
      });

      const response = await fetch('http://localhost:3001/api/field-data/bulk-update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ updates })
      });

      if (response.ok) {
        // Update local state
        setData(prevData => prevData.map(item => 
          itemIds.includes(item.id) ? { ...item, isEditing: false, isVerified: true } : item
        ));
        
        alert('Changes saved successfully!');
      } else {
        throw new Error('Failed to save changes');
      }
    } catch (error) {
      console.error('Save error:', error);
      alert('Failed to save changes');
    }
  };

  // Bulk operations
  const handleBulkApprove = async () => {
    if (selectedItems.size === 0) return;
    
    try {
      await saveChanges(Array.from(selectedItems));
      setSelectedItems(new Set());
    } catch (error) {
      console.error('Bulk approve error:', error);
    }
  };

  const handleBulkReject = () => {
    // Mark selected items for manual review
    setData(prevData => prevData.map(item => 
      selectedItems.has(item.id) 
        ? { ...item, validationIssues: [...item.validationIssues, {
            ruleId: -2,
            severity: 'warning',
            message: 'Marked for manual review'
          }] }
        : item
    ));
    setSelectedItems(new Set());
  };

  const getSeverityIcon = (severity: 'error' | 'warning' | 'info') => {
    switch (severity) {
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'info':
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getSeverityColor = (severity: 'error' | 'warning' | 'info') => {
    switch (severity) {
      case 'error':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'info':
        return 'bg-blue-50 border-blue-200 text-blue-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="rounded-full h-12 w-12 border-b-2 border-blue-500"
        />
        <span className="ml-3 text-lg text-gray-600">Loading validation data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center">
              <CheckCircle className="h-6 w-6 mr-3" />
              Data Validation & Review
            </h2>
            <p className="mt-1 opacity-90">
              Review extracted data quality and resolve validation issues
            </p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="bg-white/10 rounded-lg p-3">
              <div className="text-2xl font-bold">{validationStats.total}</div>
              <div className="text-sm opacity-75">Total Items</div>
            </div>
            <div className="bg-white/10 rounded-lg p-3">
              <div className="text-2xl font-bold text-green-300">{validationStats.verified}</div>
              <div className="text-sm opacity-75">Verified</div>
            </div>
            <div className="bg-white/10 rounded-lg p-3">
              <div className="text-2xl font-bold text-yellow-300">{validationStats.warnings}</div>
              <div className="text-sm opacity-75">Warnings</div>
            </div>
            <div className="bg-white/10 rounded-lg p-3">
              <div className="text-2xl font-bold text-red-300">{validationStats.errors}</div>
              <div className="text-sm opacity-75">Errors</div>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Search and Filters */}
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search wells or parameters..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
              />
            </div>
            
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
              {showFilters ? <ChevronUp className="h-4 w-4 ml-2" /> : <ChevronDown className="h-4 w-4 ml-2" />}
            </button>
          </div>

          {/* Bulk Actions */}
          <div className="flex items-center space-x-3">
            <span className="text-sm text-gray-600">
              {selectedItems.size} selected
            </span>
            
            <button
              onClick={handleBulkApprove}
              disabled={selectedItems.size === 0}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Bulk Approve
            </button>
            
            <button
              onClick={handleBulkReject}
              disabled={selectedItems.size === 0}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              <X className="h-4 w-4 mr-2" />
              Mark for Review
            </button>
            
            <button
              onClick={() => runValidation(data)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Re-validate
            </button>
          </div>
        </div>

        {/* Expandable Filters */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 pt-4 border-t border-gray-200"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Confidence Range
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={filters.confidence.min}
                      onChange={(e) => setFilters(prev => ({
                        ...prev,
                        confidence: { ...prev.confidence, min: parseInt(e.target.value) }
                      }))}
                      className="flex-1"
                    />
                    <span className="text-sm text-gray-600 w-12">
                      {filters.confidence.min}%
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Verification Status
                  </label>
                  <select
                    value={filters.verification}
                    onChange={(e) => setFilters(prev => ({ ...prev, verification: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All</option>
                    <option value="verified">Verified</option>
                    <option value="unverified">Unverified</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Validation Status
                  </label>
                  <select
                    value={filters.validation}
                    onChange={(e) => setFilters(prev => ({ ...prev, validation: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All</option>
                    <option value="issues">Has Issues</option>
                    <option value="clean">Clean</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sort By
                  </label>
                  <div className="flex space-x-2">
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="confidence">Confidence</option>
                      <option value="parameter">Parameter</option>
                      <option value="well">Well</option>
                      <option value="date">Date</option>
                    </select>
                    <button
                      onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                      className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      {sortOrder === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedItems.size === filteredData.length && filteredData.length > 0}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Well / Parameter
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Value
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Confidence
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Validation
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              <AnimatePresence>
                {filteredData.map((item, index) => (
                  <motion.tr
                    key={item.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ delay: index * 0.02 }}
                    className={`hover:bg-gray-50 ${
                      item.validationIssues.some(issue => issue.severity === 'error') 
                        ? 'bg-red-25' 
                        : item.validationIssues.length > 0 
                        ? 'bg-yellow-25' 
                        : ''
                    }`}
                  >
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={selectedItems.has(item.id)}
                        onChange={(e) => handleItemSelect(item.id, e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {item.wellName}
                        </div>
                        <div className="text-sm text-gray-500">
                          {item.parameterName}
                        </div>
                        <div className="text-xs text-gray-400">
                          {item.fieldName} • {item.reportDate}
                        </div>
                      </div>
                    </td>
                    
                    <td className="px-6 py-4">
                      {item.isEditing ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={item.valueText}
                            onChange={(e) => handleEdit(item.id, 'value', e.target.value)}
                            className="w-20 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          />
                          <input
                            type="text"
                            value={item.unit}
                            onChange={(e) => handleEdit(item.id, 'unit', e.target.value)}
                            className="w-16 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          />
                        </div>
                      ) : (
                        <div>
                          <span className="text-lg font-mono font-semibold text-blue-600">
                            {item.valueText}
                          </span>
                          <span className="text-sm text-gray-600 ml-2">
                            {item.unit}
                          </span>
                          {item.originalText && (
                            <div className="text-xs text-gray-400 mt-1">
                              Original: "{item.originalText}"
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                          <div 
                            className={`h-2 rounded-full ${
                              item.confidence >= 80 ? 'bg-green-500' :
                              item.confidence >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${item.confidence}%` }}
                          />
                        </div>
                        <span className="text-sm text-gray-600">
                          {item.confidence}%
                        </span>
                      </div>
                    </td>
                    
                    <td className="px-6 py-4">
                      {item.validationIssues.length > 0 ? (
                        <div className="space-y-1">
                          {item.validationIssues.slice(0, 2).map((issue, idx) => (
                            <div
                              key={idx}
                              className={`flex items-center text-xs px-2 py-1 rounded-full border ${getSeverityColor(issue.severity)}`}
                            >
                              {getSeverityIcon(issue.severity)}
                              <span className="ml-1 truncate" title={issue.message}>
                                {issue.message.substring(0, 30)}...
                              </span>
                            </div>
                          ))}
                          {item.validationIssues.length > 2 && (
                            <div className="text-xs text-gray-500">
                              +{item.validationIssues.length - 2} more
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Clean
                        </span>
                      )}
                    </td>
                    
                    <td className="px-6 py-4">
                      {item.isVerified ? (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Verified
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          <Clock className="w-3 h-3 mr-1" />
                          Pending
                        </span>
                      )}
                    </td>
                    
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        {item.isEditing ? (
                          <>
                            <button
                              onClick={() => {
                                toggleEdit(item.id);
                                saveChanges([item.id]);
                              }}
                              className="text-green-600 hover:text-green-900"
                              title="Save changes"
                            >
                              <Save className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => toggleEdit(item.id)}
                              className="text-red-600 hover:text-red-900"
                              title="Cancel editing"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => toggleEdit(item.id)}
                            className="text-blue-600 hover:text-blue-900"
                            title="Edit value"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        )}
                        
                        {!item.isVerified && (
                          <button
                            onClick={() => saveChanges([item.id])}
                            className="text-green-600 hover:text-green-900"
                            title="Approve"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
        
        {filteredData.length === 0 && (
          <div className="text-center py-12">
            <FileText className="h-16 w-16 mx-auto mb-4 text-gray-300" />
            <p className="text-lg text-gray-500">No data matches your filters</p>
            <p className="text-sm text-gray-400">Try adjusting your search criteria</p>
          </div>
        )}
      </div>

      {/* Summary Footer */}
      <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Showing {filteredData.length} of {data.length} items
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-600">
              Validation Rate: {Math.round(((validationStats.total - validationStats.hasIssues) / validationStats.total) * 100)}%
            </div>
            <div className="text-sm text-gray-600">
              Verification Rate: {Math.round((validationStats.verified / validationStats.total) * 100)}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataValidationReview;