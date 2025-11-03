const express = require('express');
const Patient = require('../models/Patient');
const Hospital = require('../models/Hospital');
const { authenticateToken, authorize, canAccessPatient, requireMedicalPersonnel } = require('../middleware/auth');
const { validatePatient, validatePagination, validateObjectId, validateSearch, validateDateRange } = require('../middleware/validation');

const router = express.Router();

// @route   GET /api/patients
// @desc    Get all patients with filtering and pagination
// @access  Private (Medical personnel, Admin)
router.get('/', authenticateToken, authorize('medical_personnel', 'admin'), validatePagination, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      hospitalId, 
      gender, 
      lga, 
      state,
      bloodGroup,
      genotype,
      search,
      startDate,
      endDate
    } = req.query;

    // Build query
    const query = { isActive: true };
    
    if (hospitalId) {
      query.$or = [
        { primaryHospital: hospitalId },
        { 'registeredHospitals.hospital': hospitalId, 'registeredHospitals.isActive': true }
      ];
    }
    if (gender) query['biodata.gender'] = gender;
    if (lga) query['biodata.lga'] = new RegExp(lga, 'i');
    if (state) query['biodata.state'] = new RegExp(state, 'i');
    if (bloodGroup) query['medicalHistory.bloodGroup'] = bloodGroup;
    if (genotype) query['medicalHistory.genotype'] = genotype;
    
    if (search) {
      query.$or = [
        { 'biodata.firstName': new RegExp(search, 'i') },
        { 'biodata.lastName': new RegExp(search, 'i') },
        { 'biodata.contact.phone': new RegExp(search, 'i') },
        { patientId: new RegExp(search, 'i') }
      ];
    }

    if (startDate || endDate) {
      query['biodata.dateOfRegistration'] = {};
      if (startDate) query['biodata.dateOfRegistration'].$gte = new Date(startDate);
      if (endDate) query['biodata.dateOfRegistration'].$lte = new Date(endDate);
    }

    const patients = await Patient.find(query)
      .populate('primaryHospital', 'name address')
      .populate('registeredHospitals.hospital', 'name address')
      .sort({ 'biodata.lastName': 1, 'biodata.firstName': 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Patient.countDocuments(query);

    res.json({
      success: true,
      data: {
        patients,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    console.error('Get patients error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get patients',
      error: error.message
    });
  }
});

// @route   GET /api/patients/:id
// @desc    Get single patient by ID
// @access  Private (Medical personnel, Admin, Patient - own records only)
router.get('/:id', authenticateToken, canAccessPatient, validateObjectId('id'), async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id)
      .populate('primaryHospital', 'name address contact')
      .populate('registeredHospitals.hospital', 'name address contact');

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    res.json({
      success: true,
      data: {
        patient
      }
    });
  } catch (error) {
    console.error('Get patient error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get patient',
      error: error.message
    });
  }
});

// @route   POST /api/patients
// @desc    Register new patient
// @access  Private (Medical personnel, Admin)
router.post('/', authenticateToken, authorize('medical_personnel', 'admin'), validatePatient, async (req, res) => {
  try {
    const { primaryHospitalId } = req.body;

    // Verify hospital exists if provided
    if (primaryHospitalId) {
      const hospital = await Hospital.findById(primaryHospitalId);
      if (!hospital) {
        return res.status(400).json({
          success: false,
          message: 'Primary hospital not found'
        });
      }
    }

    // Create patient
    const patient = new Patient(req.body);
    
    if (primaryHospitalId) {
      patient.primaryHospital = primaryHospitalId;
      patient.registeredHospitals.push({
        hospital: primaryHospitalId,
        registrationDate: new Date(),
        isActive: true
      });
    }

    await patient.save();
    await patient.populate('primaryHospital', 'name address');
    await patient.populate('registeredHospitals.hospital', 'name address');

    res.status(201).json({
      success: true,
      message: 'Patient registered successfully',
      data: {
        patient
      }
    });
  } catch (error) {
    console.error('Register patient error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to register patient',
      error: error.message
    });
  }
});

// @route   PUT /api/patients/:id
// @desc    Update patient information
// @access  Private (Medical personnel, Admin)
router.put('/:id', authenticateToken, authorize('medical_personnel', 'admin'), validateObjectId('id'), async (req, res) => {
  try {
    const patient = await Patient.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    )
    .populate('primaryHospital', 'name address')
    .populate('registeredHospitals.hospital', 'name address');

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    res.json({
      success: true,
      message: 'Patient updated successfully',
      data: {
        patient
      }
    });
  } catch (error) {
    console.error('Update patient error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update patient',
      error: error.message
    });
  }
});

// @route   DELETE /api/patients/:id
// @desc    Deactivate patient (soft delete)
// @access  Private (Medical personnel, Admin)
router.delete('/:id', authenticateToken, authorize('medical_personnel', 'admin'), validateObjectId('id'), async (req, res) => {
  try {
    const patient = await Patient.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    res.json({
      success: true,
      message: 'Patient deactivated successfully'
    });
  } catch (error) {
    console.error('Deactivate patient error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to deactivate patient',
      error: error.message
    });
  }
});

// @route   POST /api/patients/:id/register-hospital
// @desc    Register patient at a hospital
// @access  Private (Medical personnel, Admin)
router.post('/:id/register-hospital', authenticateToken, authorize('medical_personnel', 'admin'), validateObjectId('id'), async (req, res) => {
  try {
    const { hospitalId } = req.body;

    if (!hospitalId) {
      return res.status(400).json({
        success: false,
        message: 'Hospital ID is required'
      });
    }

    // Verify hospital exists
    const hospital = await Hospital.findById(hospitalId);
    if (!hospital) {
      return res.status(400).json({
        success: false,
        message: 'Hospital not found'
      });
    }

    const patient = await Patient.findById(req.params.id);
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    // Check if already registered
    const existingRegistration = patient.registeredHospitals.find(
      reg => reg.hospital.toString() === hospitalId && reg.isActive
    );

    if (existingRegistration) {
      return res.status(400).json({
        success: false,
        message: 'Patient already registered at this hospital'
      });
    }

    // Add hospital registration
    patient.registeredHospitals.push({
      hospital: hospitalId,
      registrationDate: new Date(),
      isActive: true
    });

    await patient.save();
    await patient.populate('registeredHospitals.hospital', 'name address');

    res.json({
      success: true,
      message: 'Patient registered at hospital successfully',
      data: {
        patient
      }
    });
  } catch (error) {
    console.error('Register patient at hospital error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to register patient at hospital',
      error: error.message
    });
  }
});

// @route   PUT /api/patients/:id/medical-history
// @desc    Update patient medical history
// @access  Private (Medical personnel, Admin)
router.put('/:id/medical-history', authenticateToken, authorize('medical_personnel', 'admin'), validateObjectId('id'), async (req, res) => {
  try {
    const { medicalHistory } = req.body;

    const patient = await Patient.findByIdAndUpdate(
      req.params.id,
      { $set: { medicalHistory } },
      { new: true, runValidators: true }
    )
    .populate('primaryHospital', 'name address')
    .populate('registeredHospitals.hospital', 'name address');

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    res.json({
      success: true,
      message: 'Medical history updated successfully',
      data: {
        patient
      }
    });
  } catch (error) {
    console.error('Update medical history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update medical history',
      error: error.message
    });
  }
});

// @route   POST /api/patients/:id/presenting-complaints
// @desc    Add presenting complaints
// @access  Private (Medical personnel, Admin)
router.post('/:id/presenting-complaints', authenticateToken, authorize('medical_personnel', 'admin'), validateObjectId('id'), async (req, res) => {
  try {
    const { complaint } = req.body;

    if (!complaint.complaint) {
      return res.status(400).json({
        success: false,
        message: 'Complaint description is required'
      });
    }

    const patient = await Patient.findByIdAndUpdate(
      req.params.id,
      { $push: { presentingComplaints: complaint } },
      { new: true, runValidators: true }
    )
    .populate('primaryHospital', 'name address')
    .populate('registeredHospitals.hospital', 'name address');

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    res.json({
      success: true,
      message: 'Presenting complaint added successfully',
      data: {
        patient
      }
    });
  } catch (error) {
    console.error('Add presenting complaint error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add presenting complaint',
      error: error.message
    });
  }
});

// @route   PUT /api/patients/:id/emergency-subscription
// @desc    Update emergency health subscription
// @access  Private (Medical personnel, Admin)
router.put('/:id/emergency-subscription', authenticateToken, authorize('medical_personnel', 'admin'), validateObjectId('id'), async (req, res) => {
  try {
    const { emergencySubscription } = req.body;

    const patient = await Patient.findByIdAndUpdate(
      req.params.id,
      { $set: { emergencySubscription } },
      { new: true, runValidators: true }
    )
    .populate('primaryHospital', 'name address')
    .populate('registeredHospitals.hospital', 'name address');

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    res.json({
      success: true,
      message: 'Emergency subscription updated successfully',
      data: {
        patient
      }
    });
  } catch (error) {
    console.error('Update emergency subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update emergency subscription',
      error: error.message
    });
  }
});

// @route   PUT /api/patients/:id/hmo-provider
// @desc    Update HMO provider information
// @access  Private (Medical personnel, Admin)
router.put('/:id/hmo-provider', authenticateToken, authorize('medical_personnel', 'admin'), validateObjectId('id'), async (req, res) => {
  try {
    const { hmoProvider } = req.body;

    const patient = await Patient.findByIdAndUpdate(
      req.params.id,
      { $set: { hmoProvider } },
      { new: true, runValidators: true }
    )
    .populate('primaryHospital', 'name address')
    .populate('registeredHospitals.hospital', 'name address');

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    res.json({
      success: true,
      message: 'HMO provider updated successfully',
      data: {
        patient
      }
    });
  } catch (error) {
    console.error('Update HMO provider error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update HMO provider',
      error: error.message
    });
  }
});

// @route   GET /api/patients/stats/overview
// @desc    Get patient statistics overview
// @access  Private (Medical personnel, Admin)
router.get('/stats/overview', authenticateToken, authorize('medical_personnel', 'admin'), async (req, res) => {
  try {
    const totalPatients = await Patient.countDocuments({ isActive: true });
    const patientsByGender = await Patient.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$biodata.gender', count: { $sum: 1 } } }
    ]);
    
    const patientsByBloodGroup = await Patient.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$medicalHistory.bloodGroup', count: { $sum: 1 } } }
    ]);

    const patientsByState = await Patient.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$biodata.state', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    const emergencySubscribers = await Patient.countDocuments({
      isActive: true,
      'emergencySubscription.isActive': true
    });

    const hmoSubscribers = await Patient.countDocuments({
      isActive: true,
      'hmoProvider.status': 'active'
    });

    res.json({
      success: true,
      data: {
        overview: {
          totalPatients,
          emergencySubscribers,
          hmoSubscribers
        },
        byGender: patientsByGender,
        byBloodGroup: patientsByBloodGroup,
        byState: patientsByState
      }
    });
  } catch (error) {
    console.error('Get patient stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get patient statistics',
      error: error.message
    });
  }
});

// @route   GET /api/patients/:id/qr-code
// @desc    Get patient QR code for limited access
// @access  Private (Patient - own QR only, Medical personnel, Admin)
router.get('/:id/qr-code', authenticateToken, canAccessPatient, validateObjectId('id'), async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id).select('qrCode patientId biodata');
    
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    res.json({
      success: true,
      data: {
        qrCode: patient.qrCode,
        patientId: patient.patientId,
        accessUrl: `${process.env.QR_CODE_BASE_URL}/${patient.qrCode}`
      }
    });
  } catch (error) {
    console.error('Get QR code error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get QR code',
      error: error.message
    });
  }
});

module.exports = router;

