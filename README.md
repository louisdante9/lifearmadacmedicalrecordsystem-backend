# Life Armada Medical Record System - Backend API

A comprehensive backend API for managing medical records, patient data, and hospital partnerships in the Life Armada Medical Record System.

## Features

### 🔐 Authentication & Authorization
- JWT-based authentication for medical personnel and patients
- Role-based access control (Admin, Medical Personnel, Patient)
- Secure password hashing with bcrypt
- Token-based session management

### 🏥 Hospital Management
- Partner hospital registration and management
- Hospital information with specialties and facilities
- Partnership status tracking
- Hospital statistics and analytics

### 👥 Patient Management
- Complete patient registration with biodata
- Medical history tracking (blood group, genotype, allergies, chronic illnesses)
- Presenting complaints documentation
- Emergency health subscription management
- HMO provider information
- Multi-hospital patient registration

### 📋 Medical Records
- Comprehensive medical record creation and management
- Vital signs tracking
- Physical examination documentation
- Assessment and diagnosis recording
- Treatment plan management
- Laboratory and imaging results
- Nursing notes
- Discharge information

### 📱 QR Code Integration
- QR code generation for patient access
- Limited access patient information via QR scan
- Emergency access to critical patient data
- QR code validation and regeneration

## API Endpoints

### Authentication (`/api/auth`)
- `POST /register` - Register new user
- `POST /login` - User login
- `GET /me` - Get current user profile
- `PUT /profile` - Update user profile
- `POST /change-password` - Change password
- `POST /logout` - Logout user
- `GET /verify-token` - Verify token validity

### Hospitals (`/api/hospitals`)
- `GET /` - Get all hospitals with filtering
- `GET /partners` - Get partner hospitals
- `GET /:id` - Get single hospital
- `POST /` - Create new hospital (Admin only)
- `PUT /:id` - Update hospital (Admin only)
- `DELETE /:id` - Delete hospital (Admin only)
- `PUT /:id/partnership` - Update partnership status
- `PUT /:id/status` - Update hospital status
- `GET /:id/patients` - Get hospital patients
- `GET /stats/overview` - Get hospital statistics

### Patients (`/api/patients`)
- `GET /` - Get all patients with filtering
- `GET /:id` - Get single patient
- `POST /` - Register new patient
- `PUT /:id` - Update patient information
- `DELETE /:id` - Deactivate patient
- `POST /:id/register-hospital` - Register patient at hospital
- `PUT /:id/medical-history` - Update medical history
- `POST /:id/presenting-complaints` - Add presenting complaints
- `PUT /:id/emergency-subscription` - Update emergency subscription
- `PUT /:id/hmo-provider` - Update HMO provider
- `GET /stats/overview` - Get patient statistics
- `GET /:id/qr-code` - Get patient QR code

### Medical Records (`/api/medical-records`)
- `GET /` - Get all medical records
- `GET /:id` - Get single medical record
- `POST /` - Create new medical record
- `PUT /:id` - Update medical record
- `DELETE /:id` - Archive medical record
- `PUT /:id/vital-signs` - Update vital signs
- `PUT /:id/physical-examination` - Update physical examination
- `PUT /:id/assessment` - Update assessment
- `PUT /:id/treatment` - Update treatment plan
- `POST /:id/laboratory-results` - Add laboratory results
- `POST /:id/imaging-results` - Add imaging results
- `POST /:id/nursing-notes` - Add nursing notes
- `PUT /:id/discharge` - Update discharge information
- `GET /patient/:patientId` - Get patient's medical records
- `GET /stats/overview` - Get medical records statistics

### QR Code (`/api/qr`)
- `GET /generate/:patientId` - Generate QR code for patient
- `GET /scan/:qrCode` - Scan QR code for patient info
- `GET /patient-access/:qrCode` - Get patient access information
- `GET /patient-records/:qrCode` - Get patient records via QR
- `POST /regenerate/:patientId` - Regenerate QR code
- `GET /validate/:qrCode` - Validate QR code
- `GET /download/:patientId` - Download QR code as image

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd lifearmadacMedicalRecordSystem
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp env.example .env
   ```
   Update the `.env` file with your configuration:
   ```env
   MONGODB_URI=mongodb://localhost:27017/lifearmada_medical_records
   JWT_SECRET=your_super_secret_jwt_key_here
   JWT_EXPIRE=7d
   PORT=5000
   NODE_ENV=development
   ```

4. **Start the server**
   ```bash
   # Development
   npm run dev
   
   # Production
   npm start
   ```

## Database Models

### User Model
- Authentication and authorization
- Role-based access (Admin, Medical Personnel, Patient)
- Profile information
- Hospital association for medical personnel

### Hospital Model
- Hospital information and contact details
- Partnership status and type
- Facilities and specialties
- Working hours and emergency services

### Patient Model
- Complete biodata
- Medical history (blood group, genotype, allergies, chronic illnesses)
- Presenting complaints
- Emergency subscription status
- HMO provider information
- Multi-hospital registration
- QR code for limited access

### Medical Record Model
- Visit information
- Vital signs
- Physical examination
- Assessment and diagnosis
- Treatment plans
- Laboratory and imaging results
- Nursing notes
- Discharge information

## Security Features

- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: bcrypt for password security
- **Role-based Access Control**: Different access levels for different user types
- **Data Validation**: Comprehensive input validation
- **Rate Limiting**: API rate limiting to prevent abuse
- **CORS Protection**: Cross-origin resource sharing protection
- **Helmet Security**: Security headers with Helmet.js

## QR Code Features

- **Patient Access**: Patients can access their limited medical information via QR code
- **Emergency Access**: Medical personnel can scan QR codes for emergency patient information
- **Data Security**: Limited information exposure based on access level
- **QR Code Generation**: Automatic QR code generation for new patients
- **QR Code Validation**: Secure QR code validation system

## API Documentation

### Authentication Flow
1. Register/Login to get JWT token
2. Include token in Authorization header: `Bearer <token>`
3. Access protected routes based on user role

### Error Handling
All API responses follow a consistent format:
```json
{
  "success": boolean,
  "message": string,
  "data": object (optional),
  "error": string (optional)
}
```

### Pagination
Most list endpoints support pagination:
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10, max: 100)

### Filtering and Search
- Text search across relevant fields
- Date range filtering
- Status and type filtering
- Hospital and patient-specific filtering

## Development

### Project Structure
```
├── models/           # Database models
├── routes/           # API routes
├── middleware/       # Custom middleware
├── server.js         # Main server file
├── package.json      # Dependencies
└── README.md         # Documentation
```

### Available Scripts
- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm test` - Run tests

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support and questions, please contact the development team or create an issue in the repository.
