import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, FileText, FileImage, Eye, Download, RefreshCw, AlertCircle, CheckCircle, Clock, Zap, Grid, Edit2, X, Camera } from 'lucide-react';

// Enhanced OCR Quick Test - Based on your EnhancedOilFieldOCR logic
const EnhancedOCRQuickTest = () => {
  const [file, setFile] = useState(null);
  const [fileType, setFileType] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [uploadedImage, setUploadedImage] = useState(null);
  const [pdfPages, setPdfPages] = useState([]);
  const [selectedPage, setSelectedPage] = useState(0);
  const [rawOCRData, setRawOCRData] = useState(null);
  const [extractedTable, setExtractedTable] = useState(null);
  const [error, setError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showRawText, setShowRawText] = useState(false);
  
  const fileInputRef = useRef(null);
  const workerRef = useRef(null);

  // Oil field parameters mapping (same as your original)
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

  useEffect(() => {
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

  // Initialize Tesseract worker (same as your original)
  const initializeWorker = async () => {
    if (!workerRef.current) {
      setStatus('Initializing enhanced OCR engine...');
      setProgress(10);
      
      // Dynamic import for Tesseract
      const Tesseract = await import('tesseract.js');
      
      workerRef.current = await Tesseract.createWorker('eng', 1, {
        logger: m => {
          if (m.status === 'recognizing text') {
            const prog = Math.round(m.progress * 100);
            setProgress(30 + prog * 0.6);
            setStatus(`Extracting text: ${prog}%`);
          }
        }
      });
      
      // Enhanced parameters for table recognition (same as original)
      await workerRef.current.setParameters({
        tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.,°%/-():\n\t ',
        tessedit_pageseg_mode: '6', // Sparse text for tables
        tessedit_ocr_engine_mode: '1', // LSTM engine
      });
      
      setProgress(25);
    }
  };

  // Convert PDF to images (same logic as original)
  const convertPDFToImages = async (file) => {
    setStatus('Converting PDF pages...');
    setProgress(15);
    
    if (!window.pdfjsLib) {
      throw new Error('PDF.js not loaded. Please refresh and try again.');
    }

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    const pages = [];
    const maxPages = Math.min(pdf.numPages, 10); // Limit for testing
    
    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      setProgress(15 + (pageNum / maxPages) * 10);
      
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2.0 }); // High resolution
      
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise;

      pages.push({
        pageNumber: pageNum,
        canvas: canvas,
        dataUrl: canvas.toDataURL('image/png'),
        width: canvas.width,
        height: canvas.height
      });
    }
    
    return pages;
  };

  // Enhanced image preprocessing (from your original)
  const preprocessImage = (source) => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (source instanceof File) {
        const img = new Image();
        img.onload = () => {
          const scale = Math.min(2000 / img.width, 2000 / img.height, 2);
          canvas.width = img.width * scale;
          canvas.height = img.height * scale;
          
          ctx.filter = 'contrast(150%) brightness(110%)';
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          
          canvas.toBlob((blob) => {
            if (blob) {
              const processedFile = new File([blob], 'processed.png', { type: 'image/png' });
              resolve(processedFile);
            }
          }, 'image/png', 0.95);
        };
        img.src = URL.createObjectURL(source);
      } else {
        // Handle canvas from PDF
        canvas.width = source.width;
        canvas.height = source.height;
        ctx.filter = 'contrast(150%) brightness(110%)';
        ctx.drawImage(source, 0, 0);
        
        canvas.toBlob((blob) => {
          if (blob) {
            const processedFile = new File([blob], 'pdf-page.png', { type: 'image/png' });
            resolve(processedFile);
          }
        }, 'image/png', 0.95);
      }
    });
  };

  // Parse tabular data (enhanced from your original)
  const parseTableData = (ocrData) => {
    setStatus('Analyzing table structure...');
    setProgress(95);
    
    const words = ocrData.words || [];
    const text = ocrData.text || '';
    
    // Group words by rows (same logic as original)
    const rows = [];
    const rowTolerance = 20;
    const sortedWords = words.sort((a, b) => a.bbox.y0 - b.bbox.y0);
    
    let currentRow = [];
    let lastY = -1;
    
    sortedWords.forEach((word) => {
      if (lastY === -1 || Math.abs(word.bbox.y0 - lastY) < rowTolerance) {
        currentRow.push(word);
        lastY = word.bbox.y0;
      } else {
        if (currentRow.length > 0) {
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
    const headers = [];
    const dataRows = [];
    
    if (rows.length > 0) {
      const headerRow = rows[0];
      headerRow.forEach((word, index) => {
        headers[index] = word.text || `Column ${index + 1}`;
      });
    }

    // Convert remaining rows to table cells
    rows.slice(1).forEach((row, rowIndex) => {
      const tableCells = [];
      row.forEach((word, colIndex) => {
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

    // Parse well data (enhanced logic from original)
    const wellData = parseWellDataFromTable(dataRows, headers);
    
    return {
      headers,
      rows: dataRows,
      wellData,
      rawText: text,
      totalWords: words.length,
      avgConfidence: words.length > 0 ? words.reduce((sum, w) => sum + w.confidence, 0) / words.length / 100 : 0
    };
  };

  // Parse well data from table structure (from your original)
  const parseWellDataFromTable = (rows, headers) => {
    const wellData = [];
    
    rows.forEach((row, rowIndex) => {
      if (row.length === 0) return;
      
      const wellName = row[0]?.text || `Well-${rowIndex + 1}`;
      if (!wellName || wellName.length < 2) return;
      
      const parameters = {};
      
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
            originalText: cell.text,
            isEditing: false
          };
        }
      });
      
      if (Object.keys(parameters).length > 0) {
        wellData.push({
          id: `well-${rowIndex}`,
          wellName: cleanWellName(wellName),
          date: new Date().toISOString().split('T')[0],
          parameters,
          isVerified: false
        });
      }
    });
    
    return wellData;
  };

  // Helper functions (from your original)
  const normalizeParameterName = (header) => {
    const cleaned = header.toLowerCase().replace(/[^a-z0-9\s]/g, '');
    
    for (const [key, mapping] of Object.entries(PARAMETER_MAPPING)) {
      if (cleaned.includes(key)) {
        return mapping.fullName;
      }
    }
    
    return header.trim();
  };

  const extractValueAndUnit = (text) => {
    if (!text) return { value: '', unit: '' };
    
    const patterns = [
      /(\d+\.?\d*)\s*([A-Za-z°%\/]+)/,
      /(\d+\.?\d*)/,
      /(\d{1,3}(?:,\d{3})*\.?\d*)/
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

  const detectUnit = (parameterName) => {
    const param = parameterName.toLowerCase();
    
    for (const [key, mapping] of Object.entries(PARAMETER_MAPPING)) {
      if (param.includes(key)) {
        return mapping.units[0];
      }
    }
    
    return '';
  };

  const cleanWellName = (name) => {
    return name.replace(/[^a-zA-Z0-9\-]/g, '').trim() || 'Unknown Well';
  };

  // Main processing function
  const processFile = async (uploadedFile) => {
    try {
      setIsProcessing(true);
      setError(null);
      setProgress(0);
      setRawOCRData(null);
      setExtractedTable(null);
      
      const isPDF = uploadedFile.type === 'application/pdf';
      setFileType(isPDF ? 'pdf' : 'image');
      setFile(uploadedFile);
      
      if (isPDF) {
        // Process PDF
        const pages = await convertPDFToImages(uploadedFile);
        setPdfPages(pages);
        
        if (pages.length > 0) {
          setUploadedImage(pages[0].dataUrl);
          await processOCR(pages[0].canvas);
        }
      } else {
        // Process image
        const imageUrl = URL.createObjectURL(uploadedFile);
        setUploadedImage(imageUrl);
        
        setProgress(10);
        const processedFile = await preprocessImage(uploadedFile);
        await processOCR(processedFile);
      }
      
    } catch (err) {
      setError(`Processing failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Run OCR
  const processOCR = async (source) => {
    await initializeWorker();
    setStatus('Extracting text from document...');
    setProgress(35);
    
    const { data } = await workerRef.current.recognize(source);
    setRawOCRData(data);
    
    if (!data || !data.text) {
      throw new Error('No text was extracted from the document');
    }
    
    setStatus('Parsing structured data...');
    setProgress(90);
    
    const tableData = parseTableData(data);
    setExtractedTable(tableData);
    
    setProgress(100);
    setStatus('Processing complete!');
  };

  // Handle PDF page selection
  const selectPage = async (pageIndex) => {
    if (!pdfPages[pageIndex] || isProcessing) return;
    
    setSelectedPage(pageIndex);
    setIsProcessing(true);
    setProgress(0);
    
    try {
      setUploadedImage(pdfPages[pageIndex].dataUrl);
      await processOCR(pdfPages[pageIndex].canvas);
    } catch (error) {
      setError(`Failed to process page: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // File upload handlers
  const handleFileSelect = (selectedFile) => {
    if (!selectedFile) return;
    
    const isPDF = selectedFile.type === 'application/pdf';
    const isImage = selectedFile.type.startsWith('image/');
    
    if (!isPDF && !isImage) {
      setError('Please upload an image (JPG, PNG, GIF) or PDF file');
      return;
    }
    
    if (selectedFile.size > 50 * 1024 * 1024) {
      setError('File size must be less than 50MB');
      return;
    }
    
    processFile(selectedFile);
  };

  // Drag and drop
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, []);

  // Export results
  const exportResults = () => {
    if (!extractedTable?.wellData?.length) return;
    
    const csvData = ['Well Name,Parameter,Value,Unit,Confidence,Row,Col,Original Text'];
    extractedTable.wellData.forEach(well => {
      Object.entries(well.parameters).forEach(([param, data]) => {
        csvData.push(`"${well.wellName}","${param}","${data.value}","${data.unit}","${Math.round(data.confidence * 100)}%","${data.cellPosition.row}","${data.cellPosition.col}","${data.originalText}"`);
      });
    });
    
    const blob = new Blob([csvData.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `enhanced_ocr_test_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Zap className="h-10 w-10 mr-4" />
            <div>
              <h1 className="text-3xl font-bold">Enhanced OCR Quick Test</h1>
              <p className="mt-1 opacity-90">
                Test your EnhancedOilFieldOCR capabilities with PDF and image files
              </p>
            </div>
          </div>
          
          {file && (
            <div className="text-right">
              <p className="text-sm opacity-75">Testing File</p>
              <p className="font-medium">{file.name}</p>
              <p className="text-xs opacity-75">
                {fileType?.toUpperCase()} • {(file.size / 1024 / 1024).toFixed(1)} MB
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Upload Area */}
      <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
        <div
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 cursor-pointer ${
            isDragging
              ? 'border-blue-500 bg-blue-50 scale-105'
              : isProcessing
              ? 'border-gray-300 bg-gray-50 cursor-not-allowed'
              : 'border-gray-300 hover:border-blue-400 hover:bg-blue-25'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !isProcessing && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf"
            onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
            className="hidden"
          />
          
          {isProcessing ? (
            <Clock className="w-16 h-16 mx-auto mb-4 text-blue-500 animate-spin" />
          ) : fileType === 'pdf' ? (
            <FileText className="w-16 h-16 mx-auto mb-4 text-red-500" />
          ) : fileType === 'image' ? (
            <FileImage className="w-16 h-16 mx-auto mb-4 text-blue-500" />
          ) : (
            <Camera className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          )}
          
          <h3 className="text-xl font-semibold text-gray-700 mb-2">
            {isDragging ? 'Drop file here!' : isProcessing ? 'Processing...' : 'Upload Production Sheet for OCR Test'}
          </h3>
          <p className="text-gray-500 mb-4">
            📊 Images (JPG, PNG, GIF) or 📄 PDF documents with oil field data
          </p>
          
          {isProcessing && (
            <div className="w-full max-w-md mx-auto mb-4">
              <div className="bg-gray-200 rounded-full h-3 mb-2">
                <div 
                  className="bg-blue-600 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-sm text-blue-600 font-medium">{status}</p>
            </div>
          )}
          
          {!isProcessing && (
            <button className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium">
              Select File to Test OCR
            </button>
          )}
        </div>

        {/* PDF Page Selector */}
        {fileType === 'pdf' && pdfPages.length > 1 && (
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h4 className="text-sm font-medium text-gray-700 mb-3">
              📄 Select PDF Page to Test ({pdfPages.length} pages available)
            </h4>
            <div className="grid grid-cols-5 md:grid-cols-10 gap-2">
              {pdfPages.map((page, index) => (
                <button
                  key={index}
                  onClick={() => selectPage(index)}
                  disabled={isProcessing}
                  className={`p-3 text-sm rounded-lg border-2 transition-all ${
                    selectedPage === index
                      ? 'border-blue-500 bg-blue-100 text-blue-700 font-medium'
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

      {/* Results */}
      {extractedTable && uploadedImage && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Document Preview */}
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Eye className="h-5 w-5 mr-2" />
              Document Preview
              {fileType === 'pdf' && (
                <span className="ml-2 text-sm text-gray-500">
                  (Page {selectedPage + 1} of {pdfPages.length})
                </span>
              )}
            </h3>
            
            <img
              src={uploadedImage}
              alt="Document preview"
              className="w-full h-auto rounded-lg border shadow-sm max-h-96 object-contain"
            />
          </div>

          {/* OCR Results */}
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <Grid className="h-5 w-5 mr-2" />
                OCR Analysis Results
              </h3>
              
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowRawText(!showRawText)}
                  className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                    showRawText ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {showRawText ? 'Structured' : 'Raw Text'}
                </button>
                
                {extractedTable.wellData?.length > 0 && (
                  <button
                    onClick={exportResults}
                    className="bg-green-600 text-white px-3 py-1 rounded-lg hover:bg-green-700 transition-colors text-sm flex items-center"
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Export
                  </button>
                )}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-4 gap-3 mb-6">
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-lg font-bold text-blue-600">
                  {extractedTable.totalWords || 0}
                </div>
                <div className="text-xs text-gray-600">Words Found</div>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-lg font-bold text-green-600">
                  {extractedTable.wellData?.length || 0}
                </div>
                <div className="text-xs text-gray-600">Wells Detected</div>
              </div>
              <div className="text-center p-3 bg-yellow-50 rounded-lg">
                <div className="text-lg font-bold text-yellow-600">
                  {extractedTable.wellData?.reduce((sum, well) => 
                    sum + Object.keys(well.parameters).length, 0) || 0}
                </div>
                <div className="text-xs text-gray-600">Parameters</div>
              </div>
              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <div className="text-lg font-bold text-purple-600">
                  {Math.round((extractedTable.avgConfidence || 0) * 100)}%
                </div>
                <div className="text-xs text-gray-600">Avg Confidence</div>
              </div>
            </div>

            {/* Results Display */}
            <div className="max-h-96 overflow-y-auto">
              {showRawText ? (
                // Raw OCR Text
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-gray-700 border-b pb-2">
                    📝 Raw OCR Text ({extractedTable.rawText?.length || 0} characters)
                  </h4>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
                      {extractedTable.rawText || 'No text extracted'}
                    </pre>
                  </div>
                </div>
              ) : (
                // Structured Well Data
                <div className="space-y-4">
                  {extractedTable.wellData?.length > 0 ? (
                    <>
                      <h4 className="text-sm font-semibold text-gray-700 border-b pb-2">
                        🎯 Extracted Well Data ({extractedTable.wellData.length} wells)
                      </h4>
                      {extractedTable.wellData.map((well) => (
                        <div key={well.id} className="border rounded-lg p-4 bg-gray-50">
                          <div className="flex items-center justify-between mb-3">
                            <h5 className="font-bold text-blue-600">{well.wellName}</h5>
                            <span className="text-xs text-gray-500">
                              {Object.keys(well.parameters).length} parameters
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {Object.entries(well.parameters).map(([paramName, paramData]) => (
                              <div key={paramName} className="border rounded p-2 bg-white">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs font-medium text-gray-600">
                                    {paramName}
                                  </span>
                                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                    paramData.confidence > 0.8 
                                      ? 'bg-green-100 text-green-700'
                                      : paramData.confidence > 0.6
                                      ? 'bg-yellow-100 text-yellow-700'
                                      : 'bg-red-100 text-red-700'
                                  }`}>
                                    {Math.round(paramData.confidence * 100)}%
                                  </span>
                                </div>
                                <div className="text-sm font-mono">
                                  <span className="text-blue-600 font-bold">{paramData.value}</span>
                                  <span className="text-gray-600 ml-1">{paramData.unit}</span>
                                </div>
                                {paramData.originalText && (
                                  <div className="text-xs text-gray-400 mt-1">
                                    "{paramData.originalText}"
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <Grid className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                      <p className="text-lg">No structured data detected</p>
                      <p className="text-sm">Try the Raw Text view to see what was extracted</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Testing Tips */}
      <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">🔬 OCR Testing Tips</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
          <div>
            <h4 className="font-medium text-blue-600 mb-2">📊 Optimal Image Quality:</h4>
            <ul className="space-y-1 text-gray-600">
              <li>• High contrast, clear text</li>
              <li>• Horizontal alignment</li>
              <li>• Well-lit, minimal shadows</li>
              <li>• Resolution: 300+ DPI</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-green-600 mb-2">📄 PDF Best Practices:</h4>
            <ul className="space-y-1 text-gray-600">
              <li>• Text-based PDFs work better</li>
              <li>• Scanned docs need high quality</li>
              <li>• Simple table layouts</li>
              <li>• Avoid complex formatting</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-purple-600 mb-2">🎯 Table Structure:</h4>
            <ul className="space-y-1 text-gray-600">
              <li>• Well names in first column</li>
              <li>• Clear column headers</li>
              <li>• Consistent data format</li>
              <li>• Avoid merged cells</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedOCRQuickTest;