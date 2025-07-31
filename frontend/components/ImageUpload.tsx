// ================================
// COMPLETE IMAGE UPLOAD COMPONENT
// ================================

// components/ImageUpload.tsx
'use client';
import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, CheckCircle, AlertCircle, Clock, X, FileImage } from 'lucide-react';
import { uploadAPI, dataAPI } from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import type { UploadStatus, OCRResult } from '../types';

// Simple OCR simulation
const simulateOCR = async (file: File): Promise<OCRResult[]> => {
  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));
  
  // Return mock extracted data
  return [
    {
      parameter_name: 'Oil Production',
      parameter_value: 1200 + Math.floor(Math.random() * 200),
      unit: 'BBL',
      confidence_score: 0.85 + Math.random() * 0.1
    },
    {
      parameter_name: 'Gas Production',
      parameter_value: 3800 + Math.floor(Math.random() * 400),
      unit: 'MCF',
      confidence_score: 0.78 + Math.random() * 0.15
    },
    {
      parameter_name: 'Wellhead Pressure',
      parameter_value: 2100 + Math.floor(Math.random() * 200),
      unit: 'PSI',
      confidence_score: 0.92 + Math.random() * 0.05
    },
    {
      parameter_name: 'Temperature',
      parameter_value: 180 + Math.floor(Math.random() * 20),
      unit: '°F',
      confidence_score: 0.68 + Math.random() * 0.2
    }
  ];
};

export const ImageUpload: React.FC = () => {
  const [uploads, setUploads] = useState<UploadStatus[]>([]);
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedField, setSelectedField] = useState('West Texas Field A');
  const [processing, setProcessing] = useState(false);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (processing) return;

    // Initialize upload status
    const newUploads: UploadStatus[] = acceptedFiles.map(file => ({
      id: Math.random().toString(36),
      name: file.name,
      status: 'uploading',
      progress: 0
    }));

    setUploads(prev => [...prev, ...newUploads]);
    setProcessing(true);

    try {
      // Simulate upload progress
      for (let progress = 0; progress <= 100; progress += 20) {
        await new Promise(resolve => setTimeout(resolve, 200));
        setUploads(prev => prev.map(upload => 
          newUploads.find(nu => nu.id === upload.id)
            ? { ...upload, progress }
            : upload
        ));
      }

      // Update status to processing
      setUploads(prev => prev.map(upload => 
        newUploads.find(nu => nu.id === upload.id)
          ? { ...upload, status: 'processing', progress: 100 }
          : upload
      ));

      // Process OCR for each file
      for (let i = 0; i < acceptedFiles.length; i++) {
        const file = acceptedFiles[i];
        const uploadId = newUploads[i].id;

        try {
          const extractedData = await simulateOCR(file);

          // Update individual file status
          setUploads(prev => prev.map(upload => 
            upload.id === uploadId
              ? { ...upload, status: 'completed' }
              : upload
          ));
        } catch (error) {
          setUploads(prev => prev.map(upload => 
            upload.id === uploadId
              ? { ...upload, status: 'error', error: 'OCR processing failed' }
              : upload
          ));
        }
      }

    } catch (error) {
      console.error('Upload failed:', error);
      setUploads(prev => prev.map(upload => 
        newUploads.find(nu => nu.id === upload.id)
          ? { ...upload, status: 'error', error: 'Upload failed' }
          : upload
      ));
    } finally {
      setProcessing(false);
    }
  }, [reportDate, selectedField, processing]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif']
    },
    multiple: true,
    disabled: processing
  });

  const removeUpload = (id: string) => {
    setUploads(prev => prev.filter(upload => upload.id !== id));
  };

  // Extract dropzone props and exclude conflicting events
  const { 
    onAnimationStart, 
    onAnimationEnd, 
    onAnimationIteration,
    onTransitionEnd,
    onTransitionStart,
    onDrag,
    onDragStart,
    onDragEnd,
    onDragEnter,
    onDragLeave,
    onDragOver,
    onDrop: onDropProp,
    ...dropzoneProps 
  } = getRootProps();

  return (
    <div className="space-y-8">
      <div>
        <motion.h1 
          className="text-3xl font-bold text-gray-900 mb-2"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          Upload Field Data
        </motion.h1>
        <motion.p 
          className="text-gray-600"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          Upload images of handwritten field reports for automatic data extraction
        </motion.p>
      </div>

      {/* Form Configuration */}
      <motion.div 
        className="bg-white rounded-xl shadow-lg p-8 border border-gray-100"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Report Date
            </label>
            <input
              type="date"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              disabled={processing}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Oil Field
            </label>
            <select
              value={selectedField}
              onChange={(e) => setSelectedField(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              disabled={processing}
            >
              <option>West Texas Field A</option>
              <option>North Dakota Field B</option>
              <option>Oklahoma Field C</option>
            </select>
          </div>
        </div>

        {/* Upload Area */}
        <motion.div
          {...dropzoneProps}
          className={`border-3 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all duration-300 ${
            isDragActive 
              ? 'border-blue-500 bg-blue-50 scale-105' 
              : processing
              ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
              : 'border-gray-300 hover:border-blue-400 hover:bg-blue-25'
          }`}
          whileHover={!processing ? { scale: 1.02 } : {}}
          whileTap={!processing ? { scale: 0.98 } : {}}
        >
          <input {...getInputProps()} />
          
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
          >
            {processing ? (
              <Clock className="w-16 h-16 mx-auto mb-4 text-gray-400 animate-spin" />
            ) : (
              <FileImage className="w-16 h-16 mx-auto mb-4 text-blue-500" />
            )}
          </motion.div>

          <motion.p 
            className={`text-xl font-semibold mb-3 ${
              processing ? 'text-gray-400' : 'text-gray-700'
            }`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            {isDragActive 
              ? 'Drop images here' 
              : processing 
              ? 'Processing...' 
              : 'Upload field data images'
            }
          </motion.p>
          
          <motion.p 
            className={`text-gray-500 ${processing ? 'text-gray-400' : ''}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            Drag & drop images or click to browse
          </motion.p>
          <p className="text-sm text-gray-400 mt-2">Supports JPG, PNG, GIF (max 10MB each)</p>
        </motion.div>
      </motion.div>

      {/* Upload Progress */}
      <AnimatePresence>
        {uploads.length > 0 && (
          <motion.div 
            className="bg-white rounded-xl shadow-lg p-8 border border-gray-100"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -40 }}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Processing Status</h3>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setUploads(prev => prev.filter(u => u.status !== 'completed'))}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                Clear Completed
              </motion.button>
            </div>
            
            <div className="space-y-4">
              <AnimatePresence>
                {uploads.map((upload, index) => (
                  <motion.div
                    key={upload.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg"
                  >
                    <div className="flex-shrink-0">
                      {upload.status === 'uploading' && (
                        <Clock className="w-6 h-6 text-blue-500" />
                      )}
                      {upload.status === 'processing' && (
                        <Clock className="w-6 h-6 text-yellow-500 animate-spin" />
                      )}
                      {upload.status === 'completed' && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: "spring", stiffness: 300 }}
                        >
                          <CheckCircle className="w-6 h-6 text-green-500" />
                        </motion.div>
                      )}
                      {upload.status === 'error' && (
                        <AlertCircle className="w-6 h-6 text-red-500" />
                      )}
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-900">{upload.name}</span>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => removeUpload(upload.id)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <X className="w-4 h-4" />
                        </motion.button>
                      </div>
                      
                      <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                        <motion.div
                          className={`h-2 rounded-full transition-all ${
                            upload.status === 'error' 
                              ? 'bg-red-500' 
                              : upload.status === 'completed'
                              ? 'bg-green-500'
                              : 'bg-blue-500'
                          }`}
                          initial={{ width: 0 }}
                          animate={{ width: `${upload.progress}%` }}
                          transition={{ duration: 0.3 }}
                        />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">
                          {upload.status === 'uploading' && 'Uploading...'}
                          {upload.status === 'processing' && 'Processing OCR...'}
                          {upload.status === 'completed' && 'Processing complete'}
                          {upload.status === 'error' && (upload.error || 'Processing failed')}
                        </span>
                        <span className="text-xs text-gray-400">{upload.progress}%</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};