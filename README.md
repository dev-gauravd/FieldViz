# FieldViz
<div align="center">
  <img src="frontend/public/imgs/logo_mid.png" alt="FieldViz Logo" width="200" height="200">
  
  **Where Field Data Comes to Life**
  
  [![Next.js](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
  [![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
  [![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
  
  A modern oil & gas data management platform with intelligent OCR capabilities for processing handwritten field reports.
</div>

## 🌟 Features

### 📊 **Real-time Dashboard**
- Live production metrics visualization
- Interactive charts for oil/gas production trends
- Wellhead pressure and temperature monitoring
- Historical data analysis with 7-day trends

### 📷 **Advanced OCR Processing**
- Upload handwritten field report images
- Intelligent text extraction using Tesseract.js
- Automatic parameter recognition (Oil Production, Gas Production, Wellhead Pressure, etc.)
- Confidence scoring for extracted data
- Manual review and editing capabilities

### 📝 **Data Management**
- Comprehensive data review interface
- Search and filter OCR records
- Inline editing of extracted values
- Bulk data operations
- Export functionality (JSON, CSV)

### 🔐 **Authentication & Security**
- JWT-based authentication
- Role-based access control (Admin, Engineer)
- Secure API endpoints
- Session management

### 📱 **Modern UI/UX**
- Responsive design for all devices
- Smooth animations with Framer Motion
- Dark mode support (coming soon)
- Intuitive drag-and-drop interfaces

## 🛠️ Tech Stack

### Frontend
- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Custom components with Lucide React icons
- **Charts**: Recharts for data visualization
- **Animations**: Framer Motion
- **OCR**: Tesseract.js for client-side text recognition

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Authentication**: JWT with bcrypt
- **Security**: Helmet, CORS
- **Database**: In-memory storage (MySQL integration planned)

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/gauravd2k1/fieldviz.git
   cd fieldviz
   ```

2. **Install dependencies**
   
   Frontend:
   ```bash
   cd frontend
   npm install
   ```
   
   Backend:
   ```bash
   cd ../backend
   npm install
   ```

3. **Environment setup**
   
   Create `backend/.env`:
   ```env
   JWT_SECRET=your-super-secret-jwt-key-here
   PORT=3001
   NODE_ENV=development
   ```

4. **Start development servers**
   
   Backend (Terminal 1):
   ```bash
   cd backend
   npm run dev
   # or
   node server.js
   ```
   
   Frontend (Terminal 2):
   ```bash
   cd frontend
   npm run dev
   ```

5. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001
   - Health Check: http://localhost:3001/api/health

## 👥 Demo Accounts

Use these credentials to test the application:

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@fieldviz.com | password123 |
| Engineer | engineer@fieldviz.com | password123 |

## 📖 Usage Guide

### 1. Dashboard Overview
- View real-time production metrics
- Analyze trends with interactive charts
- Monitor key performance indicators

### 2. OCR Data Processing
1. Navigate to **"📷 OCR Upload"** tab
2. Configure report date and well name
3. Drag & drop or select an image of handwritten field data
4. Review extracted parameters and confidence scores
5. Edit values if needed
6. Save to backend

### 3. Data Review
1. Go to **"📝 Data Review"** tab
2. Browse all processed OCR records
3. Use filters to find specific records
4. Click on records to view/edit details
5. Update or delete records as needed

## 🔌 API Documentation

### Authentication
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "admin@fieldviz.com",
  "password": "password123"
}
```

### OCR Data Management
```http
# Save OCR results
POST /api/data/field-data
Authorization: Bearer <token>

# Get OCR records
GET /api/data/ocr-records?limit=50&offset=0

# Get specific record
GET /api/data/ocr-records/:id

# Update record
PUT /api/data/ocr-records/:id

# Delete record
DELETE /api/data/ocr-records/:id
```

### Dashboard Data
```http
# Get dashboard metrics
GET /api/data/dashboard
Authorization: Bearer <token>

# Get current metrics
GET /api/data/metrics
Authorization: Bearer <token>
```

## 📁 Project Structure

```
fieldviz/
├── frontend/                 # Next.js frontend application
│   ├── app/                 # App router pages
│   ├── components/          # React components
│   │   ├── Dashboard.tsx    # Production dashboard
│   │   ├── OilFieldOCR.tsx  # OCR processing component
│   │   └── DataReview.tsx   # Data management interface
│   ├── contexts/            # React contexts (Auth)
│   ├── services/            # API services
│   └── types/               # TypeScript type definitions
├── backend/                 # Node.js backend API
│   ├── server.js           # Express server setup
│   ├── routes/             # API routes (planned)
│   ├── middleware/         # Custom middleware (planned)
│   └── models/             # Data models (planned)
├── assets/                 # Images, logos, documentation
└── docs/                   # Additional documentation
```

## 🎯 Supported OCR Parameters

FieldViz automatically recognizes these oil field parameters:

| Parameter | Units | Expected Range |
|-----------|-------|----------------|
| Oil Production | BBL, bbl, BOPD, bopd | 0 - 5,000 |
| Gas Production | MCF, MSCF, SCF, MMCF | 0 - 10,000 |
| Wellhead Pressure | PSI, PSIG, kPa, bar | 0 - 5,000 |
| Temperature | °F, °C, F, C | 32 - 300 |
| Water Cut | %, percent | 0 - 100 |
| Flow Rate | BPD, BOPD, STB/D | 0 - 5,000 |

## 🚀 Deployment

### Docker (Recommended)
```bash
# Build and run with Docker Compose
docker-compose up --build
```

### Manual Deployment
1. Build frontend: `npm run build`
2. Configure production environment variables
3. Deploy to your preferred platform (Vercel, Heroku, AWS, etc.)

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Development Guidelines
- Follow TypeScript best practices
- Use Tailwind CSS for styling
- Write meaningful commit messages
- Add tests for new features
- Update documentation as needed

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🐛 Issues & Support

- 🐛 [Report bugs](https://github.com/gauravd2k1/fieldviz/issues)
- 💡 [Request features](https://github.com/gauravd2k1/fieldviz/issues)
- 📖 [Documentation](https://github.com/gauravd2k1/fieldviz/wiki)
- 💬 [Discussions](https://github.com/gauravd2k1/fieldviz/discussions)

## 🏗️ Roadmap

### v2.0 (Q2 2025)
- [ ] MySQL database integration
- [ ] Advanced analytics dashboard
- [ ] Multi-field support
- [ ] PDF report generation
- [ ] Mobile app (React Native)

### v2.1 (Q3 2025)
- [ ] Machine learning-enhanced OCR
- [ ] Real-time collaboration
- [ ] Advanced data validation
- [ ] Integration with existing field systems
- [ ] Dark mode theme

## 🙏 Acknowledgments

- [Tesseract.js](https://tesseract.projectnaptha.com/) for OCR capabilities
- [Next.js](https://nextjs.org/) for the amazing React framework
- [Tailwind CSS](https://tailwindcss.com/) for beautiful styling
- [Lucide](https://lucide.dev/) for clean, consistent icons
- [Recharts](https://recharts.org/) for powerful data visualization

---

<div align="center">
  
  **Built with ❤️ for the Oil & Gas Industry**
  
  [⭐ Star this repository](https://github.com/gauravd2k1/fieldviz) if you find it helpful!
  
</div>

