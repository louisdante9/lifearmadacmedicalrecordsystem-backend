const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Verify JWT token
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).populate('profile.hospitalId');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token - user not found'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Token verification failed'
    });
  }
};

// Check if user has required role
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    next();
  };
};

// Check if user is medical personnel
const requireMedicalPersonnel = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  if (req.user.role !== 'medical_personnel' && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Medical personnel access required'
    });
  }

  next();
};

// Check if user is patient
const requirePatient = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  if (req.user.role !== 'patient') {
    return res.status(403).json({
      success: false,
      message: 'Patient access required'
    });
  }

  next();
};

// Check if user is admin
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }

  next();
};

// Check if user can access patient data
const canAccessPatient = async (req, res, next) => {
  try {
    const { patientId } = req.params;
    const user = req.user;

    // Admin can access all patients
    if (user.role === 'admin') {
      return next();
    }

    // Medical personnel can access patients from their hospital
    if (user.role === 'medical_personnel') {
      const Patient = require('../models/Patient');
      const patient = await Patient.findById(patientId);
      
      if (!patient) {
        return res.status(404).json({
          success: false,
          message: 'Patient not found'
        });
      }

      // Check if patient is registered at the user's hospital
      const isRegisteredAtHospital = patient.registeredHospitals.some(
        reg => reg.hospital.toString() === user.profile.hospitalId.toString() && reg.isActive
      );

      if (!isRegisteredAtHospital && patient.primaryHospital.toString() !== user.profile.hospitalId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied - patient not registered at your hospital'
        });
      }

      return next();
    }

    // Patients can only access their own data
    if (user.role === 'patient') {
      if (user.patientId !== patientId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied - can only access own records'
        });
      }
      return next();
    }

    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error checking patient access'
    });
  }
};

// Check if user can access medical records
const canAccessMedicalRecord = async (req, res, next) => {
  try {
    const { recordId } = req.params;
    const user = req.user;

    const MedicalRecord = require('../models/MedicalRecord');
    const record = await MedicalRecord.findById(recordId)
      .populate('patient')
      .populate('hospital');

    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Medical record not found'
      });
    }

    // Admin can access all records
    if (user.role === 'admin') {
      return next();
    }

    // Medical personnel can access records from their hospital
    if (user.role === 'medical_personnel') {
      if (record.hospital._id.toString() !== user.profile.hospitalId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied - record not from your hospital'
        });
      }
      return next();
    }

    // Patients can only access their own records
    if (user.role === 'patient') {
      if (record.patient._id.toString() !== user.patientId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied - can only access own records'
        });
      }
      return next();
    }

    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error checking medical record access'
    });
  }
};

module.exports = {
  authenticateToken,
  authorize,
  requireMedicalPersonnel,
  requirePatient,
  requireAdmin,
  canAccessPatient,
  canAccessMedicalRecord
};

