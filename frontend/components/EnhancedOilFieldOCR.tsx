'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { createWorker, PSM } from 'tesseract.js';
import { Upload, FileText, CheckCircle, AlertCircle, Edit2, Save, X, Camera, Zap, Grid, Download, Eye, EyeOff, FileImage, FileX } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

// PDF.js types (you'll need to install: npm install pdfjs-dist)
declare global {
  interface Window {
    pdfjsLib: any;
  }
}

// Enhanced types for complex oil field data
interface WellDataPoint {
  id: string;
  wellName: string;
  date: string;
  parameters: {
    [key: string]: {
      value: string;
      unit: string;
      confidence: number;
      cellPosition: { row: number; col: number };
      isEditing: boolean;
    };
  };
  isVerified: boolean;
}

interface TableCell {
  text: string;
  confidence: number;
  position: { x: number; y: number; width: number; height: number };
  row: number;
  col: number;
}

interface ExtractedTable {
  headers: string[];
  rows: TableCell[][];
  wellData: WellDataPoint[];
}

interface PDFPageInfo {
  pageNumber: number;
  width: number;
  height: number;
  canvas: HTMLCanvasElement;
}

// Common oil field parameters mapping
const PARAMETER_MAPPING = {
  'oil': { fullName: 'Oil Production', units: ['BBL', 'bbl', 'STB', 'stb'] },
  'gas': { fullName: 'Gas Production', units: ['MCF', 'mcf', 'MSCF', 'mscf', 'SCF'] },
  'water': { fullName: 'Water Production', units: ['BBL', 'bbl', 'STB', 'stb'] },
  'pressure': { fullName: 'Pressure', units: ['PSI', 'psi', 'PSIG', 'psig'] },
  'temp': { fullName: 'Temperature', units: ['°F', 'F', 'deg'] },
  'cut': { fullName: 'Water Cut', units: ['%', 'percent'] },
  'rate': { fullName: 'Flow Rate', units: ['BPD', 'bpd', 'BOPD'] },
  'choke': { fullName: 'Choke Size', units: ['/64', '64ths'] },
  'gor': { fullName: 'Gas Oil Ratio', units: ['SCF/BBL', 'scf/bbl'] }
};

const EnhancedOilFieldOCR: React.FC = () => {
  const { user } = useAuth();
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<'image' | 'pdf' | null>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [pdfPages, setPdfPages] = useState<PDFPageInfo[]>([]);
  const [selectedPage, setSelectedPage] = useState<number>(0);
  const [extractedTable, setExtractedTable] = useState<ExtractedTable | null>(null);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [fieldName, setFieldName] = useState('West Texas Field A');
  const [showOriginalText, setShowOriginalText] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const workerRef = useRef<Tesseract.Worker | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // Load PDF.js
    loadPDFJS();
    
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, []);

  // Load PDF.js library
  const loadPDFJS = async () => {
    if (!window.pdfjsLib) {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = () => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        console.log('✅ PDF.js loaded successfully');
      };
      document.head.appendChild(script);
    }
  };

  // Initialize enhanced Tesseract worker for table processing
  const initializeWorker = async () => {
    if (!workerRef.current) {
      setProcessingStatus('Initializing enhanced OCR engine...');
      setProcessingProgress(10);
      
      try {
        workerRef.current = await createWorker('eng', 1, {
          logger: m => {
            if (m.status === 'recognizing text') {
              const progress = Math.round(m.progress * 100);
              setProcessingProgress(30 + progress * 0.6);
              setProcessingStatus(`Extracting text: ${progress}%`);
            }
          }
        });
        
        // Enhanced parameters for table recognition
        await workerRef.current.setParameters({
          tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.,°%/-():\n\t ',
          tessedit_pageseg_mode: PSM.SPARSE_TEXT, // Better for tables
          tessedit_ocr_engine_mode: '1', // LSTM engine
        });
        
        setProcessingProgress(25);
      } catch (error) {
        console.error('Failed to initialize OCR worker:', error);
        throw new Error('Failed to initialize OCR engine');
      }
    }
  };

  // Convert PDF to images
  const convertPDFToImages = async (file: File): Promise<PDFPageInfo[]> => {
    return new Promise(async (resolve, reject) => {
      try {
        setProcessingStatus('Loading PDF document...');
        setProcessingProgress(15);

        if (!window.pdfjsLib) {
          throw new Error('PDF.js not loaded. Please refresh and try again.');
        }

        const arrayBuffer = await file.arrayBuffer();
        const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        
        setProcessingStatus(`Converting PDF pages (${pdf.numPages} pages)...`);
        const pages: PDFPageInfo[] = [];

        for (let pageNum = 1; pageNum <= Math.min(pdf.numPages, 10); pageNum++) { // Limit to 10 pages
          setProcessingProgress(15 + (pageNum / pdf.numPages) * 10);
          
          const page = await pdf.getPage(pageNum);
          const viewport = page.getViewport({ scale: 2.0 }); // High resolution for better OCR
          
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d')!;
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          await page.render({
            canvasContext: context,
            viewport: viewport
          }).promise;

          pages.push({
            pageNumber: pageNum,
            width: canvas.width,
            height: canvas.height,
            canvas: canvas
          });
        }

        resolve(pages);
      } catch (error) {
        reject(new Error(`Failed to convert PDF: ${error}`));
      }
    });
  };

  // Enhanced image preprocessing for better OCR results
  const preprocessImage = (source: File | HTMLCanvasElement): Promise<File> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      
      if (source instanceof File) {
        // Handle regular image file
        const img = new Image();
        img.onload = () => {
          processImageOnCanvas(img, canvas, ctx, source.name, resolve);
        };
        img.src = URL.createObjectURL(source);
      } else {
        // Handle canvas from PDF
        processCanvasOnCanvas(source, canvas, ctx, resolve);
      }
    });
  };

  const processImageOnCanvas = (img: HTMLImageElement, canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, fileName: string, resolve: (file: File) => void) => {
    // Scale up the image for better OCR
    const scale = Math.min(2000 / img.width, 2000 / img.height, 2);
    canvas.width = img.width * scale;
    canvas.height = img.height * scale;
    
    // Draw with enhanced contrast and sharpening
    ctx.filter = 'contrast(150%) brightness(110%)';
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    
    // Convert back to file
    canvas.toBlob((blob) => {
      if (blob) {
        const processedFile = new File([blob], fileName, { type: 'image/png' });
        resolve(processedFile);
      }
    }, 'image/png', 0.95);
  };

  const processCanvasOnCanvas = (sourceCanvas: HTMLCanvasElement, canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, resolve: (file: File) => void) => {
    canvas.width = sourceCanvas.width;
    canvas.height = sourceCanvas.height;
    
    // Apply image enhancements
    ctx.filter = 'contrast(150%) brightness(110%)';
    ctx.drawImage(sourceCanvas, 0, 0);
    
    // Convert to file
    canvas.toBlob((blob) => {
      if (blob) {
        const processedFile = new File([blob], 'pdf-page.png', { type: 'image/png' });
        resolve(processedFile);
      }
    }, 'image/png', 0.95);
  };

  // Parse tabular data from OCR results
  const parseTableData = async (ocrData: any): Promise<ExtractedTable> => {
    setProcessingStatus('Analyzing table structure...');
    setProcessingProgress(95);
    
    const words = ocrData.words || [];
    
    // Group words by approximate rows and columns
    const rows: any[][] = [];
    const rowTolerance = 20; // pixels
    
    // Sort words by vertical position
    const sortedWords = words.sort((a: any, b: any) => a.bbox.y0 - b.bbox.y0);
    
    let currentRow: any[] = [];
    let lastY = -1;
    
    sortedWords.forEach((word: any) => {
      if (lastY === -1 || Math.abs(word.bbox.y0 - lastY) < rowTolerance) {
        currentRow.push(word);
        lastY = word.bbox.y0;
      } else {
        if (currentRow.length > 0) {
          // Sort current row by x position
          currentRow.sort((a, b) => a.bbox.x0 - b.bbox.x0);
          rows.push([...currentRow]);
        }
        currentRow = [word];
        lastY = word.bbox.y0;
      }
    });
    
    if (currentRow.length > 0) {
      currentRow.sort((a, b) => a.bbox.x0 - b.bbox.x0);
      rows.push(currentRow);
    }

    // Extract headers and data
    const headers: string[] = [];
    const dataRows: TableCell[][] = [];
    
    if (rows.length > 0) {
      const headerRow = rows[0];
      headerRow.forEach((word: any, index: number) => {
        headers[index] = word.text || `Column ${index + 1}`;
      });
    }

    // Convert remaining rows to table cells
    rows.slice(1).forEach((row, rowIndex) => {
      const tableCells: TableCell[] = [];
      row.forEach((word: any, colIndex: number) => {
        tableCells.push({
          text: word.text || '',
          confidence: word.confidence / 100 || 0,
          position: {
            x: word.bbox.x0,
            y: word.bbox.y0,
            width: word.bbox.x1 - word.bbox.x0,
            height: word.bbox.y1 - word.bbox.y0
          },
          row: rowIndex,
          col: colIndex
        });
      });
      dataRows.push(tableCells);
    });

    // Convert to well data format
    const wellData = parseWellDataFromTable(dataRows, headers);
    
    return {
      headers,
      rows: dataRows,
      wellData
    };
  };

  // Parse well data from table structure
  const parseWellDataFromTable = (rows: TableCell[][], headers: string[]): WellDataPoint[] => {
    const wellData: WellDataPoint[] = [];
    
    rows.forEach((row, rowIndex) => {
      if (row.length === 0) return;
      
      const wellName = row[0]?.text || `Well-${rowIndex + 1}`;
      if (!wellName || wellName.length < 2) return;
      
      const parameters: WellDataPoint['parameters'] = {};
      
      row.forEach((cell, colIndex) => {
        if (colIndex === 0) return; // Skip well name column
        
        const headerName = headers[colIndex] || `Parameter ${colIndex}`;
        const parameterKey = normalizeParameterName(headerName);
        
        const { value, unit } = extractValueAndUnit(cell.text);
        
        if (value) {
          parameters[parameterKey] = {
            value,
            unit: unit || detectUnit(parameterKey),
            confidence: cell.confidence,
            cellPosition: { row: rowIndex, col: colIndex },
            isEditing: false
          };
        }
      });
      
      if (Object.keys(parameters).length > 0) {
        wellData.push({
          id: `well-${rowIndex}`,
          wellName: cleanWellName(wellName),
          date: reportDate,
          parameters,
          isVerified: false
        });
      }
    });
    
    return wellData;
  };

  // Helper functions
  const normalizeParameterName = (header: string): string => {
    const cleaned = header.toLowerCase().replace(/[^a-z0-9\s]/g, '');
    
    for (const [key, mapping] of Object.entries(PARAMETER_MAPPING)) {
      if (cleaned.includes(key)) {
        return mapping.fullName;
      }
    }
    
    return header.trim();
  };

  const extractValueAndUnit = (text: string): { value: string; unit: string } => {
    if (!text) return { value: '', unit: '' };
    
    const patterns = [
      /(\d+\.?\d*)\s*([A-Za-z°%\/]+)/,  // Number followed by unit
      /(\d+\.?\d*)/,                    // Just number
      /(\d{1,3}(?:,\d{3})*\.?\d*)/      // Number with commas
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return {
          value: match[1].replace(/,/g, ''),
          unit: match[2] || ''
        };
      }
    }
    
    return { value: text.trim(), unit: '' };
  };

  const detectUnit = (parameterName: string): string => {
    const param = parameterName.toLowerCase();
    
    for (const [key, mapping] of Object.entries(PARAMETER_MAPPING)) {
      if (param.includes(key)) {
        return mapping.units[0];
      }
    }
    
    return '';
  };

  const cleanWellName = (name: string): string => {
    return name.replace(/[^a-zA-Z0-9\-]/g, '').trim() || 'Unknown Well';
  };

  // Main file processing function
  const processFile = async (file: File) => {
    try {
      setIsProcessing(true);
      setError(null);
      setProcessingProgress(0);
      setUploadedFile(file);

      const isPDF = file.type === 'application/pdf';
      setFileType(isPDF ? 'pdf' : 'image');

      if (isPDF) {
        await processPDFFile(file);
      } else {
        await processImageFile(file);
      }
      
    } catch (err) {
      setError('Failed to process file: ' + (err as Error).message);
      setProcessingProgress(0);
    } finally {
      setIsProcessing(false);
    }
  };

  // Process PDF file
  const processPDFFile = async (file: File) => {
    try {
      setProcessingStatus('Processing PDF document...');
      setProcessingProgress(5);

      // Convert PDF to images
      const pages = await convertPDFToImages(file);
      setPdfPages(pages);
      
      if (pages.length === 0) {
        throw new Error('No pages found in PDF');
      }

      // Set the first page as preview
      const firstPageCanvas = pages[0].canvas;
      const imageUrl = firstPageCanvas.toDataURL('image/png');
      setUploadedImage(imageUrl);

      // Process the first page automatically
      await processOCROnCanvas(firstPageCanvas);
      
    } catch (error) {
      throw new Error(`PDF processing failed: ${error}`);
    }
  };

  // Process regular image file
  const processImageFile = async (file: File) => {
    try {
      setProcessingStatus('Processing image file...');
      setProcessingProgress(5);

      const imageUrl = URL.createObjectURL(file);
      setUploadedImage(imageUrl);

      // Preprocess and run OCR
      setProcessingStatus('Enhancing image quality...');
      setProcessingProgress(10);
      const processedFile = await preprocessImage(file);

      await runOCROnFile(processedFile);
      
    } catch (error) {
      throw new Error(`Image processing failed: ${error}`);
    }
  };

  // Run OCR on canvas (for PDF pages)
  const processOCROnCanvas = async (canvas: HTMLCanvasElement) => {
    await initializeWorker();
    setProcessingStatus('Extracting text from table...');
    setProcessingProgress(30);
    
    const { data } = await workerRef.current!.recognize(canvas);
    
    if (!data || !data.text) {
      throw new Error('No text was extracted from the document');
    }
    
    const tableData = await parseTableData(data);
    setExtractedTable(tableData);
    setProcessingProgress(100);
    setProcessingStatus('Processing complete!');
  };

  // Run OCR on file (for images)
  const runOCROnFile = async (file: File) => {
    await initializeWorker();
    setProcessingStatus('Extracting text from table...');
    setProcessingProgress(30);
    
    const { data } = await workerRef.current!.recognize(file);
    
    if (!data || !data.text) {
      throw new Error('No text was extracted from the image');
    }
    
    const tableData = await parseTableData(data);
    setExtractedTable(tableData);
    setProcessingProgress(100);
    setProcessingStatus('Processing complete!');
  };

  // Handle PDF page selection
  const selectPDFPage = async (pageIndex: number) => {
    if (!pdfPages[pageIndex]) return;
    
    try {
      setSelectedPage(pageIndex);
      setIsProcessing(true);
      setError(null);
      setProcessingStatus(`Processing page ${pageIndex + 1}...`);
      setProcessingProgress(0);

      const selectedCanvas = pdfPages[pageIndex].canvas;
      const imageUrl = selectedCanvas.toDataURL('image/png');
      setUploadedImage(imageUrl);

      await processOCROnCanvas(selectedCanvas);
      
    } catch (error) {
      setError(`Failed to process page ${pageIndex + 1}: ${error}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle file upload
  const handleFileUpload = (file: File) => {
    const isPDF = file.type === 'application/pdf';
    const isImage = file.type.startsWith('image/');
    
    if (!isPDF && !isImage) {
      setError('Please upload an image file (JPG, PNG, GIF) or PDF document');
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setError('File size must be less than 50MB');
      return;
    }

    processFile(file);
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

  // Edit well data functions (same as before)
  const toggleEdit = (wellId: string, parameterKey: string) => {
    setExtractedTable(prev => {
      if (!prev) return prev;
      
      return {
        ...prev,
        wellData: prev.wellData.map(well => 
          well.id === wellId 
            ? {
                ...well,
                parameters: {
                  ...well.parameters,
                  [parameterKey]: {
                    ...well.parameters[parameterKey],
                    isEditing: !well.parameters[parameterKey].isEditing
                  }
                }
              }
            : well
        )
      };
    });
  };

  const updateParameter = (wellId: string, parameterKey: string, field: 'value' | 'unit', newValue: string) => {
    setExtractedTable(prev => {
      if (!prev) return prev;
      
      return {
        ...prev,
        wellData: prev.wellData.map(well => 
          well.id === wellId 
            ? {
                ...well,
                parameters: {
                  ...well.parameters,
                  [parameterKey]: {
                    ...well.parameters[parameterKey],
                    [field]: newValue
                  }
                }
              }
            : well
        )
      };
    });
  };

  const removeParameter = (wellId: string, parameterKey: string) => {
    setExtractedTable(prev => {
      if (!prev) return prev;
      
      return {
        ...prev,
        wellData: prev.wellData.map(well => {
          if (well.id === wellId) {
            const newParameters = { ...well.parameters };
            delete newParameters[parameterKey];
            return { ...well, parameters: newParameters };
          }
          return well;
        })
      };
    });
  };

  // Send enhanced data to backend (same as before but with file type info)
  const sendToBackend = async () => {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        setError('Authentication required. Please log in again.');
        return;
      }

      if (!extractedTable || extractedTable.wellData.length === 0) {
        setError('No data to send. Please process a file first.');
        return;
      }

      setProcessingStatus('Saving to database...');

      const enhancedData = extractedTable.wellData.map(well => ({
        well_name: well.wellName,
        date: well.date,
        field_name: fieldName,
        parameters: Object.entries(well.parameters).map(([paramName, paramData]) => ({
          parameter_name: paramName,
          parameter_value: parseFloat(paramData.value) || 0,
          value_text: paramData.value,
          unit: paramData.unit,
          confidence_score: paramData.confidence,
          cell_position: paramData.cellPosition,
          is_verified: false
        })),
        extraction_metadata: {
          total_parameters: Object.keys(well.parameters).length,
          avg_confidence: Object.values(well.parameters).reduce((sum, p) => sum + p.confidence, 0) / Object.keys(well.parameters).length,
          extraction_method: `Enhanced OCR with Table Recognition (${fileType?.toUpperCase()})`,
          source_file_type: fileType,
          pdf_page: fileType === 'pdf' ? selectedPage + 1 : null
        }
      }));

      const response = await fetch('http://localhost:3001/api/field-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          extractedData: enhancedData,
          uploadedAt: new Date().toISOString(),
          processingMethod: `Enhanced OCR (${fileType?.toUpperCase()})`,
          reportDate,
          fieldName,
          totalWells: extractedTable.wellData.length,
          totalParameters: enhancedData.reduce((sum, well) => sum + well.parameters.length, 0),
          sourceFileType: fileType,
          pdfPageNumber: fileType === 'pdf' ? selectedPage + 1 : null
        })
      });

      if (response.ok) {
        const result = await response.json();
        setError(null);
        alert(`✅ Successfully saved ${enhancedData.length} wells with ${enhancedData.reduce((sum, well) => sum + well.parameters.length, 0)} parameters!`);
        
        // Reset form
        setTimeout(() => {
          setExtractedTable(null);
          setUploadedImage(null);
          setPdfPages([]);
          setUploadedFile(null);
          setFileType(null);
          setProcessingStatus('');
          setProcessingProgress(0);
        }, 2000);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save data');
      }
    } catch (err) {
      setError('Failed to save data: ' + (err as Error).message);
      console.error('Backend API Error:', err);
    }
  };

  // Export data as CSV (same as before)
  const exportToCSV = () => {
    if (!extractedTable) return;
    
    const csvData = [];
    const allParameters = new Set<string>();
    
    extractedTable.wellData.forEach(well => {
      Object.keys(well.parameters).forEach(param => allParameters.add(param));
    });
    
    const headers = ['Well Name', 'Date', ...Array.from(allParameters)];
    csvData.push(headers.join(','));
    
    extractedTable.wellData.forEach(well => {
      const row = [well.wellName, well.date];
      allParameters.forEach(param => {
        const paramData = well.parameters[param];
        row.push(paramData ? `${paramData.value} ${paramData.unit}`.trim() : '');
      });
      csvData.push(row.join(','));
    });
    
    const blob = new Blob([csvData.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `oil_field_data_${reportDate}_${fileType}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Grid className="h-10 w-10 mr-4" />
            <div>
              <h2 className="text-3xl font-bold">
                Enhanced OCR Processor
              </h2>
              <p className="mt-1 opacity-90">
                Advanced extraction for images and PDF production sheets
              </p>
            </div>
          </div>
          {user && (
            <div className="text-right">
              <p className="text-sm opacity-75">Processing as</p>
              <p className="font-medium">{user.name}</p>
            </div>
          )}
        </div>
      </div>

      {/* Configuration Panel */}
      <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Report Configuration</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              Field Name
            </label>
            <select
              value={fieldName}
              onChange={(e) => setFieldName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isProcessing}
            >
              <option>West Texas Field A</option>
              <option>North Dakota Field B</option>
              <option>Oklahoma Field C</option>
              <option>Eagle Ford Shale</option>
              <option>Permian Basin</option>
            </select>
          </div>
        </div>
      </div>

      {/* Upload Area */}
      <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
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
          {fileType === 'pdf' ? (
            <FileText className={`mx-auto h-16 w-16 mb-4 ${
              isProcessing ? 'text-gray-400 animate-pulse' : 'text-red-500'
            }`} />
          ) : (
            <Camera className={`mx-auto h-16 w-16 mb-4 ${
              isProcessing ? 'text-gray-400 animate-pulse' : 'text-blue-500'
            }`} />
          )}
          
          <p className={`text-xl font-semibold mb-2 ${
            isProcessing ? 'text-gray-400' : 'text-gray-700'
          }`}>
            {isDragging 
              ? 'Drop your file here' 
              : isProcessing 
              ? 'Processing file...' 
              : 'Upload Production Sheet'
            }
          </p>
          <p className="text-gray-500 mb-4">
            📊 Images (JPG, PNG, GIF) or 📄 PDF documents with tabular data
          </p>
          
          {isProcessing && (
            <div className="mb-4">
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${processingProgress}%` }}
                />
              </div>
              <p className="text-sm text-blue-600 mt-2 font-medium">{processingStatus}</p>
            </div>
          )}
          
          <button
            onClick={() => fileInputRef.current?.click()}
            className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isProcessing}
          >
            {isProcessing ? 'Processing...' : 'Select File'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf"
            onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
            className="hidden"
          />
        </div>

        {/* PDF Page Selector */}
        {fileType === 'pdf' && pdfPages.length > 1 && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="text-sm font-medium text-gray-700 mb-3">
              Select PDF Page to Process ({pdfPages.length} pages found)
            </h4>
            <div className="grid grid-cols-5 md:grid-cols-10 gap-2">
              {pdfPages.map((page, index) => (
                <button
                  key={index}
                  onClick={() => selectPDFPage(index)}
                  disabled={isProcessing}
                  className={`p-2 text-sm rounded border-2 transition-colors ${
                    selectedPage === index
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-300 hover:border-blue-300 hover:bg-blue-25'
                  } ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  Page {page.pageNumber}
                </button>
              ))}
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

      {/* File Info Display */}
      {uploadedFile && (
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              {fileType === 'pdf' ? (
                <FileText className="h-8 w-8 text-red-500 mr-3" />
              ) : (
                <FileImage className="h-8 w-8 text-blue-500 mr-3" />
              )}
              <div>
                <h4 className="font-medium text-gray-900">{uploadedFile.name}</h4>
                <p className="text-sm text-gray-500">
                  {fileType?.toUpperCase()} • {(uploadedFile.size / 1024 / 1024).toFixed(1)} MB
                  {fileType === 'pdf' && pdfPages.length > 0 && ` • ${pdfPages.length} pages`}
                  {fileType === 'pdf' && ` • Processing page ${selectedPage + 1}`}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Results Display - Same as before but with file type info */}
      {extractedTable && uploadedImage && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Image/PDF Preview */}
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
              {fileType === 'pdf' ? (
                <FileText className="h-5 w-5 mr-2" />
              ) : (
                <FileImage className="h-5 w-5 mr-2" />
              )}
              Source Document
              {fileType === 'pdf' && (
                <span className="ml-2 text-sm text-gray-500">
                  (Page {selectedPage + 1} of {pdfPages.length})
                </span>
              )}
            </h3>
            <div className="relative">
              <img
                src={uploadedImage}
                alt={fileType === 'pdf' ? 'PDF page' : 'Production sheet'}
                className="w-full h-auto rounded-lg border shadow-sm"
              />
            </div>
          </div>

          {/* Extracted Table Data - Same as before */}
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-gray-900 flex items-center">
                <Zap className="h-5 w-5 mr-2" />
                Extracted Wells Data ({extractedTable.wellData.length} wells)
              </h3>
              <div className="flex space-x-2">
                <button
                  onClick={() => setShowOriginalText(!showOriginalText)}
                  className="p-2 text-gray-500 hover:text-blue-600 transition-colors"
                  title="Toggle original text view"
                >
                  {showOriginalText ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
                <button
                  onClick={exportToCSV}
                  className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors flex items-center font-medium"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </button>
                <button
                  onClick={sendToBackend}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center font-medium"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save to Database
                </button>
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto space-y-4">
              {extractedTable.wellData.map((well) => (
                <div key={well.id} className="border rounded-lg p-4 hover:shadow-sm transition-shadow">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-bold text-lg text-blue-600">{well.wellName}</h4>
                    <span className="text-sm text-gray-500">{well.date}</span>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {Object.entries(well.parameters).map(([paramName, paramData]) => (
                      <div key={paramName} className="border rounded-lg p-3 bg-gray-50">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700">
                            {paramName}
                          </span>
                          <div className="flex items-center space-x-1">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              paramData.confidence > 0.8 
                                ? 'bg-green-100 text-green-800'
                                : paramData.confidence > 0.6
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {Math.round(paramData.confidence * 100)}%
                            </span>
                            <button
                              onClick={() => toggleEdit(well.id, paramName)}
                              className="p-1 text-gray-500 hover:text-blue-600 transition-colors"
                            >
                              <Edit2 className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => removeParameter(well.id, paramName)}
                              className="p-1 text-gray-500 hover:text-red-600 transition-colors"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        </div>

                        {paramData.isEditing ? (
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              value={paramData.value}
                              onChange={(e) => updateParameter(well.id, paramName, 'value', e.target.value)}
                              className="border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="Value"
                            />
                            <input
                              type="text"
                              value={paramData.unit}
                              onChange={(e) => updateParameter(well.id, paramName, 'unit', e.target.value)}
                              className="border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="Unit"
                            />
                          </div>
                        ) : (
                          <div className="text-lg font-mono">
                            <span className="text-blue-600 font-bold">{paramData.value}</span>
                            <span className="text-gray-600 ml-2">{paramData.unit}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {extractedTable.wellData.length === 0 && (
                <div className="text-center text-gray-500 py-12">
                  <Grid className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg">No table data detected</p>
                  <p className="text-sm">Try uploading a clearer file with tabular production data.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Summary Statistics - Enhanced with file type info */}
      {extractedTable && extractedTable.wellData.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Extraction Summary
            {fileType && (
              <span className="ml-3 text-sm font-normal text-gray-600">
                • Source: {fileType.toUpperCase()}
                {fileType === 'pdf' && ` (Page ${selectedPage + 1})`}
              </span>
            )}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {extractedTable.wellData.length}
              </div>
              <div className="text-sm text-gray-600">Wells Processed</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {extractedTable.wellData.reduce((sum, well) => sum + Object.keys(well.parameters).length, 0)}
              </div>
              <div className="text-sm text-gray-600">Total Parameters</div>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">
                {Math.round(extractedTable.wellData.reduce((sum, well) => {
                  const avgConfidence = Object.values(well.parameters).reduce((s, p) => s + p.confidence, 0) / Object.keys(well.parameters).length;
                  return sum + avgConfidence;
                }, 0) / extractedTable.wellData.length * 100)}%
              </div>
              <div className="text-sm text-gray-600">Avg Confidence</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {extractedTable.wellData.reduce((sum, well) => {
                  return sum + Object.values(well.parameters).filter(p => p.confidence > 0.8).length;
                }, 0)}
              </div>
              <div className="text-sm text-gray-600">High Confidence</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedOilFieldOCR;