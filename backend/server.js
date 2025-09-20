const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs'); // CHANGE 1: Added for sync operations
require('dotenv').config();

const { spawn } = require('child_process');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);

const app = express();

PORT = process.env.PORT || 3000;

// Enable CORS for all routes
app.use(cors({
  origin: "http://localhost:3000", // frontend origin
  credentials: true
}));

// Serve static uploads
app.use("/uploads", express.static("uploads"));



// Middleware
app.use(helmet());
// Dynamic CORS configuration for development
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests from localhost, 127.0.0.1, and any local network IP
    const allowedOrigins = [
      'http://localhost:3000',
      'http://127.0.0.1:3000'
    ];
    
    // Allow any local network IP (192.168.x.x, 10.x.x.x, etc.) in development
    if (!origin || allowedOrigins.includes(origin) || 
        origin.match(/^https?:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+):3000$/)) {
      callback(null, true);
    } else {
      console.warn('🚫 CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// 👈 ADD THESE MISSING MIDDLEWARE LINES:
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies
// app.use('/uploads', express.static('uploads'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


app.use((req, res, next) => {
  console.log(`${req.method} ${req.url} - ${new Date().toISOString()}`);
  next();
});

// Mock users for demo (we'll replace with MySQL later)
const users = [
  {
    id: 1,
    email: 'admin@fieldviz.com',
    password: 'password123', // Plain text for testing
    name: 'Demo Admin',
    role: 'admin'
  },
  {
    id: 2,
    email: 'engineer@fieldviz.com',
    password: 'password123', // Plain text for testing
    name: 'Field Engineer',
    role: 'engineer'
  }
];

// Mock data for dashboard
const mockDashboardData = [
  { date: '2024-07-22', oil_production: 1200, gas_production: 3800, wellhead_pressure: 2100, temperature: 185 },
  { date: '2024-07-23', oil_production: 1180, gas_production: 3750, wellhead_pressure: 2140, temperature: 183 },
  { date: '2024-07-24', oil_production: 1220, gas_production: 3900, wellhead_pressure: 2160, temperature: 187 },
  { date: '2024-07-25', oil_production: 1190, gas_production: 3820, wellhead_pressure: 2145, temperature: 184 },
  { date: '2024-07-26', oil_production: 1240, gas_production: 3950, wellhead_pressure: 2170, temperature: 189 },
  { date: '2024-07-27', oil_production: 1210, gas_production: 3870, wellhead_pressure: 2155, temperature: 186 },
  { date: '2024-07-28', oil_production: 1250, gas_production: 3920, wellhead_pressure: 2165, temperature: 188 }
];

// Authentication middleware
const authenticate = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = users.find(u => u.id === decoded.userId);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// ================================
// AUTH ROUTES
// ================================

// Login route - SIMPLE VERSION FOR TESTING
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    console.log('🔑 BACKEND: Login attempt for:', email);
    console.log('🔑 BACKEND: Password received:', password);
    
    if (!email || !password) {
      console.log('❌ BACKEND: Missing email or password');
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    const user = users.find(u => u.email === email);
    if (!user) {
      console.log('❌ BACKEND: User not found:', email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    console.log('✅ BACKEND: User found:', user.email);
    console.log('🔑 BACKEND: Expected password:', user.password);
    
    // Simple password comparison for testing (replace with bcrypt later)
    const isValidPassword = (password === user.password);
    console.log('🔑 BACKEND: Password valid:', isValidPassword);
    
    if (!isValidPassword) {
      console.log('❌ BACKEND: Invalid password for:', email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '24h' });
    
    console.log('✅ BACKEND: Login successful for:', email);
    
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('❌ BACKEND: Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get profile
app.get('/api/auth/profile', authenticate, (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      email: req.user.email,
      name: req.user.name,
      role: req.user.role
    }
  });
});

// ================================
// DATA ROUTES
// ================================

// Get dashboard data
app.get('/api/data/dashboard', authenticate, (req, res) => {
  try {
    res.json({
      success: true,
      data: mockDashboardData
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// Get current metrics
app.get('/api/data/metrics', authenticate, (req, res) => {
  try {
    const latestData = mockDashboardData[mockDashboardData.length - 1];
    
    const metrics = {
      oil_production: {
        current: latestData.oil_production,
        unit: 'BBL',
        date: latestData.date
      },
      gas_production: {
        current: latestData.gas_production,
        unit: 'MCF',
        date: latestData.date
      },
      wellhead_pressure: {
        current: latestData.wellhead_pressure,
        unit: 'PSI',
        date: latestData.date
      },
      temperature: {
        current: latestData.temperature,
        unit: '°F',
        date: latestData.date
      }
    };
    
    res.json({
      success: true,
      metrics
    });
  } catch (error) {
    console.error('Metrics error:', error);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

// Save field data (for OCR results)
app.post('/api/data/field-data', authenticate, (req, res) => {
  try {
    const { report_id, field_data } = req.body;
    console.log('Saving field data:', { report_id, field_data });
    
    // In a real app, this would save to database
    res.json({
      success: true,
      message: 'Field data saved successfully'
    });
  } catch (error) {
    console.error('Save field data error:', error);
    res.status(500).json({ error: 'Failed to save field data' });
  }
});

// ================================
// UPLOAD ROUTES
// ================================

// Upload images
app.post('/api/upload/images', authenticate, (req, res) => {
  try {
    console.log('Image upload request received');
    
    // In a real app, this would handle file uploads
    res.json({
      success: true,
      report_id: Math.floor(Math.random() * 1000),
      uploaded_files: 1,
      message: 'Files uploaded successfully'
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// ================================
// HEALTH CHECK
// ================================

app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'FieldViz API is running',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// CHANGE 3: REMOVED 404 handler from here - moved to end

// Start server
app.listen(PORT, () => {
  console.log(`🚀 FieldViz backend running on port ${PORT}`);
  console.log(`📊 API Health: http://localhost:${PORT}/api/health`);
  console.log(`🔗 Frontend: ${process.env.FRONTEND_URL}`);
  console.log('');
  console.log('Demo Credentials:');
  console.log('📧 admin@fieldviz.com / password123');
  console.log('📧 engineer@fieldviz.com / password123');
});

// Enhanced API endpoints for OCR data handling
// ================================
// OCR DATA ROUTES
// ================================

// Save OCR extracted field data
app.post('/api/field-data', authenticate, (req, res) => {
  try {
    const { 
      extractedData, 
      uploadedAt, 
      processingMethod, 
      reportDate, 
      fieldName 
    } = req.body;
    
    console.log('📊 OCR Data received:', {
      userId: req.user.id,
      fieldName,
      reportDate,
      parametersCount: extractedData?.length || 0,
      processingMethod
    });

    // Validate required fields
    if (!extractedData || !Array.isArray(extractedData)) {
      return res.status(400).json({ 
        error: 'extractedData is required and must be an array' 
      });
    }

    if (extractedData.length === 0) {
      return res.status(400).json({ 
        error: 'No field data provided' 
      });
    }

    // Validate each data point
    const validatedData = extractedData.map((item, index) => {
      if (!item.parameter || !item.value || !item.unit) {
        throw new Error(`Invalid data at index ${index}: missing parameter, value, or unit`);
      }

      // Convert value to number if possible
      const numericValue = parseFloat(item.value);
      if (isNaN(numericValue)) {
        console.warn(`Non-numeric value detected: ${item.parameter} = ${item.value}`);
      }

      return {
        id: item.id || `param-${index}`,
        parameter: item.parameter.trim(),
        value: item.value.trim(),
        numericValue: !isNaN(numericValue) ? numericValue : null,
        unit: item.unit.trim(),
        confidence: item.confidence || 0,
        originalText: item.originalText || '',
        processedAt: new Date().toISOString()
      };
    });

    // Create report record
    const reportId = Math.floor(Math.random() * 1000000);
    const reportRecord = {
      id: reportId,
      userId: req.user.id,
      fieldName: fieldName || 'Unknown Field',
      reportDate: reportDate || new Date().toISOString().split('T')[0],
      uploadedAt: uploadedAt || new Date().toISOString(),
      processingMethod: processingMethod || 'OCR',
      status: 'processed',
      parametersCount: validatedData.length,
      averageConfidence: validatedData.reduce((sum, item) => sum + item.confidence, 0) / validatedData.length,
      data: validatedData
    };

    // In a real application, you would save this to your database
    // For now, we'll just log it and return success
    console.log('💾 Report saved:', {
      reportId,
      field: reportRecord.fieldName,
      date: reportRecord.reportDate,
      parameters: reportRecord.parametersCount,
      avgConfidence: Math.round(reportRecord.averageConfidence * 100) + '%'
    });

    // TODO: Replace with actual database save
    // await db.reports.create(reportRecord);
    // await db.fieldData.bulkCreate(validatedData.map(item => ({
    //   ...item,
    //   reportId
    // })));

    res.json({
      success: true,
      message: 'Field data saved successfully',
      reportId,
      parametersProcessed: validatedData.length,
      averageConfidence: reportRecord.averageConfidence,
      data: {
        validatedParameters: validatedData.map(item => ({
          parameter: item.parameter,
          value: item.value,
          unit: item.unit,
          confidence: Math.round(item.confidence * 100) + '%'
        }))
      }
    });

  } catch (error) {
    console.error('❌ OCR data save error:', error);
    res.status(500).json({ 
      error: 'Failed to save field data',
      details: error.message
    });
  }
});

// Get saved OCR reports
app.get('/api/field-data/reports', authenticate, (req, res) => {
  try {
    const { page = 1, limit = 10, field, dateFrom, dateTo } = req.query;
    
    // In a real app, this would query your database
    // For demo, return mock data
    const mockReports = [
      {
        id: 1,
        fieldName: 'West Texas Field A',
        reportDate: '2024-07-28',
        uploadedAt: '2024-07-28T10:30:00Z',
        parametersCount: 4,
        averageConfidence: 0.85,
        status: 'processed'
      },
      {
        id: 2,
        fieldName: 'North Dakota Field B',
        reportDate: '2024-07-27',
        uploadedAt: '2024-07-27T14:15:00Z',
        parametersCount: 5,
        averageConfidence: 0.78,
        status: 'processed'
      }
    ];

    res.json({
      success: true,
      reports: mockReports,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: mockReports.length,
        pages: Math.ceil(mockReports.length / limit)
      }
    });

  } catch (error) {
    console.error('Reports fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

// Get specific report details
app.get('/api/field-data/reports/:reportId', authenticate, (req, res) => {
  try {
    const { reportId } = req.params;
    
    // Mock detailed report data
    const mockReport = {
      id: parseInt(reportId),
      fieldName: 'West Texas Field A',
      reportDate: '2024-07-28',
      uploadedAt: '2024-07-28T10:30:00Z',
      processingMethod: 'OCR',
      status: 'processed',
      parametersCount: 4,
      averageConfidence: 0.85,
      data: [
        {
          id: 'oil-1',
          parameter: 'Oil Production',
          value: '1247',
          numericValue: 1247,
          unit: 'BBL',
          confidence: 0.94,
          originalText: 'Oil Production: 1247 BBL',
          processedAt: '2024-07-28T10:30:15Z'
        },
        {
          id: 'gas-1',
          parameter: 'Gas Production',
          value: '3891',
          numericValue: 3891,
          unit: 'MCF',
          confidence: 0.76,
          originalText: 'Gas Production: 3891 MCF',
          processedAt: '2024-07-28T10:30:15Z'
        },
        {
          id: 'pressure-1',
          parameter: 'Wellhead Pressure',
          value: '2156',
          numericValue: 2156,
          unit: 'PSI',
          confidence: 0.89,
          originalText: 'Wellhead Pressure: 2156 PSI',
          processedAt: '2024-07-28T10:30:15Z'
        },
        {
          id: 'temp-1',
          parameter: 'Temperature',
          value: '187',
          numericValue: 187,
          unit: '°F',
          confidence: 0.82,
          originalText: 'Temperature: 187°F',
          processedAt: '2024-07-28T10:30:15Z'
        }
      ]
    };

    res.json({
      success: true,
      report: mockReport
    });

  } catch (error) {
    console.error('Report detail error:', error);
    res.status(500).json({ error: 'Failed to fetch report details' });
  }
});

// Update/edit specific field data
app.put('/api/field-data/:dataId', authenticate, (req, res) => {
  try {
    const { dataId } = req.params;
    const { value, unit, confidence } = req.body;

    if (!value || !unit) {
      return res.status(400).json({ 
        error: 'Value and unit are required' 
      });
    }

    // In a real app, update the database record
    console.log('📝 Updating field data:', {
      dataId,
      value,
      unit,
      confidence,
      updatedBy: req.user.id
    });

    res.json({
      success: true,
      message: 'Field data updated successfully',
      updatedData: {
        id: dataId,
        value,
        unit,
        confidence,
        updatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Data update error:', error);
    res.status(500).json({ error: 'Failed to update field data' });
  }
});

// Delete field data
app.delete('/api/field-data/:dataId', authenticate, (req, res) => {
  try {
    const { dataId } = req.params;

    // In a real app, delete from database
    console.log('🗑️ Deleting field data:', {
      dataId,
      deletedBy: req.user.id
    });

    res.json({
      success: true,
      message: 'Field data deleted successfully'
    });

  } catch (error) {
    console.error('Data delete error:', error);
    res.status(500).json({ error: 'Failed to delete field data' });
  }
});

// OCR Statistics endpoint
app.get('/api/field-data/stats', authenticate, (req, res) => {
  try {
    // Mock statistics
    const stats = {
      totalReports: 156,
      totalParameters: 624,
      averageConfidence: 0.83,
      topFields: [
        { name: 'West Texas Field A', reportCount: 45 },
        { name: 'North Dakota Field B', reportCount: 32 },
        { name: 'Oklahoma Field C', reportCount: 28 }
      ],
      parameterDistribution: {
        'Oil Production': 156,
        'Gas Production': 156,
        'Wellhead Pressure': 145,
        'Temperature': 138,
        'Water Cut': 89,
        'Flow Rate': 67
      },
      confidenceDistribution: {
        high: 421,    // 80%+
        medium: 152,  // 60-80%
        low: 51       // <60%
      },
      monthlyReports: [
        { month: 'Jan', count: 18 },
        { month: 'Feb', count: 22 },
        { month: 'Mar', count: 19 },
        { month: 'Apr', count: 24 },
        { month: 'May', count: 21 },
        { month: 'Jun', count: 26 },
        { month: 'Jul', count: 26 }
      ]
    };

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Bulk operations for field data
app.post('/api/field-data/bulk-approve', authenticate, (req, res) => {
  try {
    const { dataIds, minConfidence = 0.8 } = req.body;

    if (!dataIds || !Array.isArray(dataIds)) {
      return res.status(400).json({ 
        error: 'dataIds array is required' 
      });
    }

    // In a real app, bulk update database records
    console.log('✅ Bulk approving field data:', {
      count: dataIds.length,
      minConfidence,
      approvedBy: req.user.id
    });

    res.json({
      success: true,
      message: `${dataIds.length} field data points approved`,
      approvedCount: dataIds.length
    });

  } catch (error) {
    console.error('Bulk approve error:', error);
    res.status(500).json({ error: 'Failed to bulk approve data' });
  }
});

// Enhanced backend API routes for complex tabular OCR data
// Add these routes to your existing server.js

// Database connection (add to your server.js)
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'fieldviz',
  timezone: '+00:00'
};

let dbPool;

async function initializeDatabase() {
  try {
    dbPool = mysql.createPool({
      ...dbConfig,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
    
    console.log('✅ Database connected successfully');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
  }
}

// Initialize database on startup
initializeDatabase();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/images');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error, null);
    }
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// [All the enhanced OCR routes continue here with same comments...]

// Error handling middleware for file uploads
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size too large. Maximum size is 50MB.' });
    }
  }
  next(error);
});

app.get('/api/test', (req, res) => {
  console.log('Test endpoint hit');
  res.json({ message: 'API working!', timestamp: new Date().toISOString() });
});

// CHANGE 4: Updated segmentation endpoint with fsSync
app.post('/api/segment-and-ocr', upload.single('image'), async (req, res) => {
  try {
    console.log('Segmentation endpoint hit!');
    console.log('Received file:', req.file ? req.file.originalname : 'No file');

    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded' });
    }

    const imagePath = req.file.path;

    // Fixed absolute paths
    const modelPath = path.join(__dirname, '..', 'segmentation', 'Segmentation_Studio', 'best.pt');
    const scriptPath = path.join(__dirname, '..', 'segmentation', 'Segmentation_Studio', 'segment.py');
    const outputDir = path.join(__dirname, 'uploads', 'segments');

    // Ensure output directory exists
    if (!fsSync.existsSync(outputDir)) {
      fsSync.mkdirSync(outputDir, { recursive: true });
    }

    console.log('Running segmentation script...');
    console.log('Script path:', scriptPath);
    console.log('Model path:', modelPath);
    console.log('Image path:', imagePath);
    console.log('Output dir:', outputDir);

    // Validate inputs
    if (!fsSync.existsSync(modelPath)) {
      return res.status(500).json({ error: 'Model file not found: ' + modelPath });
    }
    if (!fsSync.existsSync(scriptPath)) {
      return res.status(500).json({ error: 'Python script not found: ' + scriptPath });
    }
    if (!fsSync.existsSync(imagePath)) {
      return res.status(500).json({ error: 'Image file not found: ' + imagePath });
    }

    try {
      // Run Python segmentation script
      const { stdout, stderr } = await execFileAsync('python', [
        scriptPath,
        '--model', modelPath,
        '--image', imagePath,
        '--output', outputDir,
      ], { 
        timeout: 30000,
        encoding: 'utf8',
        maxBuffer: 1024 * 1024 
      });

      console.log('Python script completed');

      if (stderr) {
        console.error('Python stderr:', stderr);
        if (stderr.includes('Error') || stderr.includes('Exception') || stderr.includes('Traceback')) {
          return res.status(500).json({ error: 'Python script error: ' + stderr });
        }
      }

      if (!stdout || stdout.trim() === '') {
        console.error('No output from Python script');
        return res.status(500).json({ error: 'No output from segmentation script' });
      }

      console.log('Raw stdout:', stdout.substring(0, 500) + '...');

      let result;
      try {
        result = JSON.parse(stdout);
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        console.error('Raw stdout:', stdout);
        return res.status(500).json({ error: 'Invalid JSON from Python script' });
      }

      //  Fix URLs to point to static route
      const segmentsWithUrls = (result.segments || []).map(segment => ({
        ...segment,
        url: `/segments/${segment.filename}`   // Served by express.static
      }));

      let previewUrl = null;
      if (result.preview && result.preview.filename) {
        previewUrl = `/segments/${result.preview.filename}`;
      }

      console.log(`Segmentation successful: ${segmentsWithUrls.length} segments found`);

      res.json({ 
        success: true, 
        segments: segmentsWithUrls,
        totalSegments: segmentsWithUrls.length,
        preview: {
          url: previewUrl,
          detected_objects: result.preview?.detected_objects || []
        }
      });

    } catch (execError) {
      console.error('Execution error:', execError);

      if (execError.killed && execError.signal === 'SIGTERM') {
        return res.status(500).json({ error: 'Segmentation timed out after 30 seconds' });
      }

      if (execError.code === 'ENOENT') {
        return res.status(500).json({ error: 'Python not found. Please install Python and ensure it\'s in PATH' });
      }

      return res.status(500).json({ 
        error: 'Failed to run segmentation',
        details: execError.message
      });
    }

  } catch (error) {
    console.error('Route error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message
    });
  }
});


// exporting to excel function
// export to excel route later maybe modify the data route to accept excel export query

app.post('/api/export-to-excel', async (req, res) => {
  try {
    const { selectedSegments, segmentationResult } = req.body;
    
    console.log('Received export request:', {
      selectedSegmentsCount: selectedSegments?.length || 0,
      hasSegmentationResult: !!segmentationResult
    });

    // Validate request data
    if (!selectedSegments || selectedSegments.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No segments selected for export'
      });
    }

    if (!segmentationResult || !segmentationResult.segments) {
      return res.status(400).json({
        success: false,
        message: 'No segmentation result provided'
      });
    }

    // Process each selected segment
    const exportResults = [];
    const baseOutputDir = path.join(__dirname, 'exports');
    const modelsDir = path.join(__dirname,  '..','segmentation', 'Segmentation_Studio', 'models');
    
    console.log('Paths:', {
      baseOutputDir,
      modelsDir,
      __dirname
    });
    
    // Ensure output directory exists
    if (!fsSync.existsSync(baseOutputDir)) {
      fsSync.mkdirSync(baseOutputDir, { recursive: true });
      console.log('Created exports directory');
    }

    // Verify models directory exists
    if (!fsSync.existsSync(modelsDir)) {
      console.error('Models directory not found:', modelsDir);
      return res.status(500).json({
        success: false,
        message: `Models directory not found: ${modelsDir}`
      });
    }

    // Verify model files exist
    const columnModelPath = path.join(modelsDir, 'column_detect.pt');
    const rowModelPath = path.join(modelsDir, 'row_detect.pt');
    
    console.log('Checking model files:', {
      columnModelPath,
      rowModelPath,
      columnExists: fsSync.existsSync(columnModelPath),
      rowExists: fsSync.existsSync(rowModelPath)
    });
    
    if (!fsSync.existsSync(columnModelPath)) {
      return res.status(500).json({
        success: false,
        message: `Column detection model not found: ${columnModelPath}`
      });
    }
    
    if (!fsSync.existsSync(rowModelPath)) {
      return res.status(500).json({
        success: false,
        message: `Row detection model not found: ${rowModelPath}`
      });
    }

    console.log('All file checks passed, processing segments...');

    // Process selected segments sequentially
    for (let i = 0; i < selectedSegments.length; i++) {
      const segmentIndex = selectedSegments[i];
      const segment = segmentationResult.segments[segmentIndex];
      
      if (!segment || !segment.url) {
        console.warn(`Invalid segment at index ${segmentIndex}`);
        exportResults.push({
          segmentIndex,
          status: 'error',
          message: `Invalid segment at index ${segmentIndex}`
        });
        continue;
      }

      try {
        // Get the full path to the segment image
        const segmentImagePath = path.join(__dirname, 'uploads', segment.url);
        
        console.log('Processing segment:', {
          index: segmentIndex,
          url: segment.url,
          fullPath: segmentImagePath,
          exists: fsSync.existsSync(segmentImagePath)
        });
        
        // Verify segment image exists
        if (!fsSync.existsSync(segmentImagePath)) {
          console.warn(`Segment image not found: ${segmentImagePath}`);
          exportResults.push({
            segmentIndex,
            status: 'error',
            message: `Segment image not found: ${segment.url}`
          });
          continue;
        }

        console.log(`Processing segment ${i + 1}/${selectedSegments.length}:`, segment.url);

        // Create Python process to handle this segment
        const result = await runPythonWorkflow(segmentImagePath, baseOutputDir, modelsDir);
        
        exportResults.push({
          segmentIndex,
          segmentUrl: segment.url,
          segmentLabel: segment.label,
          ...result
        });

      } catch (error) {
        console.error(`Error processing segment ${segmentIndex}:`, error);
        exportResults.push({
          segmentIndex,
          status: 'error',
          message: error.message
        });
      }
    }

    // Check if any exports were successful
    const successfulExports = exportResults.filter(r => r.status === 'success');
    const failedExports = exportResults.filter(r => r.status === 'error');

    console.log('Export completed:', {
      total: selectedSegments.length,
      successful: successfulExports.length,
      failed: failedExports.length
    });

    res.json({
      success: successfulExports.length > 0,
      message: `Exported ${successfulExports.length} segments successfully. ${failedExports.length} failed.`,
      results: exportResults,
      summary: {
        total: selectedSegments.length,
        successful: successfulExports.length,
        failed: failedExports.length
      }
    });

  } catch (error) {
    console.error('Export to Excel error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during export',
      error: error.message
    });
  }
});

// Helper function to run Python workflow
function runPythonWorkflow(segmentImagePath, outputDir, modelsDir) {
  return new Promise((resolve, reject) => {
    const workflowPath = path.join(__dirname, "..",'segmentation', 'Segmentation_Studio', 'workflow.py');
    
    console.log('Python workflow details:', {
      workflowPath,
      segmentImagePath,
      outputDir,
      modelsDir,
      workflowExists: fsSync.existsSync(workflowPath)
    });
    
    // Verify workflow.py exists
    if (!fsSync.existsSync(workflowPath)) {
      return reject(new Error(`Workflow script not found: ${workflowPath}`));
    }

    console.log('Starting Python process...');
    const pythonProcess = spawn('python', [
      workflowPath,
      segmentImagePath,
      outputDir,
      modelsDir
    ]);

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log('Python stdout:', output);
      stdout += output;
    });

    pythonProcess.stderr.on('data', (data) => {
      const output = data.toString();
      console.error('Python stderr:', output);
      stderr += output;
    });

    pythonProcess.on('close', (code) => {
      console.log(`Python process exited with code ${code}`);
      console.log('Final stdout:', stdout);
      console.log('Final stderr:', stderr);
      
      if (code === 0) {
        try {
          // Try to parse the last line as JSON (our result)
          const lines = stdout.trim().split('\n');
          let result = null;
          
          // Look for JSON result (usually the last line)
          for (let i = lines.length - 1; i >= 0; i--) {
            try {
              const line = lines[i].trim();
              if (line.startsWith('{') && line.endsWith('}')) {
                result = JSON.parse(line);
                break;
              }
            } catch (e) {
              // Continue looking for valid JSON
            }
          }
          
          if (result && result.status) {
            console.log('Parsed Python result:', result);
            resolve(result);
          } else {
            console.log('No JSON result found, using default success response');
            resolve({
              status: 'success',
              message: 'Excel export completed',
              output: stdout,
              timestamp: new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19)
            });
          }
        } catch (parseError) {
          console.error('Error parsing Python output:', parseError);
          resolve({
            status: 'success',
            message: 'Excel export completed (output parsing failed)',
            output: stdout,
            timestamp: new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19)
          });
        }
      } else {
        console.error(`Python process failed with code ${code}`);
        reject(new Error(`Python process failed with code ${code}. stderr: ${stderr}`));
      }
    });

    pythonProcess.on('error', (error) => {
      console.error('Failed to start Python process:', error);
      reject(new Error(`Failed to start Python process: ${error.message}`));
    });

    // Set a timeout for long-running processes (e.g., 5 minutes)
    setTimeout(() => {
      console.log('Python process timeout, killing...');
      pythonProcess.kill();
      reject(new Error('Python process timeout after 5 minutes'));
    }, 300000);
  });
}

// Additional endpoint to download generated Excel files
app.get('/api/download-excel/:timestamp/:filename', (req, res) => {
  try {
    const { timestamp, filename } = req.params;
    const baseOutputDir = path.join(__dirname, 'exports');
    const filePath = path.join(baseOutputDir, `export_${timestamp}`, 'Excel', filename);
    
    console.log('Download request:', {
      timestamp,
      filename,
      filePath,
      exists: fsSync.existsSync(filePath)
    });
    
    // Verify file exists and is within allowed directory
    if (!fsSync.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Security check: ensure the file is within the exports directory
    const resolvedPath = path.resolve(filePath);
    const resolvedBaseDir = path.resolve(baseOutputDir);
    
    if (!resolvedPath.startsWith(resolvedBaseDir)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Set appropriate headers for Excel file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    // Stream the file
    const fileStream = fsSync.createReadStream(filePath);
    fileStream.pipe(res);
    
    fileStream.on('error', (error) => {
      console.error('Error streaming file:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'Error downloading file'
        });
      }
    });
    
  } catch (error) {
    console.error('Download Excel error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during download',
      error: error.message
    });
  }
});

// Endpoint to list available exports
app.get('/api/exports', (req, res) => {
  try {
    const baseOutputDir = path.join(__dirname, 'exports');
    
    if (!fsSync.existsSync(baseOutputDir)) {
      return res.json({
        success: true,
        exports: []
      });
    }

    const exports = [];
    const exportDirs = fsSync.readdirSync(baseOutputDir)
      .filter(item => {
        const itemPath = path.join(baseOutputDir, item);
        return fsSync.statSync(itemPath).isDirectory() && item.startsWith('export_');
      });

    for (const exportDir of exportDirs) {
      const timestamp = exportDir.replace('export_', '');
      const excelDir = path.join(baseOutputDir, exportDir, 'Excel');
      
      if (fsSync.existsSync(excelDir)) {
        const excelFiles = fsSync.readdirSync(excelDir)
          .filter(file => file.endsWith('.xlsx'))
          .map(file => {
            const filePath = path.join(excelDir, file);
            const stats = fsSync.statSync(filePath);
            return {
              filename: file,
              size: stats.size,
              created: stats.birthtime,
              downloadUrl: `/api/download-excel/${timestamp}/${file}`
            };
          });

        if (excelFiles.length > 0) {
          exports.push({
            timestamp,
            exportDir: exportDir,
            files: excelFiles
          });
        }
      }
    }

    // Sort by timestamp (newest first)
    exports.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    res.json({
      success: true,
      exports
    });

  } catch (error) {
    console.error('List exports error:', error);
    res.status(500).json({
      success: false,
      message: 'Error listing exports',
      error: error.message
    });
  }
});

// Endpoint to clean up old exports (optional)
app.delete('/api/exports/:timestamp', (req, res) => {
  try {
    const { timestamp } = req.params;
    const baseOutputDir = path.join(__dirname, 'exports');
    const exportDir = path.join(baseOutputDir, `export_${timestamp}`);
    
    if (!fsSync.existsSync(exportDir)) {
      return res.status(404).json({
        success: false,
        message: 'Export not found'
      });
    }

    // Security check
    const resolvedPath = path.resolve(exportDir);
    const resolvedBaseDir = path.resolve(baseOutputDir);
    
    if (!resolvedPath.startsWith(resolvedBaseDir)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Recursively delete the export directory
    fsSync.rmSync(exportDir, { recursive: true, force: true });

    res.json({
      success: true,
      message: `Export ${timestamp} deleted successfully`
    });

  } catch (error) {
    console.error('Delete export error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting export',
      error: error.message
    });
  }
});

// CHANGE 5: 404 handler moved to the very end
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handling
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});


