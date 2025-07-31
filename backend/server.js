const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

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