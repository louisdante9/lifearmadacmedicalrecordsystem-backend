const express = require('express');
const QRCode = require('qrcode');
const Patient = require('../models/Patient');
const MedicalRecord = require('../models/MedicalRecord');
const {
  authenticateToken,
  authorize,
  canAccessPatient
} = require('../middleware/auth');
const { validateObjectId } = require('../middleware/validation');

const router = express.Router();

const QR_CODE_OPTIONS = {
  errorCorrectionLevel: 'M',
  type: 'image/png',
  margin: 1
};

const buildPatientSnapshot = (patientDoc) => {
  if (!patientDoc) return null;

  const patient = patientDoc.toObject({ virtuals: true });
  const emergencyContact = patient.biodata?.contact?.emergencyContact || {};

  return {
    patientId: patient.patientId,
    fullName: patient.fullName,
    gender: patient.biodata?.gender,
    age: patient.calculatedAge ?? patient.biodata?.age,
    bloodGroup: patient.medicalHistory?.bloodGroup,
    genotype: patient.medicalHistory?.genotype,
    allergies: (patient.medicalHistory?.allergies || []).map((item) => ({
      allergen: item.allergen,
      reaction: item.reaction,
      severity: item.severity
    })),
    chronicIllnesses: (patient.medicalHistory?.chronicIllnesses || []).map((item) => ({
      condition: item.condition,
      severity: item.severity,
      isActive: item.isActive
    })),
    emergencySubscription: patient.emergencySubscription
      ? {
          isActive: patient.emergencySubscription.isActive,
          subscriptionType: patient.emergencySubscription.subscriptionType,
          coverage: patient.emergencySubscription.coverage
        }
      : undefined,
    emergencyContact: {
      name: emergencyContact.name,
      relationship: emergencyContact.relationship,
      phone: emergencyContact.phone
    },
    lastUpdated: patient.updatedAt
  };
};

const buildRecordSummary = (recordDoc) => {
  if (!recordDoc) return null;
  const record = recordDoc.toObject();

  return {
    recordId: record._id,
    visitDate: record.visitInfo?.visitDate,
    visitType: record.visitInfo?.visitType,
    chiefComplaint: record.visitInfo?.chiefComplaint,
    hospital: record.hospital
      ? {
          hospitalId: record.hospital._id,
          name: record.hospital.name,
          address: record.hospital.address
        }
      : undefined,
    primaryDiagnosis: record.assessment?.primaryDiagnosis,
    secondaryDiagnoses: record.assessment?.secondaryDiagnoses,
    severity: record.assessment?.severity,
    vitals: record.vitalSigns
      ? {
          bloodPressure: record.vitalSigns.bloodPressure,
          heartRate: record.vitalSigns.heartRate,
          temperature: record.vitalSigns.temperature,
          respiratoryRate: record.vitalSigns.respiratoryRate,
          oxygenSaturation: record.vitalSigns.oxygenSaturation
        }
      : undefined,
    treatmentPlan: record.treatment
      ? {
          medications: (record.treatment.medications || []).map((med) => ({
            name: med.name,
            dosage: med.dosage,
            frequency: med.frequency
          })),
          followUp: record.treatment.followUp
        }
      : undefined,
    discharge: record.discharge
      ? {
          dischargeDate: record.discharge.dischargeDate,
          dischargeType: record.discharge.dischargeType,
          condition: record.discharge.condition,
          instructions: record.discharge.instructions
        }
      : undefined,
    isEmergency: record.isEmergency,
    status: record.status
  };
};

const generateQrPayload = (patient) => ({
  qrCode: patient.qrCode,
  patientId: patient.patientId,
  issuedAt: new Date().toISOString(),
  accessUrl: patient.qrCode
    ? `${process.env.QR_CODE_BASE_URL || ''}/${patient.qrCode}`
    : undefined
});

const regenerateQrForPatient = async (patient) => {
  const timestamp = Date.now();
  const uniqueCode = `LAMR-${patient.patientId}-${timestamp}`;

  patient.qrCode = uniqueCode;
  await patient.save();

  return uniqueCode;
};

// @route   GET /api/qr/generate/:patientId
// @desc    Generate (or retrieve existing) QR code for patient
// @access  Private (Medical personnel, Admin)
router.get(
  '/generate/:patientId',
  authenticateToken,
  authorize('medical_personnel', 'admin'),
  validateObjectId('patientId'),
  async (req, res) => {
    try {
      const patient = await Patient.findById(req.params.patientId);

      if (!patient || !patient.isActive) {
        return res.status(404).json({
          success: false,
          message: 'Patient not found'
        });
      }

      if (!patient.qrCode) {
        await regenerateQrForPatient(patient);
      }

      const payload = generateQrPayload(patient);
      const qrImage = await QRCode.toDataURL(JSON.stringify(payload), QR_CODE_OPTIONS);

      res.json({
        success: true,
        data: {
          ...payload,
          qrImage
        }
      });
    } catch (error) {
      console.error('Generate QR code error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate QR code',
        error: error.message
      });
    }
  }
);

// @route   POST /api/qr/regenerate/:patientId
// @desc    Regenerate QR code for patient
// @access  Private (Medical personnel, Admin)
router.post(
  '/regenerate/:patientId',
  authenticateToken,
  authorize('medical_personnel', 'admin'),
  validateObjectId('patientId'),
  async (req, res) => {
    try {
      const patient = await Patient.findById(req.params.patientId);

      if (!patient || !patient.isActive) {
        return res.status(404).json({
          success: false,
          message: 'Patient not found'
        });
      }

      await regenerateQrForPatient(patient);

      const payload = generateQrPayload(patient);
      const qrImage = await QRCode.toDataURL(JSON.stringify(payload), QR_CODE_OPTIONS);

      res.json({
        success: true,
        message: 'QR code regenerated successfully',
        data: {
          ...payload,
          qrImage
        }
      });
    } catch (error) {
      console.error('Regenerate QR code error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to regenerate QR code',
        error: error.message
      });
    }
  }
);

// @route   GET /api/qr/validate/:qrCode
// @desc    Validate QR code and return basic patient info
// @access  Public (limited response)
router.get('/validate/:qrCode', async (req, res) => {
  try {
    const patient = await Patient.findOne({
      qrCode: req.params.qrCode,
      isActive: true
    });

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'QR code is invalid or expired'
      });
    }

    res.json({
      success: true,
      data: {
        valid: true,
        patientId: patient.patientId
      }
    });
  } catch (error) {
    console.error('Validate QR code error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to validate QR code',
      error: error.message
    });
  }
});

// @route   GET /api/qr/scan/:qrCode
// @desc    Scan QR code and get limited patient snapshot
// @access  Public (limited response)
router.get('/scan/:qrCode', async (req, res) => {
  try {
    const patient = await Patient.findOne({
      qrCode: req.params.qrCode,
      isActive: true
    }).select(
      'patientId biodata medicalHistory emergencySubscription qrCode accessLevel updatedAt'
    );

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'QR code is invalid or expired'
      });
    }

    res.json({
      success: true,
      data: {
        patient: buildPatientSnapshot(patient),
        accessLevel: patient.accessLevel
      }
    });
  } catch (error) {
    console.error('Scan QR code error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to scan QR code',
      error: error.message
    });
  }
});

// @route   GET /api/qr/patient-access/:qrCode
// @desc    Get patient self-service access data via QR code
// @access  Public (limited response)
router.get('/patient-access/:qrCode', async (req, res) => {
  try {
    const patient = await Patient.findOne({
      qrCode: req.params.qrCode,
      isActive: true
    }).select(
      'patientId biodata medicalHistory emergencySubscription hmoProvider accessLevel updatedAt'
    );

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'QR code is invalid or expired'
      });
    }

    const patientSnapshot = buildPatientSnapshot(patient);

    res.json({
      success: true,
      data: {
        patient: patientSnapshot,
        hmoProvider: patient.hmoProvider
          ? {
              providerName: patient.hmoProvider.providerName,
              policyNumber: patient.hmoProvider.policyNumber,
              status: patient.hmoProvider.status
            }
          : undefined,
        accessLevel: patient.accessLevel
      }
    });
  } catch (error) {
    console.error('Get patient access via QR code error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get patient access data',
      error: error.message
    });
  }
});

// @route   GET /api/qr/patient-records/:qrCode
// @desc    Get limited medical records via QR code
// @access  Public (limited response)
router.get('/patient-records/:qrCode', async (req, res) => {
  try {
    const patient = await Patient.findOne({
      qrCode: req.params.qrCode,
      isActive: true
    })
      .select('patientId qrCode accessLevel')
      .lean();

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'QR code is invalid or expired'
      });
    }

    if (patient.accessLevel === 'emergency_only') {
      return res.status(403).json({
        success: false,
        message: 'Patient has restricted record access'
      });
    }

    const records = await MedicalRecord.find({
      patient: patient._id,
      status: { $ne: 'archived' }
    })
      .sort({ 'visitInfo.visitDate': -1 })
      .limit(5)
      .select(
        'visitInfo assessment vitalSigns treatment discharge isEmergency status hospital'
      )
      .populate('hospital', 'name address');

    res.json({
      success: true,
      data: {
        patientId: patient.patientId,
        accessLevel: patient.accessLevel,
        records: records.map(buildRecordSummary)
      }
    });
  } catch (error) {
    console.error('Get patient records via QR code error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get patient records',
      error: error.message
    });
  }
});

// @route   GET /api/qr/download/:patientId
// @desc    Download QR code image for patient
// @access  Private (Patient - own QR, Medical personnel, Admin)
router.get(
  '/download/:patientId',
  authenticateToken,
  canAccessPatient,
  validateObjectId('patientId'),
  async (req, res) => {
    try {
      const patient = await Patient.findById(req.params.patientId);

      if (!patient || !patient.isActive) {
        return res.status(404).json({
          success: false,
          message: 'Patient not found'
        });
      }

      if (!patient.qrCode) {
        await regenerateQrForPatient(patient);
      }

      const payload = generateQrPayload(patient);
      const pngBuffer = await QRCode.toBuffer(
        JSON.stringify(payload),
        QR_CODE_OPTIONS
      );

      res.setHeader('Content-Type', 'image/png');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=${patient.patientId}-qr.png`
      );
      return res.send(pngBuffer);
    } catch (error) {
      console.error('Download QR code error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to download QR code',
        error: error.message
      });
    }
  }
);

module.exports = router;


