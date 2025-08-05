const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
require('dotenv').config();


const app = express();
const PORT = process.env.PORT || 3001;

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

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handling
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

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

// ================================
// ENHANCED OCR DATA ROUTES
// ================================

// Save complex tabular OCR data
app.post('/api/field-data/tabular', authenticate, async (req, res) => {
  const connection = await dbPool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { 
      extractedData, 
      uploadedAt, 
      processingMethod, 
      reportDate, 
      fieldName,
      totalWells,
      totalParameters,
      imageMetadata
    } = req.body;
    
    console.log('📊 Enhanced OCR Data received:', {
      userId: req.user.id,
      fieldName,
      reportDate,
      wellsCount: totalWells,
      parametersCount: totalParameters,
      processingMethod
    });

    // Validate required fields
    if (!extractedData || !Array.isArray(extractedData)) {
      await connection.rollback();
      return res.status(400).json({ 
        error: 'extractedData is required and must be an array' 
      });
    }

    // Get or create oil field
    let [fieldResults] = await connection.execute(
      'SELECT id FROM oil_fields WHERE name = ?',
      [fieldName]
    );
    
    let fieldId;
    if (fieldResults.length === 0) {
      const [insertResult] = await connection.execute(
        'INSERT INTO oil_fields (name, location, status) VALUES (?, ?, ?)',
        [fieldName, 'Unknown Location', 'active']
      );
      fieldId = insertResult.insertId;
    } else {
      fieldId = fieldResults[0].id;
    }

    // Create report record
    const [reportResult] = await connection.execute(
      `INSERT INTO reports (
        oil_field_id, report_date, report_type, status, uploaded_by, 
        processing_method, total_wells_processed, total_parameters_extracted,
        notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        fieldId, 
        reportDate, 
        'daily', 
        'processing', 
        req.user.id,
        processingMethod,
        totalWells,
        totalParameters,
        `Processed via enhanced OCR at ${uploadedAt}`
      ]
    );
    
    const reportId = reportResult.insertId;

    // Process each well's data
    const processedWells = [];
    
    for (const wellData of extractedData) {
      try {
        // Get or create well
        let [wellResults] = await connection.execute(
          'SELECT id FROM wells WHERE well_name = ? AND oil_field_id = ?',
          [wellData.well_name, fieldId]
        );
        
        let wellId;
        if (wellResults.length === 0) {
          const [wellInsertResult] = await connection.execute(
            'INSERT INTO wells (oil_field_id, well_name, status) VALUES (?, ?, ?)',
            [fieldId, wellData.well_name, 'active']
          );
          wellId = wellInsertResult.insertId;
        } else {
          wellId = wellResults[0].id;
        }

        // Create well data snapshot
        const [snapshotResult] = await connection.execute(
          `INSERT INTO well_data_snapshots (
            report_id, well_id, snapshot_date, data_source, notes
          ) VALUES (?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            updated_at = CURRENT_TIMESTAMP`,
          [
            reportId,
            wellId,
            wellData.date,
            'ocr',
            `Enhanced OCR extraction with ${wellData.parameters.length} parameters`
          ]
        );
        
        const snapshotId = snapshotResult.insertId || snapshotResult.info?.insertId;

        // Insert parameters for this well
        const parameterInserts = [];
        
        for (const param of wellData.parameters) {
          // Validate parameter data
          const numericValue = parseFloat(param.parameter_value);
          const isNumeric = !isNaN(numericValue);
          
          parameterInserts.push([
            snapshotId,
            param.parameter_name,
            isNumeric ? numericValue : null,
            param.value_text || param.parameter_value.toString(),
            param.unit || '',
            param.confidence_score || 0,
            param.cell_position?.row || null,
            param.cell_position?.col || null,
            param.bbox?.x || null,
            param.bbox?.y || null,
            param.bbox?.width || null,
            param.bbox?.height || null,
            param.original_text || '',
            false, // is_verified
            null,  // verified_by
            null   // verified_at
          ]);
        }

        if (parameterInserts.length > 0) {
          await connection.execute(
            `INSERT INTO field_data (
              snapshot_id, parameter_name, parameter_value, parameter_value_text,
              unit, confidence_score, cell_position_row, cell_position_col,
              ocr_bbox_x, ocr_bbox_y, ocr_bbox_width, ocr_bbox_height,
              original_text, is_verified, verified_by, verified_at
            ) VALUES ?`,
            [parameterInserts]
          );
        }

        processedWells.push({
          wellName: wellData.well_name,
          wellId,
          snapshotId,
          parametersCount: wellData.parameters.length
        });

      } catch (wellError) {
        console.error(`Error processing well ${wellData.well_name}:`, wellError);
        // Continue with other wells
      }
    }

    // Update report status
    await connection.execute(
      'UPDATE reports SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['completed', reportId]
    );

    await connection.commit();

    console.log('💾 Enhanced report saved:', {
      reportId,
      fieldName,
      wellsProcessed: processedWells.length,
      totalParameters
    });

    res.json({
      success: true,
      message: 'Enhanced field data saved successfully',
      reportId,
      fieldId,
      wellsProcessed: processedWells.length,
      totalParameters,
      data: {
        processedWells: processedWells.map(w => ({
          wellName: w.wellName,
          parametersCount: w.parametersCount
        }))
      }
    });

  } catch (error) {
    await connection.rollback();
    console.error('❌ Enhanced OCR data save error:', error);
    res.status(500).json({ 
      error: 'Failed to save enhanced field data',
      details: error.message
    });
  } finally {
    connection.release();
  }
});

// Get enhanced reports with well and parameter details
app.get('/api/field-data/reports/enhanced', authenticate, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      field_id, 
      date_from, 
      date_to,
      status,
      min_confidence
    } = req.query;
    
    let whereConditions = [];
    let queryParams = [];
    
    if (field_id) {
      whereConditions.push('r.oil_field_id = ?');
      queryParams.push(field_id);
    }
    
    if (date_from) {
      whereConditions.push('r.report_date >= ?');
      queryParams.push(date_from);
    }
    
    if (date_to) {
      whereConditions.push('r.report_date <= ?');
      queryParams.push(date_to);
    }
    
    if (status) {
      whereConditions.push('r.status = ?');
      queryParams.push(status);
    }
    
    if (min_confidence) {
      whereConditions.push('r.average_confidence_score >= ?');
      queryParams.push(parseFloat(min_confidence) / 100);
    }

    const whereClause = whereConditions.length > 0 
      ? 'WHERE ' + whereConditions.join(' AND ')
      : '';

    const [reports] = await dbPool.execute(`
      SELECT 
        r.*,
        of.name as field_name,
        of.location,
        u.name as uploaded_by_name,
        COUNT(DISTINCT wds.well_id) as wells_count,
        COUNT(fd.id) as parameters_count,
        AVG(fd.confidence_score) as avg_confidence,
        SUM(CASE WHEN fd.is_verified = TRUE THEN 1 ELSE 0 END) as verified_count
      FROM reports r
      LEFT JOIN oil_fields of ON r.oil_field_id = of.id
      LEFT JOIN users u ON r.uploaded_by = u.id
      LEFT JOIN well_data_snapshots wds ON r.id = wds.report_id
      LEFT JOIN field_data fd ON wds.id = fd.snapshot_id
      ${whereClause}
      GROUP BY r.id
      ORDER BY r.created_at DESC
      LIMIT ? OFFSET ?
    `, [...queryParams, parseInt(limit), (parseInt(page) - 1) * parseInt(limit)]);

    // Get total count
    const [countResult] = await dbPool.execute(`
      SELECT COUNT(DISTINCT r.id) as total
      FROM reports r
      LEFT JOIN oil_fields of ON r.oil_field_id = of.id
      ${whereClause}
    `, queryParams);

    res.json({
      success: true,
      reports: reports.map(report => ({
        ...report,
        avg_confidence: Math.round((report.avg_confidence || 0) * 100),
        verification_rate: report.parameters_count > 0 
          ? Math.round((report.verified_count / report.parameters_count) * 100)
          : 0
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult[0].total,
        pages: Math.ceil(countResult[0].total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Enhanced reports fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch enhanced reports' });
  }
});

// Get detailed report with all wells and parameters
app.get('/api/field-data/reports/:reportId/detailed', authenticate, async (req, res) => {
  try {
    const { reportId } = req.params;
    
    // Get report basic info
    const [reportResults] = await dbPool.execute(`
      SELECT r.*, of.name as field_name, of.location, u.name as uploaded_by_name
      FROM reports r
      LEFT JOIN oil_fields of ON r.oil_field_id = of.id
      LEFT JOIN users u ON r.uploaded_by = u.id
      WHERE r.id = ?
    `, [reportId]);
    
    if (reportResults.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }
    
    const report = reportResults[0];

    // Get all wells and their data for this report
    const [wellsData] = await dbPool.execute(`
      SELECT 
        w.id as well_id,
        w.well_name,
        w.api_number,
        wds.id as snapshot_id,
        wds.snapshot_date,
        wds.is_verified as snapshot_verified,
        fd.id as field_data_id,
        fd.parameter_name,
        fd.parameter_value,
        fd.parameter_value_text,
        fd.unit,
        fd.confidence_score,
        fd.cell_position_row,
        fd.cell_position_col,
        fd.original_text,
        fd.is_verified,
        fd.verified_by,
        fd.verified_at,
        v.name as verified_by_name
      FROM well_data_snapshots wds
      JOIN wells w ON wds.well_id = w.id
      LEFT JOIN field_data fd ON wds.id = fd.snapshot_id
      LEFT JOIN users v ON fd.verified_by = v.id
      WHERE wds.report_id = ?
      ORDER BY w.well_name, fd.parameter_name
    `, [reportId]);

    // Group data by wells
    const wellsMap = new Map();
    
    wellsData.forEach(row => {
      if (!wellsMap.has(row.well_id)) {
        wellsMap.set(row.well_id, {
          wellId: row.well_id,
          wellName: row.well_name,
          apiNumber: row.api_number,
          snapshotDate: row.snapshot_date,
          snapshotVerified: row.snapshot_verified,
          parameters: []
        });
      }
      
      if (row.field_data_id) {
        wellsMap.get(row.well_id).parameters.push({
          id: row.field_data_id,
          parameterName: row.parameter_name,
          value: row.parameter_value,
          valueText: row.parameter_value_text,
          unit: row.unit,
          confidence: Math.round((row.confidence_score || 0) * 100),
          cellPosition: {
            row: row.cell_position_row,
            col: row.cell_position_col
          },
          originalText: row.original_text,
          isVerified: row.is_verified,
          verifiedBy: row.verified_by_name,
          verifiedAt: row.verified_at
        });
      }
    });

    const wells = Array.from(wellsMap.values());

    // Calculate summary statistics
    const totalParameters = wells.reduce((sum, well) => sum + well.parameters.length, 0);
    const verifiedParameters = wells.reduce((sum, well) => 
      sum + well.parameters.filter(p => p.isVerified).length, 0
    );
    const avgConfidence = totalParameters > 0 
      ? wells.reduce((sum, well) => 
          sum + well.parameters.reduce((pSum, p) => pSum + p.confidence, 0), 0
        ) / totalParameters
      : 0;

    res.json({
      success: true,
      report: {
        ...report,
        wells,
        summary: {
          totalWells: wells.length,
          totalParameters,
          verifiedParameters,
          verificationRate: totalParameters > 0 ? Math.round((verifiedParameters / totalParameters) * 100) : 0,
          avgConfidence: Math.round(avgConfidence)
        }
      }
    });

  } catch (error) {
    console.error('Detailed report fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch detailed report' });
  }
});

// Bulk update parameters
app.put('/api/field-data/bulk-update', authenticate, async (req, res) => {
  const connection = await dbPool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { updates } = req.body; // Array of {id, value, unit, isVerified}
    
    if (!updates || !Array.isArray(updates)) {
      await connection.rollback();
      return res.status(400).json({ error: 'Updates array is required' });
    }

    const updatePromises = updates.map(async (update) => {
      const { id, value, unit, isVerified } = update;
      
      const numericValue = parseFloat(value);
      const setVerified = isVerified ? ', is_verified = TRUE, verified_by = ?, verified_at = CURRENT_TIMESTAMP' : '';
      const params = [
        !isNaN(numericValue) ? numericValue : null,
        value.toString(),
        unit || '',
        id
      ];
      
      if (isVerified) {
        params.splice(-1, 0, req.user.id); // Add user ID before the id parameter
      }

      return connection.execute(
        `UPDATE field_data 
         SET parameter_value = ?, parameter_value_text = ?, unit = ?, updated_at = CURRENT_TIMESTAMP${setVerified}
         WHERE id = ?`,
        params
      );
    });

    await Promise.all(updatePromises);
    await connection.commit();

    console.log('✅ Bulk update completed:', {
      updatedCount: updates.length,
      updatedBy: req.user.id
    });

    res.json({
      success: true,
      message: `${updates.length} parameters updated successfully`,
      updatedCount: updates.length
    });

  } catch (error) {
    await connection.rollback();
    console.error('Bulk update error:', error);
    res.status(500).json({ error: 'Failed to bulk update parameters' });
  } finally {
    connection.release();
  }
});

// Enhanced image upload with metadata
app.post('/api/upload/enhanced-images', authenticate, upload.single('image'), async (req, res) => {
  const connection = await dbPool.getConnection();
  
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded' });
    }

    const { reportId, imageWidth, imageHeight, preprocessing } = req.body;

    // Insert image record with enhanced metadata
    const [imageResult] = await connection.execute(
      `INSERT INTO uploaded_images (
        report_id, file_path, original_filename, file_size, file_type,
        image_width, image_height, ocr_status, preprocessing_applied
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        reportId || null,
        req.file.path,
        req.file.originalname,
        req.file.size,
        req.file.mimetype,
        parseInt(imageWidth) || null,
        parseInt(imageHeight) || null,
        'pending',
        preprocessing || null
      ]
    );

    res.json({
      success: true,
      imageId: imageResult.insertId,
      filePath: req.file.path,
      message: 'Image uploaded successfully'
    });

  } catch (error) {
    console.error('Enhanced image upload error:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  } finally {
    connection.release();
  }
});

// Get production analytics
app.get('/api/analytics/production-trends', authenticate, async (req, res) => {
  try {
    const { field_id, date_from, date_to, well_ids } = req.query;
    
    let whereConditions = ['fd.parameter_name IN (?, ?, ?)'];
    let queryParams = ['Oil Production', 'Gas Production', 'Water Production'];
    
    if (field_id) {
      whereConditions.push('of.id = ?');
      queryParams.push(field_id);
    }
    
    if (date_from) {
      whereConditions.push('wds.snapshot_date >= ?');
      queryParams.push(date_from);
    }
    
    if (date_to) {
      whereConditions.push('wds.snapshot_date <= ?');
      queryParams.push(date_to);
    }
    
    if (well_ids) {
      const wellIdArray = well_ids.split(',');
      whereConditions.push(`w.id IN (${wellIdArray.map(() => '?').join(',')})`);
      queryParams.push(...wellIdArray);
    }

    const [trendData] = await dbPool.execute(`
      SELECT 
        wds.snapshot_date as date,
        w.well_name,
        of.name as field_name,
        MAX(CASE WHEN fd.parameter_name = 'Oil Production' THEN fd.parameter_value END) as oil_production,
        MAX(CASE WHEN fd.parameter_name = 'Gas Production' THEN fd.parameter_value END) as gas_production,
        MAX(CASE WHEN fd.parameter_name = 'Water Production' THEN fd.parameter_value END) as water_production,
        AVG(fd.confidence_score) as avg_confidence
      FROM field_data fd
      JOIN well_data_snapshots wds ON fd.snapshot_id = wds.id
      JOIN wells w ON wds.well_id = w.id
      JOIN oil_fields of ON w.oil_field_id = of.id
      WHERE ${whereConditions.join(' AND ')}
      GROUP BY wds.snapshot_date, w.id
      ORDER BY wds.snapshot_date DESC, w.well_name
      LIMIT 1000
    `, queryParams);

    // Aggregate by date for trend analysis
    const dailyTotals = new Map();
    
    trendData.forEach(row => {
      const date = row.date;
      if (!dailyTotals.has(date)) {
        dailyTotals.set(date, {
          date,
          oil_production: 0,
          gas_production: 0,
          water_production: 0,
          wells_count: 0,
          avg_confidence: 0
        });
      }
      
      const daily = dailyTotals.get(date);
      daily.oil_production += row.oil_production || 0;
      daily.gas_production += row.gas_production || 0;
      daily.water_production += row.water_production || 0;
      daily.wells_count += 1;
      daily.avg_confidence += row.avg_confidence || 0;
    });

    // Finalize averages
    const trends = Array.from(dailyTotals.values()).map(daily => ({
      ...daily,
      avg_confidence: Math.round((daily.avg_confidence / daily.wells_count) * 100)
    }));

    res.json({
      success: true,
      trends,
      summary: {
        totalRecords: trendData.length,
        dateRange: {
          from: trends.length > 0 ? trends[trends.length - 1].date : null,
          to: trends.length > 0 ? trends[0].date : null
        }
      }
    });

  } catch (error) {
    console.error('Production trends error:', error);
    res.status(500).json({ error: 'Failed to fetch production trends' });
  }
});

// Validation and data quality checks
app.get('/api/field-data/validation-report/:reportId', authenticate, async (req, res) => {
  try {
    const { reportId } = req.params;
    
    // Get validation rules
    const [rules] = await dbPool.execute(`
      SELECT * FROM validation_rules WHERE is_active = TRUE
    `);

    // Get field data for this report
    const [fieldData] = await dbPool.execute(`
      SELECT 
        fd.*,
        w.well_name,
        pd.min_expected_value,
        pd.max_expected_value,
        pd.data_type
      FROM field_data fd
      JOIN well_data_snapshots wds ON fd.snapshot_id = wds.id
      JOIN wells w ON wds.well_id = w.id
      LEFT JOIN parameter_definitions pd ON fd.parameter_name = pd.parameter_name
      WHERE wds.report_id = ?
    `, [reportId]);

    const validationResults = [];
    
    fieldData.forEach(data => {
      const applicable_rules = rules.filter(rule => 
        rule.parameter_name === data.parameter_name || rule.parameter_name === '*'
      );
      
      applicable_rules.forEach(rule => {
        const ruleDefinition = JSON.parse(rule.rule_definition);
        let isValid = true;
        let message = '';
        
        switch (rule.rule_type) {
          case 'range':
            const value = parseFloat(data.parameter_value);
            if (!isNaN(value)) {
              if (value < ruleDefinition.min || value > ruleDefinition.max) {
                isValid = false;
                message = `Value ${value} is outside expected range (${ruleDefinition.min}-${ruleDefinition.max})`;
              }
            }
            break;
            
          case 'format':
            // Add format validation logic
            break;
        }
        
        if (!isValid) {
          validationResults.push({
            fieldDataId: data.id,
            wellName: data.well_name,
            parameterName: data.parameter_name,
            value: data.parameter_value,
            ruleType: rule.rule_type,
            severity: rule.severity,
            message: message || ruleDefinition.message,
            confidence: data.confidence_score
          });
        }
      });
    });

    res.json({
      success: true,
      validationResults,
      summary: {
        totalChecked: fieldData.length,
        issuesFound: validationResults.length,
        errorCount: validationResults.filter(r => r.severity === 'error').length,
        warningCount: validationResults.filter(r => r.severity === 'warning').length
      }
    });

  } catch (error) {
    console.error('Validation report error:', error);
    res.status(500).json({ error: 'Failed to generate validation report' });
  }
});

// Get field and well lists for dropdowns
app.get('/api/fields-wells', authenticate, async (req, res) => {
  try {
    const [fields] = await dbPool.execute(`
      SELECT id, name, location, field_code, 
             (SELECT COUNT(*) FROM wells WHERE oil_field_id = oil_fields.id) as wells_count
      FROM oil_fields 
      WHERE status = 'active'
      ORDER BY name
    `);

    const [wells] = await dbPool.execute(`
      SELECT w.id, w.well_name, w.api_number, w.oil_field_id, of.name as field_name
      FROM wells w
      JOIN oil_fields of ON w.oil_field_id = of.id
      WHERE w.status = 'active'
      ORDER BY of.name, w.well_name
    `);

    res.json({
      success: true,
      fields,
      wells
    });

  } catch (error) {
    console.error('Fields-wells fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch fields and wells' });
  }
});

// Enhanced statistics endpoint
app.get('/api/field-data/enhanced-stats', authenticate, async (req, res) => {
  try {
    const { field_id, date_from, date_to } = req.query;
    
    let whereConditions = [];
    let queryParams = [];
    
    if (field_id) {
      whereConditions.push('of.id = ?');
      queryParams.push(field_id);
    }
    
    if (date_from) {
      whereConditions.push('wds.snapshot_date >= ?');
      queryParams.push(date_from);
    }
    
    if (date_to) {
      whereConditions.push('wds.snapshot_date <= ?');
      queryParams.push(date_to);
    }

    const whereClause = whereConditions.length > 0 
      ? 'WHERE ' + whereConditions.join(' AND ')
      : '';

    // Get comprehensive statistics
    const [overallStats] = await dbPool.execute(`
      SELECT 
        COUNT(DISTINCT r.id) as total_reports,
        COUNT(DISTINCT w.id) as total_wells,
        COUNT(fd.id) as total_parameters,
        AVG(fd.confidence_score) as avg_confidence,
        SUM(CASE WHEN fd.is_verified = TRUE THEN 1 ELSE 0 END) as verified_count,
        COUNT(DISTINCT wds.snapshot_date) as unique_dates
      FROM reports r
      LEFT JOIN oil_fields of ON r.oil_field_id = of.id
      LEFT JOIN well_data_snapshots wds ON r.id = wds.report_id
      LEFT JOIN wells w ON wds.well_id = w.id
      LEFT JOIN field_data fd ON wds.id = fd.snapshot_id
      ${whereClause}
    `, queryParams);

    // Parameter distribution
    const [parameterStats] = await dbPool.execute(`
      SELECT 
        fd.parameter_name,
        COUNT(*) as count,
        AVG(fd.confidence_score) as avg_confidence,
        SUM(CASE WHEN fd.is_verified = TRUE THEN 1 ELSE 0 END) as verified_count,
        MIN(fd.parameter_value) as min_value,
        MAX(fd.parameter_value) as max_value,
        AVG(fd.parameter_value) as avg_value
      FROM field_data fd
      JOIN well_data_snapshots wds ON fd.snapshot_id = wds.id
      JOIN wells w ON wds.well_id = w.id
      JOIN oil_fields of ON w.oil_field_id = of.id
      ${whereClause}
      GROUP BY fd.parameter_name
      ORDER BY count DESC
    `, queryParams);

    // Top performing wells
    const [topWells] = await dbPool.execute(`
      SELECT 
        w.well_name,
        w.api_number,
        of.name as field_name,
        COUNT(fd.id) as parameter_count,
        AVG(fd.confidence_score) as avg_confidence,
        SUM(CASE WHEN fd.parameter_name = 'Oil Production' THEN fd.parameter_value ELSE 0 END) / COUNT(DISTINCT wds.snapshot_date) as avg_oil_production
      FROM wells w
      JOIN oil_fields of ON w.oil_field_id = of.id
      JOIN well_data_snapshots wds ON w.id = wds.well_id
      LEFT JOIN field_data fd ON wds.id = fd.snapshot_id
      ${whereClause}
      GROUP BY w.id
      HAVING parameter_count > 0
      ORDER BY avg_oil_production DESC
      LIMIT 10
    `, queryParams);

    // Monthly trends
    const [monthlyTrends] = await dbPool.execute(`
      SELECT 
        DATE_FORMAT(wds.snapshot_date, '%Y-%m') as month,
        COUNT(DISTINCT r.id) as reports_count,
        COUNT(DISTINCT w.id) as wells_count,
        COUNT(fd.id) as parameters_count,
        AVG(fd.confidence_score) as avg_confidence
      FROM reports r
      LEFT JOIN oil_fields of ON r.oil_field_id = of.id
      LEFT JOIN well_data_snapshots wds ON r.id = wds.report_id
      LEFT JOIN wells w ON wds.well_id = w.id
      LEFT JOIN field_data fd ON wds.id = fd.snapshot_id
      ${whereClause}
      GROUP BY DATE_FORMAT(wds.snapshot_date, '%Y-%m')
      ORDER BY month DESC
      LIMIT 12
    `, queryParams);

    const stats = overallStats[0];
    
    res.json({
      success: true,
      stats: {
        overview: {
          totalReports: stats.total_reports || 0,
          totalWells: stats.total_wells || 0,
          totalParameters: stats.total_parameters || 0,
          avgConfidence: Math.round((stats.avg_confidence || 0) * 100),
          verificationRate: stats.total_parameters > 0 
            ? Math.round((stats.verified_count / stats.total_parameters) * 100)
            : 0,
          uniqueDates: stats.unique_dates || 0
        },
        parameterDistribution: parameterStats.map(param => ({
          name: param.parameter_name,
          count: param.count,
          avgConfidence: Math.round((param.avg_confidence || 0) * 100),
          verificationRate: param.count > 0 
            ? Math.round((param.verified_count / param.count) * 100)
            : 0,
          valueRange: {
            min: param.min_value,
            max: param.max_value,
            avg: param.avg_value
          }
        })),
        topWells: topWells.map(well => ({
          wellName: well.well_name,
          apiNumber: well.api_number,
          fieldName: well.field_name,
          parameterCount: well.parameter_count,
          avgConfidence: Math.round((well.avg_confidence || 0) * 100),
          avgOilProduction: Math.round(well.avg_oil_production || 0)
        })),
        monthlyTrends: monthlyTrends.map(trend => ({
          month: trend.month,
          reportsCount: trend.reports_count,
          wellsCount: trend.wells_count,
          parametersCount: trend.parameters_count,
          avgConfidence: Math.round((trend.avg_confidence || 0) * 100)
        }))
      }
    });

  } catch (error) {
    console.error('Enhanced stats error:', error);
    res.status(500).json({ error: 'Failed to fetch enhanced statistics' });
  }
});

// Export data in various formats
app.get('/api/field-data/export/:reportId', authenticate, async (req, res) => {
  try {
    const { reportId } = req.params;
    const { format = 'csv', include_unverified = 'true' } = req.query;
    
    let whereCondition = 'wds.report_id = ?';
    let queryParams = [reportId];
    
    if (include_unverified === 'false') {
      whereCondition += ' AND fd.is_verified = TRUE';
    }

    const [exportData] = await dbPool.execute(`
      SELECT 
        r.report_date,
        of.name as field_name,
        w.well_name,
        w.api_number,
        wds.snapshot_date,
        fd.parameter_name,
        fd.parameter_value,
        fd.parameter_value_text,
        fd.unit,
        ROUND(fd.confidence_score * 100, 1) as confidence_percent,
        fd.is_verified,
        fd.original_text,
        u.name as verified_by_name,
        fd.verified_at
      FROM field_data fd
      JOIN well_data_snapshots wds ON fd.snapshot_id = wds.id
      JOIN wells w ON wds.well_id = w.id
      JOIN oil_fields of ON w.oil_field_id = of.id
      JOIN reports r ON wds.report_id = r.id
      LEFT JOIN users u ON fd.verified_by = u.id
      WHERE ${whereCondition}
      ORDER BY w.well_name, fd.parameter_name
    `, queryParams);

    if (format === 'csv') {
      // Generate CSV
      const headers = [
        'Report Date', 'Field Name', 'Well Name', 'API Number', 
        'Snapshot Date', 'Parameter', 'Value', 'Unit', 
        'Confidence %', 'Verified', 'Original Text'
      ];
      
      const csvRows = [headers.join(',')];
      
      exportData.forEach(row => {
        const csvRow = [
          row.report_date,
          `"${row.field_name}"`,
          `"${row.well_name}"`,
          row.api_number || '',
          row.snapshot_date,
          `"${row.parameter_name}"`,
          row.parameter_value || row.parameter_value_text,
          row.unit || '',
          row.confidence_percent,
          row.is_verified ? 'Yes' : 'No',
          `"${row.original_text || ''}"`
        ];
        csvRows.push(csvRow.join(','));
      });
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="field_data_report_${reportId}.csv"`);
      res.send(csvRows.join('\n'));
      
    } else {
      // Return JSON
      res.json({
        success: true,
        data: exportData,
        metadata: {
          exportedAt: new Date().toISOString(),
          recordCount: exportData.length,
          format,
          includeUnverified: include_unverified === 'true'
        }
      });
    }

  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

// Error handling middleware for file uploads
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size too large. Maximum size is 50MB.' });
    }
  }
  next(error);
});