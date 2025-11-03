const { body, param, query, validationResult } = require('express-validator');

// Handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

// User registration validation
const validateUserRegistration = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  body('role')
    .isIn(['medical_personnel', 'patient', 'admin'])
    .withMessage('Invalid role specified'),
  body('profile.firstName')
    .if(body('role').isIn(['medical_personnel', 'admin']))
    .notEmpty()
    .withMessage('First name is required for medical personnel and admin'),
  body('profile.lastName')
    .if(body('role').isIn(['medical_personnel', 'admin']))
    .notEmpty()
    .withMessage('Last name is required for medical personnel and admin'),
  body('profile.hospitalId')
    .if(body('role').equals('medical_personnel'))
    .isMongoId()
    .withMessage('Valid hospital ID is required for medical personnel'),
  handleValidationErrors
];

// User login validation
const validateUserLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  handleValidationErrors
];

// Hospital validation
const validateHospital = [
  body('name')
    .notEmpty()
    .trim()
    .withMessage('Hospital name is required'),
  body('type')
    .isIn(['public', 'private', 'federal', 'state', 'teaching'])
    .withMessage('Invalid hospital type'),
  body('address.city')
    .notEmpty()
    .withMessage('City is required'),
  body('address.state')
    .notEmpty()
    .withMessage('State is required'),
  body('address.lga')
    .notEmpty()
    .withMessage('LGA is required'),
  body('contact.phone')
    .optional()
    .isMobilePhone('en-NG')
    .withMessage('Valid phone number is required'),
  body('contact.email')
    .optional()
    .isEmail()
    .withMessage('Valid email is required'),
  handleValidationErrors
];

// Patient validation
const validatePatient = [
  body('biodata.firstName')
    .notEmpty()
    .trim()
    .withMessage('First name is required'),
  body('biodata.lastName')
    .notEmpty()
    .trim()
    .withMessage('Last name is required'),
  body('biodata.dateOfBirth')
    .isISO8601()
    .withMessage('Valid date of birth is required'),
  body('biodata.gender')
    .isIn(['male', 'female', 'other'])
    .withMessage('Valid gender is required'),
  body('biodata.lga')
    .notEmpty()
    .withMessage('LGA is required'),
  body('biodata.state')
    .notEmpty()
    .withMessage('State is required'),
  body('biodata.contact.phone')
    .isMobilePhone('en-NG')
    .withMessage('Valid phone number is required'),
  body('biodata.contact.email')
    .optional()
    .isEmail()
    .withMessage('Valid email is required'),
  handleValidationErrors
];

// Medical record validation
const validateMedicalRecord = [
  body('patient')
    .isMongoId()
    .withMessage('Valid patient ID is required'),
  body('hospital')
    .isMongoId()
    .withMessage('Valid hospital ID is required'),
  body('visitInfo.visitType')
    .isIn(['routine', 'emergency', 'follow_up', 'consultation', 'surgery'])
    .withMessage('Invalid visit type'),
  body('visitInfo.chiefComplaint')
    .notEmpty()
    .withMessage('Chief complaint is required'),
  body('assessment.primaryDiagnosis')
    .notEmpty()
    .withMessage('Primary diagnosis is required'),
  handleValidationErrors
];

// Query parameter validation
const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  handleValidationErrors
];

// MongoDB ObjectId validation
const validateObjectId = (paramName) => [
  param(paramName)
    .isMongoId()
    .withMessage(`Valid ${paramName} is required`),
  handleValidationErrors
];

// Search validation
const validateSearch = [
  query('q')
    .optional()
    .isLength({ min: 2 })
    .withMessage('Search query must be at least 2 characters'),
  query('type')
    .optional()
    .isIn(['patient', 'hospital', 'record'])
    .withMessage('Invalid search type'),
  handleValidationErrors
];

// Date range validation
const validateDateRange = [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Valid start date is required'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('Valid end date is required'),
  handleValidationErrors
];

// QR code validation
const validateQRCode = [
  body('patientId')
    .isMongoId()
    .withMessage('Valid patient ID is required'),
  body('accessLevel')
    .optional()
    .isIn(['full', 'limited', 'emergency_only'])
    .withMessage('Invalid access level'),
  handleValidationErrors
];

module.exports = {
  handleValidationErrors,
  validateUserRegistration,
  validateUserLogin,
  validateHospital,
  validatePatient,
  validateMedicalRecord,
  validatePagination,
  validateObjectId,
  validateSearch,
  validateDateRange,
  validateQRCode
};

