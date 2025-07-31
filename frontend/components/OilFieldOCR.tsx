'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { createWorker, PSM } from 'tesseract.js';
import { Upload, FileText, CheckCircle, AlertCircle, Edit2, Save, X, Camera, Zap } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

// Types for oil field data
interface FieldDataPoint {
  id: string;
  parameter: string;
  value: string;
  unit: string;
  confidence: number;
  isEditing: boolean;
  originalText: string;
}

interface OCRResult {
  text: string;
  confidence: number;
  words?: Array<{
    text: string;
    confidence: number;
    bbox: { x0: number; y0: number; x1: number; y1: number };
  }>;
}

// Common oil field parameters and their units
const FIELD_PARAMETERS = {
  'oil production': ['BBL', 'bbl', 'barrels'],
  'gas production': ['MCF', 'mcf', 'MSCF', 'mscf'],
  'wellhead pressure': ['PSI', 'psi', 'PSIG', 'psig'],
  'temperature': ['°F', 'F', 'deg F', 'degrees F'],
  'water cut': ['%', 'percent'],
  'flow rate': ['BPD', 'bpd', 'BOPD', 'bopd'],
  'tubing pressure': ['PSI', 'psi', 'PSIG', 'psig'],
  'casing pressure': ['PSI', 'psi', 'PSIG', 'psig'],
  'choke size': ['64ths', '/64', 'inch'],
};

const OilFieldOCR: React.FC = () => {
  const { user } = useAuth();
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<FieldDataPoint[]>([]);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [wellName, setWellName] = useState('Well A-001');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const workerRef = useRef<Tesseract.Worker | null>(null);

  // Cleanup worker on component unmount
  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, []);

  // Initialize Tesseract worker
  const initializeWorker = async () => {
    if (!workerRef.current) {
      setProcessingStatus('Initializing OCR engine...');
      try {
        workerRef.current = await createWorker('eng', 1, {
          logger: m => {
            if (m.status === 'recognizing text') {
              setProcessingStatus(`Processing: ${Math.round(m.progress * 100)}%`);
            }
          }
        });
        
        await workerRef.current.setParameters({
          tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.,°%/-() ',
          tessedit_pageseg_mode: PSM.SINGLE_UNIFORM_BLOCK,
        });
      } catch (error) {
        console.error('Failed to initialize OCR worker:', error);
        throw new Error('Failed to initialize OCR engine');
      }
    }
  };

  // Parse extracted text for oil field data
  const parseOilFieldData = (ocrResult: OCRResult): FieldDataPoint[] => {
    const lines = ocrResult.text.split('\n').filter(line => line.trim().length > 0);
    const dataPoints: FieldDataPoint[] = [];

    lines.forEach((line, index) => {
      const cleanLine = line.trim().toLowerCase();
      
      // Look for parameter patterns
      Object.entries(FIELD_PARAMETERS).forEach(([parameter, units]) => {
        if (cleanLine.includes(parameter.toLowerCase()) || 
            parameter.split(' ').some(word => cleanLine.includes(word))) {
          
          // Extract numeric value and unit
          const numberRegex = /(\d+\.?\d*)/g;
          const numbers = line.match(numberRegex);
          
          if (numbers && numbers.length > 0) {
            const value = numbers[numbers.length - 1];
            
            // Find matching unit
            let detectedUnit = '';
            for (const unit of units) {
              if (line.toLowerCase().includes(unit.toLowerCase())) {
                detectedUnit = unit;
                break;
              }
            }
            
            if (!detectedUnit) {
              detectedUnit = units[0];
            }

            // Calculate confidence based on OCR confidence and pattern matching
            const baseConfidence = ocrResult.confidence / 100;
            const patternBonus = cleanLine.includes(parameter.toLowerCase()) ? 0.2 : 0.1;
            const finalConfidence = Math.min(baseConfidence + patternBonus, 1.0);

            dataPoints.push({
              id: `${parameter}-${index}`,
              parameter: parameter.charAt(0).toUpperCase() + parameter.slice(1),
              value,
              unit: detectedUnit,
              confidence: finalConfidence,
              isEditing: false,
              originalText: line.trim()
            });
          }
        }
      });
    });

    return dataPoints;
  };

  // Process uploaded image with OCR
  const processImage = async (file: File) => {
    try {
      setIsProcessing(true);
      setError(null);
      setProcessingStatus('Preparing image...');

      const imageUrl = URL.createObjectURL(file);
      setUploadedImage(imageUrl);

      await initializeWorker();
      setProcessingStatus('Extracting text...');
      
      const { data } = await workerRef.current!.recognize(file);
      
      if (!data || !data.text) {
        throw new Error('No text was extracted from the image');
      }
      
      setProcessingStatus('Parsing data...');
      
      const ocrResult: OCRResult = {
        text: data.text,
        confidence: data.confidence || 0,
        words: data.words ? data.words.map((word: any) => ({
          text: word.text,
          confidence: word.confidence,
          bbox: word.bbox
        })) : []
      };

      const parsedData = parseOilFieldData(ocrResult);
      setExtractedData(parsedData);
      setProcessingStatus('Complete!');
      
    } catch (err) {
      setError('Failed to process image: ' + (err as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle file upload
  const handleFileUpload = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      return;
    }

    processImage(file);
  };

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  }, []);

  // Edit data point
  const toggleEdit = (id: string) => {
    setExtractedData(prev => prev.map(item => 
      item.id === id ? { ...item, isEditing: !item.isEditing } : item
    ));
  };

  // Update data point value
  const updateDataPoint = (id: string, field: keyof FieldDataPoint, value: string) => {
    setExtractedData(prev => prev.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  // Remove data point
  const removeDataPoint = (id: string) => {
    setExtractedData(prev => prev.filter(item => item.id !== id));
  };

  // Send data to backend with authentication
  const sendToBackend = async () => {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        setError('Authentication required. Please log in again.');
        return;
      }

      if (extractedData.length === 0) {
        setError('No data to send. Please process an image first.');
        return;
      }

      const response = await fetch('http://localhost:3001/api/data/field-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          report_id: `OCR_${Date.now()}`,
          field_data: extractedData.map(item => ({
            parameter: item.parameter,
            value: item.value,
            unit: item.unit,
            confidence: item.confidence,
            original_text: item.originalText,
            extracted_at: new Date().toISOString()
          })),
          processing_method: 'OCR',
          uploaded_by: user?.id,
          report_date: reportDate,
          well_name: wellName,
          metadata: {
            total_items: extractedData.length,
            avg_confidence: extractedData.reduce((sum, item) => sum + item.confidence, 0) / extractedData.length,
            high_confidence_items: extractedData.filter(item => item.confidence > 0.8).length
          }
        })
      });

      if (response.ok) {
        const result = await response.json();
        setError(null);
        alert(`✅ ${result.message || 'Data sent successfully!'}`);
        
        // Reset form after successful submission
        setTimeout(() => {
          setExtractedData([]);
          setUploadedImage(null);
          setProcessingStatus('');
        }, 2000);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send data');
      }
    } catch (err) {
      setError('Failed to send data to backend: ' + (err as Error).message);
      console.error('Backend API Error:', err);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <Camera className="h-10 w-10 text-blue-600 mr-4" />
            <div>
              <h2 className="text-3xl font-bold text-gray-900">
                Oil Field Data OCR Processor
              </h2>
              <p className="text-gray-600 mt-1">
                Upload handwritten field reports for automatic data extraction
              </p>
            </div>
          </div>
          {user && (
            <div className="text-right">
              <p className="text-sm text-gray-500">Logged in as</p>
              <p className="font-medium text-gray-900">{user.name}</p>
            </div>
          )}
        </div>

        {/* Report Configuration */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Report Date
            </label>
            <input
              type="date"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isProcessing}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Well Name
            </label>
            <input
              type="text"
              value={wellName}
              onChange={(e) => setWellName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Well A-001"
              disabled={isProcessing}
            />
          </div>
        </div>

        {/* Upload Area */}
        <div
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 ${
            isDragging
              ? 'border-blue-500 bg-blue-50 scale-105'
              : isProcessing
              ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
              : 'border-gray-300 hover:border-blue-400 hover:bg-blue-25'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <Upload className={`mx-auto h-16 w-16 mb-4 ${
            isProcessing ? 'text-gray-400' : 'text-blue-500'
          }`} />
          <p className={`text-xl font-semibold mb-2 ${
            isProcessing ? 'text-gray-400' : 'text-gray-700'
          }`}>
            {isDragging 
              ? 'Drop image here' 
              : isProcessing 
              ? 'Processing...' 
              : 'Drag & drop an image of handwritten field data here'
            }
          </p>
          <p className="text-gray-500 mb-4">
            Supports JPG, PNG, GIF up to 10MB
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isProcessing}
          >
            {isProcessing ? 'Processing...' : 'Select Image'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
            className="hidden"
          />
        </div>

        {/* Processing Status */}
        {isProcessing && (
          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-3"></div>
              <span className="text-blue-800 font-medium">{processingStatus}</span>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mt-6 p-4 bg-red-50 rounded-lg border border-red-200">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
              <span className="text-red-800">{error}</span>
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      {uploadedImage && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Image Preview */}
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
              <FileText className="h-5 w-5 mr-2" />
              Uploaded Image
            </h3>
            <img
              src={uploadedImage}
              alt="Uploaded field data"
              className="w-full h-auto rounded-lg border shadow-sm"
            />
          </div>

          {/* Extracted Data */}
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-gray-900 flex items-center">
                <Zap className="h-5 w-5 mr-2" />
                Extracted Data ({extractedData.length} items)
              </h3>
              {extractedData.length > 0 && (
                <button
                  onClick={sendToBackend}
                  className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center font-medium"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Send to Backend
                </button>
              )}
            </div>

            <div className="space-y-4 max-h-96 overflow-y-auto">
              {extractedData.map((item) => (
                <div key={item.id} className="border rounded-lg p-4 hover:shadow-sm transition-shadow">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center">
                      <FileText className="h-4 w-4 text-gray-500 mr-2" />
                      <span className="font-semibold text-gray-900">
                        {item.parameter}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        item.confidence > 0.8 
                          ? 'bg-green-100 text-green-800'
                          : item.confidence > 0.6
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        <CheckCircle className="h-3 w-3 inline mr-1" />
                        {Math.round(item.confidence * 100)}%
                      </span>
                      <button
                        onClick={() => toggleEdit(item.id)}
                        className="p-1 text-gray-500 hover:text-blue-600 transition-colors"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => removeDataPoint(item.id)}
                        className="p-1 text-gray-500 hover:text-red-600 transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {item.isEditing ? (
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="text"
                        value={item.value}
                        onChange={(e) => updateDataPoint(item.id, 'value', e.target.value)}
                        className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Value"
                      />
                      <input
                        type="text"
                        value={item.unit}
                        onChange={(e) => updateDataPoint(item.id, 'unit', e.target.value)}
                        className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Unit"
                      />
                    </div>
                  ) : (
                    <div className="text-2xl font-mono mb-2">
                      <span className="text-blue-600 font-bold">{item.value}</span>
                      <span className="text-gray-600 ml-2">{item.unit}</span>
                    </div>
                  )}

                  <div className="text-xs text-gray-500 mt-2 p-2 bg-gray-50 rounded">
                    <strong>Original:</strong> "{item.originalText}"
                  </div>
                </div>
              ))}

              {extractedData.length === 0 && !isProcessing && uploadedImage && (
                <div className="text-center text-gray-500 py-12">
                  <FileText className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg">No field data detected</p>
                  <p className="text-sm">Try uploading a clearer image or check if the parameters match our supported types.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OilFieldOCR;