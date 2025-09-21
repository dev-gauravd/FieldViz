'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import axios from 'axios';
import { createWorker, PSM, OEM } from 'tesseract.js';
import { Upload, FileText, CheckCircle, AlertCircle, Edit2, Save, X, Camera, Zap, Grid, Download, Eye, EyeOff, FileImage, FileX } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';


// PDF.js types
declare global {
  interface Window {
    pdfjsLib: any;
  }
}

// Enhanced types for gas compressor monitoring data
interface CompressorDataPoint {
  id: string;
  timeReading: string;
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

interface OCRData {
  text?: string;
  words?: {
    text: string;
    confidence: number;
    bbox: {
      x0: number;
      y0: number;
      x1: number;
      y1: number;
    };
  }[];
}

interface ExtractedTable {
  headers: string[];
  rows: any[][];
  wellData: CompressorDataPoint[]; // Keeping same interface name for compatibility
}

interface PDFPageInfo {
  pageNumber: number;
  width: number;
  height: number;
  canvas: HTMLCanvasElement;
}

// SPECIALIZED: Gas Compressor Column Definitions based on your header image
interface CompressorColumn {
  id: string;
  mainHeader: string;
  subHeader: string;
  unit: string;
  expectedXPosition: number; // Approximate X coordinate
  tolerance: number; // X-coordinate tolerance
}

const GAS_COMPRESSOR_COLUMNS: CompressorColumn[] = [
  // Time column
  { id: 'time', mainHeader: 'Time', subHeader: 'hrs', unit: 'hrs', expectedXPosition: 50, tolerance: 25 },
  
  // Frame Lube Oil group
  { id: 'frame_lube_press', mainHeader: 'Frame Lube Oil', subHeader: 'Press', unit: 'Kg/cm²', expectedXPosition: 110, tolerance: 20 },
  { id: 'frame_lube_temp', mainHeader: 'Frame Lube Oil', subHeader: 'Temp', unit: '°C', expectedXPosition: 150, tolerance: 20 },
  { id: 'oil_filter_dp', mainHeader: 'Frame Lube Oil', subHeader: 'Oil Filter ΔP', unit: '', expectedXPosition: 190, tolerance: 20 },
  { id: 'frame_lube_level', mainHeader: 'Frame Lube Oil', subHeader: 'Level', unit: '%', expectedXPosition: 230, tolerance: 20 },
  
  // Frame Bearing Temp group  
  { id: 'cw_out_temp', mainHeader: 'Frame Bearing Temp', subHeader: 'CW Out Temp', unit: '°C', expectedXPosition: 270, tolerance: 20 },
  { id: 'brg_1', mainHeader: 'Frame Bearing Temp', subHeader: 'BRG #1', unit: '°C', expectedXPosition: 310, tolerance: 20 },
  { id: 'brg_2', mainHeader: 'Frame Bearing Temp', subHeader: 'BRG #2', unit: '°C', expectedXPosition: 350, tolerance: 20 },
  { id: 'brg_3', mainHeader: 'Frame Bearing Temp', subHeader: 'BRG #3', unit: '°C', expectedXPosition: 390, tolerance: 20 },
  { id: 'brg_4', mainHeader: 'Frame Bearing Temp', subHeader: 'BRG #4', unit: '°C', expectedXPosition: 430, tolerance: 20 },
  
  // 1st stage cylinder group
  { id: 'stage1_suction_press', mainHeader: '1st Stage Cylinder', subHeader: 'Suction Press', unit: 'Kg/cm²', expectedXPosition: 470, tolerance: 20 },
  { id: 'stage1_suction_temp', mainHeader: '1st Stage Cylinder', subHeader: 'Suction Temp', unit: '°C', expectedXPosition: 510, tolerance: 20 },
  { id: 'stage1_discharge_press', mainHeader: '1st Stage Cylinder', subHeader: 'Discharge Press', unit: 'Kg/cm²', expectedXPosition: 550, tolerance: 20 },
  { id: 'stage1_discharge_temp', mainHeader: '1st Stage Cylinder', subHeader: 'Discharge Temp', unit: '°C', expectedXPosition: 590, tolerance: 20 },
  
  // 2nd stage cylinder group
  { id: 'stage2_suction_press', mainHeader: '2nd Stage Cylinder', subHeader: 'Suction Press', unit: 'Kg/cm²', expectedXPosition: 630, tolerance: 20 },
  { id: 'stage2_suction_temp', mainHeader: '2nd Stage Cylinder', subHeader: 'Suction Temp', unit: '°C', expectedXPosition: 670, tolerance: 20 },
  { id: 'stage2_discharge_press', mainHeader: '2nd Stage Cylinder', subHeader: 'Discharge Press', unit: 'Kg/cm²', expectedXPosition: 710, tolerance: 20 },
  { id: 'stage2_discharge_temp', mainHeader: '2nd Stage Cylinder', subHeader: 'Discharge Temp', unit: '°C', expectedXPosition: 750, tolerance: 20 },
  
  // After cooler Separator group
  { id: 'aftercooler_lubricator', mainHeader: 'After Cooler Separator', subHeader: 'Lubricator', unit: '', expectedXPosition: 790, tolerance: 20 },
  { id: 'aftercooler_pressure', mainHeader: 'After Cooler Separator', subHeader: 'Pressure', unit: 'Kg/cm²', expectedXPosition: 830, tolerance: 20 },
  { id: 'aftercooler_temp', mainHeader: 'After Cooler Separator', subHeader: 'Temp', unit: '°C', expectedXPosition: 870, tolerance: 20 },
  { id: 'aftercooler_operating', mainHeader: 'After Cooler Separator', subHeader: 'Operating', unit: '', expectedXPosition: 910, tolerance: 20 },
  
  // Cooling Water group
  { id: 'cooling_level', mainHeader: 'Cooling Water', subHeader: 'Level', unit: '%', expectedXPosition: 950, tolerance: 20 },
  { id: 'cooling_press', mainHeader: 'Cooling Water', subHeader: 'Press', unit: 'Kg/cm²', expectedXPosition: 990, tolerance: 20 },
  { id: 'cooling_temp', mainHeader: 'Cooling Water', subHeader: 'Temp', unit: '°C', expectedXPosition: 1030, tolerance: 20 },
  { id: 'motor_amp', mainHeader: 'Cooling Water', subHeader: 'Motor Amp', unit: 'A', expectedXPosition: 1070, tolerance: 20 },
  
  // Cylinder CW out temp group
  { id: 'cyl_cw_1', mainHeader: 'Cylinder CW Out Temp', subHeader: 'Cyl #1', unit: '°C', expectedXPosition: 1110, tolerance: 20 },
  { id: 'cyl_cw_2', mainHeader: 'Cylinder CW Out Temp', subHeader: 'Cyl #2', unit: '°C', expectedXPosition: 1150, tolerance: 20 },
  { id: 'cyl_cw_3', mainHeader: 'Cylinder CW Out Temp', subHeader: 'Cyl #3', unit: '°C', expectedXPosition: 1190, tolerance: 20 },
  { id: 'cyl_cw_4', mainHeader: 'Cylinder CW Out Temp', subHeader: 'Cyl #4', unit: '°C', expectedXPosition: 1230, tolerance: 20 },
  
  // Final columns
  { id: 'control_valve_pos', mainHeader: 'Control Valve Position', subHeader: '%', unit: '%', expectedXPosition: 1270, tolerance: 20 },
  { id: 'engine_speed', mainHeader: 'Engine Speed', subHeader: 'RPM', unit: 'RPM', expectedXPosition: 1310, tolerance: 20 },
  { id: 'engine_load', mainHeader: 'Engine Load', subHeader: '%', unit: '%', expectedXPosition: 1350, tolerance: 20 },
  { id: 'instrument_air', mainHeader: 'Instrument Air Pressure', subHeader: 'Press', unit: 'Kg/cm²', expectedXPosition: 1390, tolerance: 20 },
  { id: 'gas_flow', mainHeader: 'Gas Flow', subHeader: 'Sm³/Hr', unit: 'Sm³/Hr', expectedXPosition: 1450, tolerance: 30 }
];

// SPECIALIZED: Gas compressor data extraction
const specializedGasCompressorExtraction = (ocrData: any): CompressorDataPoint[] => {
  const words = ocrData.words || [];
  if (words.length === 0) {
    console.warn('[COMPRESSOR] No words found in OCR data');
    return [];
  }

  console.log(`[COMPRESSOR] Processing ${words.length} words for gas compressor data extraction`);

  // Step 1: Find all time-based data rows (look for HH:MM pattern)
  const timeWords = words.filter((word: any) => {
    const timePattern = /^\d{1,2}[\.:]\d{2}$/;
    return timePattern.test(word.text.trim());
  });

  console.log(`[COMPRESSOR] Found ${timeWords.length} time entries:`, timeWords.map((w: any) => w.text));

  if (timeWords.length === 0) {
    console.error('[COMPRESSOR] No time patterns found in expected format');
    
    // Alternative: Look for numeric patterns that might be times
    const possibleTimes = words.filter((word: any) => {
      const text = word.text.trim();
      return /^\d{1,2}$/.test(text) || /^\d{1,2}[\.:]\d{2}$/.test(text);
    });
    
    console.log(`[COMPRESSOR] Found ${possibleTimes.length} possible time indicators:`, possibleTimes.map((w: any) => w.text));
    
    if (possibleTimes.length === 0) {
      return [];
    }
  }

  // Step 2: For each time entry, extract the corresponding row data
  const extractedRows: CompressorDataPoint[] = [];
  const rowTolerance = 25; // pixels

  (timeWords.length > 0 ? timeWords : words.filter((w: any) => /^\d{1,2}$/.test(w.text.trim()))).forEach((timeWord: any, rowIndex: number) => {
    const timeY = (timeWord.bbox.y0 + timeWord.bbox.y1) / 2;
    
    // Find all words in the same row (similar Y coordinate)
    const rowWords = words.filter((word: any) => {
      if (word === timeWord) return false;
      const wordY = (word.bbox.y0 + word.bbox.y1) / 2;
      return Math.abs(wordY - timeY) <= rowTolerance;
    });

    console.log(`[COMPRESSOR] Row ${rowIndex} (${timeWord.text}): Found ${rowWords.length} potential data values`);

    // Step 3: Map each word to its corresponding column based on X coordinate
    const parameters: CompressorDataPoint['parameters'] = {};
    let parametersFound = 0;

    rowWords.forEach((word: any) => {
      const wordX = (word.bbox.x0 + word.bbox.x1) / 2;
      
      // Find which column this word belongs to
      const column = GAS_COMPRESSOR_COLUMNS.find(col => 
        Math.abs(wordX - col.expectedXPosition) <= col.tolerance
      );

      if (column) {
        // Clean and validate the value
        const cleanedText = word.text.trim().replace(/[^\d.,]/g, '');
        const numericMatch = cleanedText.match(/(\d+\.?\d*)/);
        
        if (numericMatch) {
          const value = parseFloat(numericMatch[1]);
          if (!isNaN(value) && value >= 0) {
            const fullParamName = `${column.mainHeader} - ${column.subHeader}`;
            parameters[fullParamName] = {
              value: value.toString(),
              unit: column.unit,
              confidence: (word.confidence || 0.85) * 0.9, // Slight penalty for processing
              cellPosition: { row: rowIndex, col: parametersFound },
              isEditing: false
            };
            parametersFound++;
            
            console.log(`[COMPRESSOR] ✓ Mapped "${word.text}" → "${fullParamName}": ${value} ${column.unit} (X=${Math.round(wordX)})`);
          }
        } else if (word.text.trim().length > 0) {
          // Handle non-numeric indicators (checkmarks, status indicators)
          const fullParamName = `${column.mainHeader} - ${column.subHeader}`;
          parameters[fullParamName] = {
            value: word.text.trim(),
            unit: column.unit,
            confidence: (word.confidence || 0.7) * 0.8,
            cellPosition: { row: rowIndex, col: parametersFound },
            isEditing: false
          };
          parametersFound++;
          
          console.log(`[COMPRESSOR] ✓ Mapped text "${word.text}" → "${fullParamName}" (X=${Math.round(wordX)})`);
        }
      } else {
        // Log unmapped words for debugging
        console.log(`[COMPRESSOR] ⚠ Unmapped word: "${word.text}" at X=${Math.round(wordX)}`);
      }
    });

    // Only add rows with meaningful data (at least 5 parameters)
    if (parametersFound >= 5) {
      const timeValue = timeWord.text.trim();
      const formattedTime = timeValue.includes(':') ? timeValue : `${timeValue}:00`;
      
      extractedRows.push({
        id: `time-row-${rowIndex}`,
        timeReading: formattedTime,
        date: new Date().toISOString().split('T')[0],
        parameters,
        isVerified: false
      });
      
      console.log(`[COMPRESSOR] ✅ Added row ${formattedTime} with ${parametersFound} parameters`);
    } else {
      console.warn(`[COMPRESSOR] ❌ Skipping row ${timeWord.text} - only found ${parametersFound} parameters (minimum 5 required)`);
    }
  });

  console.log(`[COMPRESSOR] 🎯 Successfully extracted ${extractedRows.length} complete time-based readings`);
  return extractedRows;
};

// Enhanced preprocessing specifically for gas compressor sheets
const specializedCompressorPreprocessing = (canvas: HTMLCanvasElement): HTMLCanvasElement => {
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  console.log(`[PREPROCESSING] Processing gas compressor sheet: ${canvas.width}x${canvas.height}`);

  // Step 1: Advanced contrast enhancement for table data
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    
    // Calculate luminance
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
    
    // Aggressive bi-modal enhancement for table text vs background
    let enhanced;
    if (luminance < 140) {
      // Make text much darker and crisper
      enhanced = Math.max(0, (luminance - 40) * 0.4);
    } else {
      // Make background much lighter
      enhanced = Math.min(255, luminance * 1.1 + 40);
    }
    
    data[i] = enhanced;
    data[i + 1] = enhanced;
    data[i + 2] = enhanced;
  }

  // Step 2: Apply unsharp masking for crisp text
  const sharpened = applyUnsharpMask(data, canvas.width, canvas.height);
  
  // Step 3: Final adaptive binarization
  const binarized = adaptiveBinarization(sharpened, canvas.width, canvas.height);
  
  console.log(`[PREPROCESSING] Applied gas compressor specific enhancements`);
  
  const processedImageData = new ImageData(binarized, canvas.width, canvas.height);
  ctx.putImageData(processedImageData, 0, 0);

  return canvas;
};

// Unsharp masking for crisp text
const applyUnsharpMask = (data: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray => {
  const result = new Uint8ClampedArray(data.length);
  const amount = 1.5; // Sharpening amount
  const radius = 1; // Sharpening radius

  // Create Gaussian blur first
  const blurred = gaussianBlur(data, width, height, radius);
  
  // Apply unsharp mask formula: original + amount * (original - blurred)
  for (let i = 0; i < data.length; i += 4) {
    const original = data[i];
    const blur = blurred[i];
    const sharpened = Math.max(0, Math.min(255, original + amount * (original - blur)));
    
    result[i] = sharpened;
    result[i + 1] = sharpened;
    result[i + 2] = sharpened;
    result[i + 3] = data[i + 3];
  }

  return result;
};

// Gaussian blur implementation
const gaussianBlur = (data: Uint8ClampedArray, width: number, height: number, radius: number): Uint8ClampedArray => {
  const result = new Uint8ClampedArray(data.length);
  const kernel = generateGaussianKernel(radius);
  const kernelSize = kernel.length;
  const offset = Math.floor(kernelSize / 2);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let weightSum = 0;
      
      for (let ky = 0; ky < kernelSize; ky++) {
        for (let kx = 0; kx < kernelSize; kx++) {
          const ny = y + ky - offset;
          const nx = x + kx - offset;
          
          if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
            const idx = (ny * width + nx) * 4;
            const weight = kernel[ky][kx];
            sum += data[idx] * weight;
            weightSum += weight;
          }
        }
      }
      
      const idx = (y * width + x) * 4;
      const blurred = sum / weightSum;
      
      result[idx] = blurred;
      result[idx + 1] = blurred;
      result[idx + 2] = blurred;
      result[idx + 3] = data[idx + 3];
    }
  }

  return result;
};

// Generate Gaussian kernel
const generateGaussianKernel = (radius: number): number[][] => {
  const size = 2 * radius + 1;
  const kernel: number[][] = [];
  const sigma = radius / 3;
  let sum = 0;

  for (let y = 0; y < size; y++) {
    kernel[y] = [];
    for (let x = 0; x < size; x++) {
      const dx = x - radius;
      const dy = y - radius;
      const value = Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
      kernel[y][x] = value;
      sum += value;
    }
  }

  // Normalize kernel
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      kernel[y][x] /= sum;
    }
  }

  return kernel;
};

// Adaptive binarization
const adaptiveBinarization = (data: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray => {
  const result = new Uint8ClampedArray(data.length);
  const windowSize = 15;
  const c = 10; // Constant subtracted from mean

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let count = 0;
      
      // Calculate local mean
      for (let dy = -windowSize; dy <= windowSize; dy++) {
        for (let dx = -windowSize; dx <= windowSize; dx++) {
          const ny = y + dy;
          const nx = x + dx;
          
          if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
            const idx = (ny * width + nx) * 4;
            sum += data[idx];
            count++;
          }
        }
      }
      
      const mean = sum / count;
      const threshold = mean - c;
      
      const idx = (y * width + x) * 4;
      const value = data[idx] > threshold ? 255 : 0;
      
      result[idx] = value;
      result[idx + 1] = value;
      result[idx + 2] = value;
      result[idx + 3] = data[idx + 3];
    }
  }

  return result;
};

// Debug function for detailed OCR analysis
const debugCompressorOCRResults = (ocrData: any) => {
  console.log("=== GAS COMPRESSOR OCR DEBUG ===");
  console.log("Raw text length:", ocrData.text?.length || 0);
  console.log("Words detected:", ocrData.words?.length || 0);
  
  if (ocrData.words && ocrData.words.length > 0) {
    console.log("\n📊 Word Distribution Analysis:");
    const xPositions = ocrData.words.map((w: any) => (w.bbox.x0 + w.bbox.x1) / 2);
    console.log(`X-coordinates range: ${Math.min(...xPositions).toFixed(0)} - ${Math.max(...xPositions).toFixed(0)}`);
    
    console.log("\n🕐 Time Pattern Words:");
    const timeWords = ocrData.words.filter((w: any) => /^\d{1,2}[\.:]\d{2}/.test(w.text));
    timeWords.forEach((word: any, i: number) => {
      console.log(`  ${i + 1}. "${word.text}" at (${Math.round(word.bbox.x0)}, ${Math.round(word.bbox.y0)}) confidence: ${(word.confidence || 0).toFixed(2)}`);
    });
    
    console.log("\n🔢 Sample Numeric Words:");
    const numericWords = ocrData.words.filter((w: any) => /^\d+\.?\d*$/.test(w.text.trim())).slice(0, 10);
    numericWords.forEach((word: any, i: number) => {
      console.log(`  ${i + 1}. "${word.text}" at (${Math.round(word.bbox.x0)}, ${Math.round(word.bbox.y0)})`);
    });
    
    console.log("\n📋 Sample Column Mapping:");
    const sampleWords = ocrData.words.slice(0, 20);
    sampleWords.forEach((word: any) => {
      const wordX = (word.bbox.x0 + word.bbox.x1) / 2;
      const matchedCol = GAS_COMPRESSOR_COLUMNS.find(col => 
        Math.abs(wordX - col.expectedXPosition) <= col.tolerance
      );
      
      if (matchedCol) {
        console.log(`  "${word.text}" → ${matchedCol.mainHeader} - ${matchedCol.subHeader}`);
      }
    });
  }
  
  console.log("\n📄 Raw text preview:", ocrData.text?.substring(0, 500));
  console.log("===============================");
};

const getFullUrl = (path: string) => {
  if (!path) return "";
  
  let fullUrl = "";
  if (path.startsWith("http")) {
    fullUrl = path;
  } else {
    fullUrl = `http://localhost:3001/uploads${path}`;
  }
  
  console.log('Original path:', path);
  console.log('Generated URL:', fullUrl);
  return fullUrl;
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
  const [fieldName, setFieldName] = useState('Gas Compressor Station A');
  const [showOriginalText, setShowOriginalText] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const workerRef = useRef<Tesseract.Worker | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);


  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  const [segmentationResult, setSegmentationResult] = useState<any>(null);
  const [viewMode, setViewMode] = useState<"original" | "preview" | "segments">("original");
  const [activeTab, setActiveTab] = useState<"original" | "preview" | "segments">("original");

  const [selectedSegment, setSelectedSegment] = useState<{ url: string; label: string; confidence: number } | null>(null);
  const [selectedSegments, setSelectedSegments] = useState<Set<number>>(new Set());

  const [isExporting, setIsExporting] = useState(false);
  const [exportResults, setExportResults] = useState<any>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);


  const segmentLabelMap: Record<string, string> = {
    title: "Company Name",
    header_1: "Company Location",
    header_2: "Date of Registry",
    table_1: "Column Details",
    table_2: "Data Entries",
    footer_1: "Daily Running Hours & Cumulative Hours",
    footer_2: "Petroleum Oil Lubricant Daily Status",
    footer_3: "Cumulative Flow Readings",
    footer_4: "PKG Trip & Change Over Details",
    footer_5: "Incharge Signature",
    footer_6: "Remarks",
    footer_7: "Signatures",
  };
  


  useEffect(() => {
    loadPDFJS();
    
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, []);

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

  // FIXED: Enhanced worker initialization with correct parameter types
  const initializeWorker = async () => {
    if (!workerRef.current) {
      setProcessingStatus('Initializing specialized OCR engine...');
      setProcessingProgress(10);

      try {
        workerRef.current = await createWorker('eng', 1, {
          logger: m => {
            if (m.status === 'recognizing text') {
              const progress = Math.round(m.progress * 100);
              setProcessingProgress(30 + progress * 0.6);
              setProcessingStatus(`Extracting compressor data: ${progress}%`);
            }
          }
        });

        // FIXED: Use proper enum values, not strings
        await workerRef.current.setParameters({
          tessedit_pageseg_mode: PSM.SINGLE_BLOCK, // Use enum directly, not string
          tessedit_ocr_engine_mode: OEM.LSTM_ONLY, // Use enum directly, not string
          preserve_interword_spaces: '1',
          tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.,°%/-(): \n\t✓×',
          user_defined_dpi: '300',
          classify_bln_numeric_mode: '1',
          // Additional table-specific parameters
          textord_tablefind_good_width: '5',
          textord_tabfind_find_tables: '1'
        });

        setProcessingProgress(25);
        console.log('✅ OCR worker initialized with gas compressor parameters');
      } catch (error) {
        console.error('Failed to initialize OCR worker:', error);
        throw new Error('Failed to initialize OCR engine');
      }
    }
  };

  // ENHANCED: Image preprocessing
  const preprocessImage = (source: File | HTMLCanvasElement): Promise<File> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      
      if (source instanceof File) {
        const img = new Image();
        img.onload = () => {
          // Higher scale for better OCR on complex tables
          const scale = Math.max(3, 3500 / Math.max(img.width, img.height));
          canvas.width = img.width * scale;
          canvas.height = img.height * scale;
          
          console.log(`[PREPROCESSING] Scaling image by ${scale.toFixed(2)}x to ${canvas.width}x${canvas.height}`);
          
          ctx.imageSmoothingEnabled = false; // Preserve sharp edges
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          
          const processedCanvas = specializedCompressorPreprocessing(canvas);
          
          processedCanvas.toBlob((blob) => {
            if (blob) {
              const processedFile = new File([blob], source.name, { type: 'image/png' });
              resolve(processedFile);
            }
          }, 'image/png', 1.0); // Maximum quality
        };
        img.src = URL.createObjectURL(source);
      } else {
        canvas.width = source.width;
        canvas.height = source.height;
        ctx.drawImage(source, 0, 0);
        
        const processedCanvas = specializedCompressorPreprocessing(canvas);
        
        processedCanvas.toBlob((blob) => {
          if (blob) {
            const processedFile = new File([blob], 'processed-compressor-sheet.png', { type: 'image/png' });
            resolve(processedFile);
          }
        }, 'image/png', 1.0);
      }
    });
  };

  // ENHANCED: Table parsing with specialized gas compressor logic
  const parseTableData = async (ocrData: OCRData): Promise<ExtractedTable> => {
    console.log("[COMPRESSOR] Starting specialized gas compressor data parsing...");
    
    debugCompressorOCRResults(ocrData);
    
    if (ocrData.words && ocrData.words.length > 0) {
      try {
        console.log("[COMPRESSOR] Attempting specialized gas compressor extraction...");
        const compressorResults = specializedGasCompressorExtraction(ocrData);
        
        if (compressorResults.length > 0) {
          console.log(`[COMPRESSOR] 🎯 Specialized extraction successful: ${compressorResults.length} time readings extracted`);
          
          // Generate proper hierarchical headers
          const headers = ['Time (hrs)', ...GAS_COMPRESSOR_COLUMNS.slice(1).map(col => 
            `${col.mainHeader} - ${col.subHeader} (${col.unit})`
          )];
          
          return {
            headers,
            rows: [],
            wellData: compressorResults // Using wellData interface for compatibility
          };
        } else {
          console.warn("[COMPRESSOR] ❌ Specialized extraction returned no results");
        }
      } catch (err) {
        console.error("Specialized gas compressor extraction failed:", err);
      }
    }
    
    console.log("[COMPRESSOR] Using enhanced fallback parsing...");
    return enhancedFallbackParsing(ocrData, reportDate);
  };

  // Enhanced fallback for when specialized extraction fails
  const enhancedFallbackParsing = (ocrData: any, reportDate: string): ExtractedTable => {
    const lines = (ocrData.text || '').split('\n').filter((line: string) => line.trim());
    const wellData: CompressorDataPoint[] = [];
    
    console.log(`[FALLBACK] Processing ${lines.length} text lines for fallback extraction`);
    
    lines.forEach((line: string, idx: number) => {
      const trimmedLine = line.trim();
      if (trimmedLine.length < 5) return;
      
      // Look for time patterns or lines with multiple numbers
      const timeMatch = trimmedLine.match(/(\d{1,2}[\.:]\d{2})/);
      const numbers = trimmedLine.match(/\d+\.?\d*/g) || [];
      
      if ((timeMatch && numbers.length >= 3) || numbers.length >= 8) {
        const timeIdentifier = timeMatch ? timeMatch[1] : `Row-${idx + 1}`;
        const parameters: CompressorDataPoint['parameters'] = {};
        
        // Skip time value when extracting parameters
        const dataNumbers = timeMatch ? numbers.slice(1) : numbers;
        
        dataNumbers.forEach((num, i) => {
          const value = parseFloat(num);
          if (!isNaN(value) && value >= 0) {
            const column = GAS_COMPRESSOR_COLUMNS[i + 1]; // Skip time column
            const paramName = column ? 
              `${column.mainHeader} - ${column.subHeader}` : 
              `Parameter ${i + 1}`;
            
            parameters[paramName] = {
              value: value.toString(),
              unit: column?.unit || '',
              confidence: 0.6, // Lower confidence for fallback
              cellPosition: { row: idx, col: i },
              isEditing: false
            };
          }
        });
        
        if (Object.keys(parameters).length >= 3) {
          wellData.push({
            id: `fallback-${idx}`,
            timeReading: timeIdentifier,
            date: reportDate,
            parameters,
            isVerified: false
          });
        }
      }
    });
    
    console.log(`[FALLBACK] Extracted ${wellData.length} readings using fallback method`);
    return {
      headers: ['Time', 'Gas Compressor Parameters'],
      rows: [],
      wellData
    };
  };

  // Rest of the component code (file handling, UI, etc.) remains the same...
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

        for (let pageNum = 1; pageNum <= Math.min(pdf.numPages, 10); pageNum++) {
          setProcessingProgress(15 + (pageNum / pdf.numPages) * 10);
          
          const page = await pdf.getPage(pageNum);
          const viewport = page.getViewport({ scale: 2.0 });
          
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

  const processPDFFile = async (file: File) => {
    try {
      setProcessingStatus('Processing PDF document...');
      setProcessingProgress(5);

      const pages = await convertPDFToImages(file);
      setPdfPages(pages);
      
      if (pages.length === 0) {
        throw new Error('No pages found in PDF');
      }

      const firstPageCanvas = pages[0].canvas;
      const imageUrl = firstPageCanvas.toDataURL('image/png');
      setUploadedImage(imageUrl);

      await processOCROnCanvas(firstPageCanvas);
      
    } catch (error) {
      throw new Error(`PDF processing failed: ${error}`);
    }
  };

  const processImageFile = async (file: File) => {
    try {
      setProcessingStatus('Processing gas compressor sheet...');
      setProcessingProgress(5);

      const imageUrl = URL.createObjectURL(file);
      setUploadedImage(imageUrl);

      setProcessingStatus('Applying specialized preprocessing...');
      setProcessingProgress(10);
      const processedFile = await preprocessImage(file);

      await runOCROnFile(processedFile);
      
    } catch (error) {
      throw new Error(`Image processing failed: ${error}`);
    }
  };

  const processOCROnCanvas = async (canvas: HTMLCanvasElement) => {
    await initializeWorker();
    setProcessingStatus('Extracting gas compressor data...');
    setProcessingProgress(30);

    const { data } = await workerRef.current!.recognize(canvas);
    const ocrData = data as OCRData;

    const tableData = await parseTableData(ocrData);
    setExtractedTable(tableData);
    setProcessingProgress(100);
    setProcessingStatus('Gas compressor data extraction complete!');
  };

  const runOCROnFile = async (file: File) => {
    await initializeWorker();
    setProcessingStatus('Extracting gas compressor data...');
    setProcessingProgress(30);

    const { data } = await workerRef.current!.recognize(file);
    const ocrData = data as OCRData;

    const tableData = await parseTableData(ocrData);
    setExtractedTable(tableData);
    setProcessingProgress(100);
    setProcessingStatus('Gas compressor data extraction complete!');
  };

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

    // processFile(file);
    setPreviewFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setShowPreviewModal(true);
  };

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

  const toggleEdit = (readingId: string, parameterKey: string) => {
    setExtractedTable(prev => {
      if (!prev) return prev;
      
      return {
        ...prev,
        wellData: prev.wellData.map(reading => 
          reading.id === readingId 
            ? {
                ...reading,
                parameters: {
                  ...reading.parameters,
                  [parameterKey]: {
                    ...reading.parameters[parameterKey],
                    isEditing: !reading.parameters[parameterKey].isEditing
                  }
                }
              }
            : reading
        )
      };
    });
  };

  const updateParameter = (readingId: string, parameterKey: string, field: 'value' | 'unit', newValue: string) => {
    setExtractedTable(prev => {
      if (!prev) return prev;
      
      return {
        ...prev,
        wellData: prev.wellData.map(reading => 
          reading.id === readingId 
            ? {
                ...reading,
                parameters: {
                  ...reading.parameters,
                  [parameterKey]: {
                    ...reading.parameters[parameterKey],
                    [field]: newValue
                  }
                }
              }
            : reading
        )
      };
    });
  };

  const removeParameter = (readingId: string, parameterKey: string) => {
    setExtractedTable(prev => {
      if (!prev) return prev;
      
      return {
        ...prev,
        wellData: prev.wellData.map(reading => {
          if (reading.id === readingId) {
            const newParameters = { ...reading.parameters };
            delete newParameters[parameterKey];
            return { ...reading, parameters: newParameters };
          }
          return reading;
        })
      };
    });
  };

  const handleSegmentPreview = async () => {
    if (!previewFile) return;
    
    setIsProcessing(true);
    
    try {
      // If we already have segmentation results and there are selected segments, export to Excel
      if (segmentationResult && selectedSegments.size > 0) {
        await handleExportToExcel();
        return;
      }
  
      // Otherwise, run segmentation first (your existing logic)
      const formData = new FormData();
      formData.append('image', previewFile);
      
      const response = await axios.post('http://localhost:3001/api/segment-and-ocr', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      });
      
      if (response.data.success) {
        setSegmentationResult(response.data);
        setActiveTab('segments'); // Changed from 'preview' to 'segments' to show segments for selection
      } else {
        setError('Segmentation failed: ' + (response.data.error || 'Unknown error'));
      }
      
    } catch (error: any) {
      console.error('Segmentation/Export error:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      setError('Failed to run segmentation: ' + errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };
  // export excel testing
  const handleExportToExcel = async () => {
    if (!segmentationResult || selectedSegments.size === 0) {
      alert('Please select at least one segment to export');
      return;
    }
  
    setIsExporting(true);
    
    try {
      const selectedSegmentsArray = Array.from(selectedSegments);
      
      console.log('Exporting segments:', selectedSegmentsArray);
  
      const response = await fetch('http://localhost:3001/api/export-to-excel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          selectedSegments: selectedSegmentsArray,
          segmentationResult: segmentationResult
        }),
      });
  
      if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`);
      }
  
      const result = await response.json();
      
      if (result.success) {
        setExportResults(result);
        setShowExportModal(true);
        
        // Show success message
        setToastMessage(`Export successful ${result.summary.successful} segments saved to Excel`);
        setTimeout(() => setToastMessage(null), 3000)

        // Auto-download if there are successful exports
        if (result.results && result.results.length > 0) {
          const successfulExports = result.results.filter((r: any) => r.status === 'success');
          
          // Download the first successful export automatically
          if (successfulExports.length > 0 && successfulExports[0].excel_path) {
            const timestamp = successfulExports[0].timestamp;
            const downloadUrl = `http://localhost:3001/api/download-excel/${timestamp}/table_data.xlsx`;
            
            // Create a temporary link and trigger download
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = `table_data_${timestamp}.xlsx`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          }
        }
      } else {
        throw new Error(result.message || 'Export failed');
      }
  
    } catch (error) {
      console.error('Export error:', error);
      console.error('Preview/Export error:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      alert(`Error: ${errorMessage}`);
    } finally {
      setIsProcessing(false);
      setIsExporting(false);
    }
  };
  
  
  // Component for Export Results Modal
  const ExportResultsModal = () => {
    if (!showExportModal || !exportResults) return null;
  
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-auto p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-800">Export Results</h2>
            <button
              onClick={() => setShowExportModal(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
  
          {/* Summary */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold mb-2">Summary</h3>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Total:</span>
                <span className="ml-2 font-medium">{exportResults.summary.total}</span>
              </div>
              <div>
                <span className="text-gray-600">Successful:</span>
                <span className="ml-2 font-medium text-green-600">{exportResults.summary.successful}</span>
              </div>
              <div>
                <span className="text-gray-600">Failed:</span>
                <span className="ml-2 font-medium text-red-600">{exportResults.summary.failed}</span>
              </div>
            </div>
          </div>
  
          {/* Results List */}
          <div className="space-y-3">
            <h3 className="font-semibold">Individual Results</h3>
            {exportResults.results.map((result: any, index: number) => (
              <div 
                key={index} 
                className={`p-3 rounded-lg border ${
                  result.status === 'success' 
                    ? 'border-green-200 bg-green-50' 
                    : 'border-red-200 bg-red-50'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="font-medium">
                      Segment {result.segmentIndex + 1}
                      {result.segmentLabel && (
                        <span className="ml-2 text-sm text-gray-600">({result.segmentLabel})</span>
                      )}
                    </div>
                    <div className={`text-sm mt-1 ${
                      result.status === 'success' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {result.message}
                    </div>
                    {result.status === 'success' && result.timestamp && (
                      <div className="text-xs text-gray-500 mt-1">
                        Export ID: {result.timestamp}
                      </div>
                    )}
                  </div>
                  
                  {result.status === 'success' && result.excel_path && result.timestamp && (
                    <a
                      href={`http://localhost:3001/api/download-excel/${result.timestamp}/table_data.xlsx`}
                      download={`table_data_${result.timestamp}.xlsx`}
                      className="ml-4 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                    >
                      Download
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
  
          <div className="mt-6 flex justify-end">
            <button
              onClick={() => setShowExportModal(false)}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Update the button text based on state
  const getButtonText = () => {
    if (isExporting) return "Exporting...";
    if (isProcessing) return "Processing...";
    if (segmentationResult && selectedSegments.size > 0) return "Export to Excel";
    if (segmentationResult) return "Select segments to export";
    return "Proceed";
  };

  const isButtonDisabled = () => {
    return isProcessing || isExporting || (segmentationResult && selectedSegments.size === 0);
  };

  const ExportButton = () => (
    <button
      onClick={handleSegmentPreview}
      disabled={isButtonDisabled()}
      className={`px-6 py-2 rounded-lg font-semibold shadow transition ${
        isButtonDisabled()
          ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
          : segmentationResult && selectedSegments.size > 0
          ? 'bg-green-600 text-white hover:bg-green-700'
          : 'bg-blue-600 text-white hover:bg-blue-700'
      }`}
    >
      {getButtonText()}
    </button>
  );
  
  // Add selection info display
  const SelectionInfo = () => {
    if (!segmentationResult || activeTab !== "segments") return null;
  
    return (
      <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
        <div className="text-sm text-blue-800">
          <span className="font-medium">
            {selectedSegments.size} of {segmentationResult.segments.length} segments selected
          </span>
          {selectedSegments.size > 0 && (
            <div className="mt-1 text-xs">
              Selected: {Array.from(selectedSegments).map(i => `#${i + 1}`).join(', ')}
            </div>
          )}
        </div>
      </div>
    );
  };

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

      const enhancedData = extractedTable.wellData.map(reading => ({
        time_reading: reading.timeReading || reading.wellName, // Handle both interfaces
        date: reading.date,
        field_name: fieldName,
        parameters: Object.entries(reading.parameters).map(([paramName, paramData]) => ({
          parameter_name: paramName,
          parameter_value: parseFloat(paramData.value) || 0,
          value_text: paramData.value,
          unit: paramData.unit,
          confidence_score: paramData.confidence,
          cell_position: paramData.cellPosition,
          is_verified: false
        })),
        extraction_metadata: {
          total_parameters: Object.keys(reading.parameters).length,
          avg_confidence: Object.values(reading.parameters).reduce((sum, p) => sum + p.confidence, 0) / Object.keys(reading.parameters).length,
          extraction_method: `Specialized Gas Compressor OCR (${fileType?.toUpperCase()})`,
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
          processingMethod: `Specialized Gas Compressor OCR (${fileType?.toUpperCase()})`,
          reportDate,
          fieldName,
          totalReadings: extractedTable.wellData.length,
          totalParameters: enhancedData.reduce((sum, reading) => sum + reading.parameters.length, 0),
          sourceFileType: fileType,
          pdfPageNumber: fileType === 'pdf' ? selectedPage + 1 : null
        })
      });

      if (response.ok) {
        const result = await response.json();
        setError(null);
        alert(`✅ Successfully saved ${enhancedData.length} time readings with ${enhancedData.reduce((sum, reading) => sum + reading.parameters.length, 0)} parameters!`);
        
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

  const exportToCSV = () => {
    if (!extractedTable) return;
    
    const csvData = [];
    
    // Create proper hierarchical headers
    const hierarchicalHeaders = ['Time (hrs)'];
    const allParameters = new Set<string>();
    
    extractedTable.wellData.forEach(reading => {
      Object.keys(reading.parameters).forEach(param => allParameters.add(param));
    });
    
    hierarchicalHeaders.push(...Array.from(allParameters));
    csvData.push(hierarchicalHeaders.join(','));
    
    // Add data rows
    extractedTable.wellData.forEach(reading => {
      const row = [reading.timeReading || reading.wellName];
      allParameters.forEach(param => {
        const paramData = reading.parameters[param];
        row.push(paramData ? `${paramData.value}${paramData.unit ? ' ' + paramData.unit : ''}` : '');
      });
      csvData.push(row.join(','));
    });
    
    const blob = new Blob([csvData.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gas_compressor_data_${reportDate}_${fileType}.csv`;
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
                Gas Compressor OCR Processor
              </h2>
              <p className="mt-1 opacity-90">
                Specialized extraction for gas compressor monitoring sheets
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
              Compressor Station
            </label>
            <select
              value={fieldName}
              onChange={(e) => setFieldName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isProcessing}
            >
              <option>Gas Compressor Station A</option>
              <option>Gas Compressor Station B</option>
              <option>Gas Compressor Station C</option>
              <option>Natural Gas Processing Unit 1</option>
              <option>Natural Gas Processing Unit 2</option>
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
              ? 'Drop your compressor sheet here' 
              : isProcessing 
              ? 'Processing compressor data...' 
              : 'Upload Gas Compressor Sheet'
            }
          </p>
          <p className="text-gray-500 mb-4">
            📊 Gas compressor monitoring sheets (Images or PDF)
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
      {/* Preview & Segmentation Modal */}
      {showPreviewModal && previewFile && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 transition">
          <div className="bg-white shadow-xl rounded-xl p-8 max-w-5xl w-full h-[90vh] flex flex-col relative">
            {/* Header */}
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold tracking-wide text-black">
                {segmentationResult ? "Preview" : "File Preview"}
              </h2>

              {isProcessing && (
                <div className="flex items-center gap-2 text-blue-600">
                  <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                  <span className="text-sm">Processing...</span>
                </div>
              )}
            </div>

            <hr className="mb-4 opacity-30" />

            {selectedSegment && (
              <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-60">
                <div className="bg-white rounded-xl p-4 max-w-3xl w-full max-h-[90vh] flex flex-col relative">
                  <button
                    onClick={() => setSelectedSegment(null)}
                    className="absolute top-4 right-4 p-1 hover:scale-110 transition"
                  >
                    <svg
                      viewBox="0 0 20 20"
                      width={28}
                      height={28}
                      fill="none"
                      className="stroke-gray-500 hover:stroke-blue-600"
                    >
                      <line x1="5" y1="5" x2="15" y2="15" strokeWidth="2" strokeLinecap="round" />
                      <line x1="15" y1="5" x2="5" y2="15" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>
                  <img
                    src={getFullUrl(selectedSegment.url)}
                    alt={selectedSegment.label}
                    className="rounded-lg max-h-[80vh] w-full object-contain border"
                  />
                  <span className="mt-2 text-center font-medium text-gray-700">
                    {/* {selectedSegment.label} */}
                    {segmentLabelMap[selectedSegment.label] || selectedSegment.label}
                  </span>
                </div>
              </div>
            )}


            {/* Tabs */}
            {segmentationResult && (
              <div className="flex gap-2 mb-4 overflow-x-auto">
                <button
                  onClick={() => setActiveTab("preview")}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    activeTab === "preview" ? "bg-blue-600 text-white" : "bg-gray-400 hover:bg-gray-500"
                  }`}
                >
                Detected Regions
                </button>
                <button
                  onClick={() => setActiveTab("segments")}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    activeTab === "segments" ? "bg-blue-600 text-white" : "bg-gray-400 hover:bg-gray-500"
                  }`}
                >
                  Select Regions
                </button>
              </div>
            )}

            {/* Preview container */}
            <div className="flex-1 flex flex-col items-center justify-start transition bg-gray-50 rounded-lg overflow-auto p-4">
              {previewFile.type.startsWith("image/") ? (
                <>
                  {/* Preview tab */}
                  {activeTab === "preview" && (
                    <img
                      src={(() => {
                        const srcUrl = getFullUrl(segmentationResult?.preview.url) || previewUrl!;
                        console.log("Preview tab src URL:", srcUrl);
                        return srcUrl;
                      })()}
                      alt="Selected region"
                      className="rounded-lg max-h-[60vh] max-w-full border-2 border-gray-200 shadow-md object-contain bg-black"
                    />
                  )}

                  {/* Original tab */}
                  {activeTab === "original" && (
                    <img
                      src={(() => {
                        const srcUrl = previewUrl!;
                        console.log("Original tab src URL:", srcUrl);
                        return srcUrl;
                      })()}
                      alt="Original Preview"
                      className="rounded-lg max-h-[60vh] max-w-full border-2 border-gray-200 shadow-md object-contain bg-white"
                    />
                  )}

                  {/* Cropped Segments tab */}
                  {activeTab === "segments" && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 w-full overflow-y-auto max-h-[65vh]">
                      {segmentationResult?.segments.map(
                        (seg: { url: string; label: string; confidence: number }, i: number) => (
                          <div
                            key={i}
                            className="flex flex-col items-center bg-white rounded-lg shadow p-2"
                          >
                            {/* Clickable segment image */}
                            <img
                              src={getFullUrl(seg.url)}
                              alt={`Segment ${i + 1}`}
                              className="rounded-md max-h-40 object-contain border cursor-pointer hover:scale-105 transition-transform"
                              onClick={() => setSelectedSegment(seg)}
                            />

                            {/* Segment label and confidence */}
                            <span className="text-sm text-gray-600 mt-1">
                              {segmentLabelMap[seg.label] || seg.label}
                            </span>


                            {/* ✅ Checkbox for selection */}
                            <label className="mt-2 flex items-center gap-2 text-sm cursor-pointer select-none text-blue-600">
                              <input
                                type="checkbox"
                                checked={selectedSegments.has(i)}
                                onChange={() => {
                                  const newSet = new Set(selectedSegments);
                                  if (newSet.has(i)) newSet.delete(i);
                                  else newSet.add(i);
                                  setSelectedSegments(newSet);
                                }}
                                className="w-4 h-4 accent-blue-600"
                              />
                              Select
                            </label>
                          </div>
                        )
                      )}
                    </div>
                  )}


                </>
              ) : (
                <div className="text-center text-red-500 font-medium text-lg flex flex-col items-center gap-2">
                  <span role="img" aria-label="PDF">📄</span>
                  <span>{previewFile.name}</span>
                  <span className="text-sm text-gray-400">(PDF preview not supported)</span>
                </div>
              )}
            </div>
            
            {/* popup notification */}
            {toastMessage && (
              <div className="fixed inset-0 flex items-center justify-center z-50">
                <div className="bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg text-center">
                  {toastMessage}
                </div>
              </div>
            )}


            {/* Close button */}
            <button
              aria-label="Close"
              onClick={() => {
                setShowPreviewModal(false);
                setPreviewFile(null);
                setSegmentationResult(null);
                setActiveTab("original");
              }}
              className="absolute right-4 top-4 transition hover:scale-110 p-1"
            >
              <svg viewBox="0 0 20 20" width={28} height={28} fill="none" className="stroke-gray-500 hover:stroke-blue-600">
                <line x1="5" y1="5" x2="15" y2="15" strokeWidth="2" strokeLinecap="round" />
                <line x1="15" y1="5" x2="5" y2="15" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>

            {/* Action buttons */}
            <div className="flex justify-between mt-5">
            <div className="flex gap-3">
              {/* Removed old green Run Segmentation button */}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowPreviewModal(false);
                  setPreviewFile(null);
                  setSegmentationResult(null);
                  setActiveTab("original");
                }}
                className="px-5 py-2 bg-gray-400 rounded-lg font-medium hover:bg-gray-500 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSegmentPreview}
                disabled={isButtonDisabled()}
                className={`px-6 py-2 rounded-lg font-semibold shadow transition ${
                  isButtonDisabled()
                    ? 'bg-gray-400 text-gray-600 cursor-not-allowed opacity-50'
                    : segmentationResult && selectedSegments.size > 0
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {getButtonText()}
              </button>
            </div>
          </div>
          </div>
        </div>
      )}

      {/* Results Display */}
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
                alt={fileType === 'pdf' ? 'PDF page' : 'Gas compressor sheet'}
                className="w-full h-auto rounded-lg border shadow-sm"
              />
            </div>
          </div>

          {/* Extracted Compressor Data */}
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-gray-900 flex items-center">
                <Zap className="h-5 w-5 mr-2" />
                Gas Compressor Readings ({extractedTable.wellData.length} time points)
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
              {extractedTable.wellData.map((reading) => (
                <div key={reading.id} className="border rounded-lg p-4 hover:shadow-sm transition-shadow">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-bold text-lg text-blue-600">
                      Time: {reading.timeReading || reading.wellName}
                    </h4>
                    <span className="text-sm text-gray-500">{reading.date}</span>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {Object.entries(reading.parameters).map(([paramName, paramData]) => (
                      <div key={paramName} className="border rounded-lg p-3 bg-gray-50">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-gray-700 leading-tight">
                            {paramName}
                          </span>
                          <div className="flex items-center space-x-1">
                            <span className={`px-1 py-0.5 rounded text-xs font-medium ${
                              paramData.confidence > 0.8 
                                ? 'bg-green-100 text-green-800'
                                : paramData.confidence > 0.6
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {Math.round(paramData.confidence * 100)}%
                            </span>
                            <button
                              onClick={() => toggleEdit(reading.id, paramName)}
                              className="p-1 text-gray-500 hover:text-blue-600 transition-colors"
                            >
                              <Edit2 className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => removeParameter(reading.id, paramName)}
                              className="p-1 text-gray-500 hover:text-red-600 transition-colors"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        </div>

                        {paramData.isEditing ? (
                          <div className="grid grid-cols-2 gap-1">
                            <input
                              type="text"
                              value={paramData.value}
                              onChange={(e) => updateParameter(reading.id, paramName, 'value', e.target.value)}
                              className="border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="Value"
                            />
                            <input
                              type="text"
                              value={paramData.unit}
                              onChange={(e) => updateParameter(reading.id, paramName, 'unit', e.target.value)}
                              className="border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="Unit"
                            />
                          </div>
                        ) : (
                          <div className="text-base font-mono">
                            <span className="text-blue-600 font-bold">{paramData.value}</span>
                            <span className="text-gray-600 ml-1 text-sm">{paramData.unit}</span>
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
                  <p className="text-lg">No compressor data detected</p>
                  <p className="text-sm">Ensure the image contains a gas compressor monitoring table with time-based readings.</p>
                </div>
              )}
            </div>

            {/* Enhanced Debug Section */}
            {extractedTable && (
              <div className="mt-4 pt-4 border-t">
                <div className="flex space-x-2">
                  <button 
                    onClick={() => {
                      console.log('=== COMPRESSOR EXTRACTION DEBUG ===');
                      console.log('📊 Extracted Table:', extractedTable);
                      console.log('🕐 Time Readings:', extractedTable.wellData.map(r => r.timeReading || r.wellName));
                      console.log('📈 Total Parameters:', extractedTable.wellData.reduce((sum, r) => sum + Object.keys(r.parameters).length, 0));
                      console.log('🎯 Column Coverage:');
                      GAS_COMPRESSOR_COLUMNS.forEach(col => {
                        const hasData = extractedTable.wellData.some(r => r.parameters[`${col.mainHeader} - ${col.subHeader}`]);
                        console.log(`  ${hasData ? '✅' : '❌'} ${col.mainHeader} - ${col.subHeader}`);
                      });
                      console.log('=====================================');
                    }}
                    className="bg-purple-600 text-white px-3 py-2 rounded text-sm hover:bg-purple-700"
                  >
                    Debug Results
                  </button>
                  <button 
                    onClick={() => {
                      if (extractedTable.wellData.length > 0) {
                        const sampleReading = extractedTable.wellData[0];
                        console.log('=== SAMPLE DATA STRUCTURE ===');
                        console.log('Sample reading:', sampleReading);
                        console.log('Parameters:', Object.keys(sampleReading.parameters));
                        console.log('=============================');
                      }
                    }}
                    className="bg-indigo-600 text-white px-3 py-2 rounded text-sm hover:bg-indigo-700"
                  >
                    View Sample
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Summary Statistics */}
      {extractedTable && extractedTable.wellData.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Gas Compressor Data Summary
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
              <div className="text-sm text-gray-600">Time Readings</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {extractedTable.wellData.reduce((sum, reading) => sum + Object.keys(reading.parameters).length, 0)}
              </div>
              <div className="text-sm text-gray-600">Total Parameters</div>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">
                {Math.round(extractedTable.wellData.reduce((sum, reading) => {
                  const avgConfidence = Object.values(reading.parameters).reduce((s, p) => s + p.confidence, 0) / Object.keys(reading.parameters).length;
                  return sum + avgConfidence;
                }, 0) / extractedTable.wellData.length * 100)}%
              </div>
              <div className="text-sm text-gray-600">Avg Confidence</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {GAS_COMPRESSOR_COLUMNS.filter(col => 
                  extractedTable.wellData.some(r => r.parameters[`${col.mainHeader} - ${col.subHeader}`])
                ).length}
              </div>
              <div className="text-sm text-gray-600">Columns Detected</div>
            </div>
          </div>
          
          {/* Column Coverage Analysis */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Column Detection Coverage</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 text-xs">
              {GAS_COMPRESSOR_COLUMNS.slice(1).map(col => {
                const hasData = extractedTable!.wellData.some(r => r.parameters[`${col.mainHeader} - ${col.subHeader}`]);
                return (
                  <div key={col.id} className={`p-2 rounded ${hasData ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    <span className="font-medium">{hasData ? '✅' : '❌'}</span> {col.subHeader}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedOilFieldOCR;