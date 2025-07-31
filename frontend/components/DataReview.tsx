// ================================
// COMPLETE DATA REVIEW COMPONENT WITH EXPLICIT TYPES
// ================================

// components/DataReview.tsx
'use client';

import React, { useState } from 'react';
import { CheckCircle, AlertCircle, Clock, Edit3, Save, X } from 'lucide-react';
import { motion, AnimatePresence, HTMLMotionProps } from 'motion/react';

interface FieldDataItem {
  id: number;
  parameter: string;
  value: number;
  unit: string;
  confidence: number;
  isVerified: boolean;
}

// Define motion component props explicitly
const MotionH1 = motion.h1 as React.FC<HTMLMotionProps<"h1">>;
const MotionP = motion.p as React.FC<HTMLMotionProps<"p">>;
const MotionDiv = motion.div as React.FC<HTMLMotionProps<"div">>;
const MotionTR = motion.tr as React.FC<HTMLMotionProps<"tr">>;
const MotionSpan = motion.span as React.FC<HTMLMotionProps<"span">>;
const MotionButton = motion.button as React.FC<HTMLMotionProps<"button">>;

export const DataReview: React.FC = () => {
  const [data, setData] = useState<FieldDataItem[]>([
    { id: 1, parameter: 'Oil Production', value: 1247, unit: 'BBL', confidence: 0.94, isVerified: true },
    { id: 2, parameter: 'Gas Production', value: 3891, unit: 'MCF', confidence: 0.76, isVerified: false },
    { id: 3, parameter: 'Wellhead Pressure', value: 2156, unit: 'PSI', confidence: 0.89, isVerified: true },
    { id: 4, parameter: 'Temperature', value: 187, unit: '°F', confidence: 0.52, isVerified: false },
    { id: 5, parameter: 'Water Cut', value: 12.5, unit: '%', confidence: 0.68, isVerified: false },
  ]);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState<number>(0);

  const handleEdit = (item: FieldDataItem) => {
    setEditingId(item.id);
    setEditValue(item.value);
  };

  const handleSave = (id: number) => {
    setData(prev => prev.map(item => 
      item.id === id 
        ? { ...item, value: editValue, isVerified: true }
        : item
    ));
    setEditingId(null);
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditValue(0);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'bg-green-500';
    if (confidence >= 0.6) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getStatusBadge = (item: FieldDataItem) => {
    if (item.isVerified) {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <CheckCircle className="w-3 h-3 mr-1" />
          Verified
        </span>
      );
    }
    
    if (item.confidence < 0.6) {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <AlertCircle className="w-3 h-3 mr-1" />
          Low Confidence
        </span>
      );
    }

    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
        <Clock className="w-3 h-3 mr-1" />
        Needs Review
      </span>
    );
  };

  return (
    <div className="space-y-8">
      <div>
        <MotionH1 
          className="text-3xl font-bold text-gray-900 mb-2"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          OCR Data Review & Validation
        </MotionH1>
        <MotionP 
          className="text-gray-600"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          Review and edit data extracted from uploaded images. Click on any value to edit.
        </MotionP>
      </div>

      <MotionDiv 
        className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Parameter
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Value
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Unit
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Confidence
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              <AnimatePresence>
                {data.map((item, index) => (
                  <MotionTR
                    key={item.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {item.parameter}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {editingId === item.id ? (
                        <input
                          type="number"
                          value={editValue}
                          onChange={(e) => setEditValue(parseFloat(e.target.value))}
                          className="w-20 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          autoFocus
                        />
                      ) : (
                        <MotionSpan
                          whileHover={{ scale: 1.05 }}
                          className="cursor-pointer hover:text-blue-600"
                          onClick={() => handleEdit(item)}
                        >
                          {item.value.toLocaleString()}
                        </MotionSpan>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.unit}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <div className="w-full bg-gray-200 rounded-full h-2 flex-1">
                          <MotionDiv
                            className={`h-2 rounded-full ${getConfidenceColor(item.confidence)}`}
                            initial={{ width: 0 }}
                            animate={{ width: `${item.confidence * 100}%` }}
                            transition={{ duration: 0.5, delay: index * 0.1 }}
                          />
                        </div>
                        <span className="text-xs text-gray-600 w-12">
                          {Math.round(item.confidence * 100)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(item)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {editingId === item.id ? (
                        <div className="flex space-x-2">
                          <MotionButton
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleSave(item.id)}
                            className="text-green-600 hover:text-green-900"
                          >
                            <Save className="w-4 h-4" />
                          </MotionButton>
                          <MotionButton
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={handleCancel}
                            className="text-red-600 hover:text-red-900"
                          >
                            <X className="w-4 h-4" />
                          </MotionButton>
                        </div>
                      ) : (
                        <MotionButton
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleEdit(item)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          <Edit3 className="w-4 h-4" />
                        </MotionButton>
                      )}
                    </td>
                  </MotionTR>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        <div className="bg-gray-50 px-6 py-4">
          <div className="flex flex-wrap gap-3">
            <MotionButton
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Approve All High Confidence
            </MotionButton>
            <MotionButton
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors font-medium"
            >
              Export Data
            </MotionButton>
            <MotionButton
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors font-medium"
            >
              Generate Report
            </MotionButton>
          </div>
        </div>
      </MotionDiv>
    </div>
  );
};