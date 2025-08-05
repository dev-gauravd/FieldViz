// tests/api.test.js
import request from 'supertest';
import app from '../server';

describe('API Endpoints', () => {
  let authToken;

  beforeAll(async () => {
    // Login and get token
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'engineer@fieldviz.com',
        password: 'password123'
      });
    
    authToken = response.body.token;
  });

  describe('POST /api/field-data/tabular', () => {
    test('should save tabular OCR data', async () => {
      const testData = {
        extractedData: [{
          well_name: 'TEST-001',
          date: '2024-01-01',
          field_name: 'Test Field',
          parameters: [{
            parameter_name: 'Oil Production',
            parameter_value: 1250,
            unit: 'BBL',
            confidence_score: 0.95
          }]
        }],
        reportDate: '2024-01-01',
        fieldName: 'Test Field',
        totalWells: 1,
        totalParameters: 1
      };

      const response = await request(app)
        .post('/api/field-data/tabular')
        .set('Authorization', `Bearer ${authToken}`)
        .send(testData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.wellsProcessed).toBe(1);
    });

    test('should reject invalid data', async () => {
      const response = await request(app)
        .post('/api/field-data/tabular')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ extractedData: 'invalid' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('extractedData');
    });
  });

  describe('GET /api/field-data/enhanced-stats', () => {
    test('should return analytics data', async () => {
      const response = await request(app)
        .get('/api/field-data/enhanced-stats')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.stats).toHaveProperty('overview');
      expect(response.body.stats).toHaveProperty('parameterDistribution');
    });
  });
});
