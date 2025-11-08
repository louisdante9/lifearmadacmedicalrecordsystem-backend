const express = require('express');
const mongoose = require('mongoose');
const MedicalRecord = require('../models/MedicalRecord');
const Patient = require('../models/Patient');
const Hospital = require('../models/Hospital');
const {
  authenticateToken,
  authorize,
  canAccessMedicalRecord,
  canAccessPatient
} = require('../middleware/auth');
const {
  validateMedicalRecord,
  validatePagination,
  validateObjectId,
  validateDateRange
} = require('../middleware/validation');

const router = express.Router();

// Helpers
const buildDateRangeFilter = (startDate, endDate) => {
  if (!startDate && !endDate) {
    return {};
  }

  const range = {};
  if (startDate) range.$gte = new Date(startDate);
  if (endDate) range.$lte = new Date(endDate);

  return range;
};

const populateRecord = (query) => {
  return query
    .populate('patient', 'patientId biodata')
    .populate('hospital', 'name address contact')
    .populate('createdBy', 'email profile.firstName profile.lastName profile.department');
};

// @route   GET /api/medical-records
// @desc    Get medical records with filtering and pagination
// @access  Private (Medical personnel, Admin)
router.get(
  '/',
  authenticateToken,
  authorize('medical_personnel', 'admin'),
  validatePagination,
  validateDateRange,
  async (req, res) => {
    try {
      const {
        page = 1,
        limit = 10,
        patient,
        hospital,
        visitType,
        status,
        isEmergency,
        search,
        startDate,
        endDate
      } = req.query;

      const query = {};

      if (patient && mongoose.Types.ObjectId.isValid(patient)) {
        query.patient = patient;
      }
      if (hospital && mongoose.Types.ObjectId.isValid(hospital)) {
        query.hospital = hospital;
      }
      if (visitType) {
        query['visitInfo.visitType'] = visitType;
      }
      if (status) {
        query.status = status;
      }
      if (typeof isEmergency !== 'undefined') {
        query.isEmergency = isEmergency === 'true';
      }
      if (search) {
        query.$or = [
          { 'visitInfo.chiefComplaint': new RegExp(search, 'i') },
          { 'assessment.primaryDiagnosis': new RegExp(search, 'i') },
          { 'assessment.secondaryDiagnoses': new RegExp(search, 'i') }
        ];
      }

      const dateFilter = buildDateRangeFilter(startDate, endDate);
      if (Object.keys(dateFilter).length > 0) {
        query['visitInfo.visitDate'] = dateFilter;
      }

      // Limit medical personnel to their hospital's records if applicable
      if (req.user.role === 'medical_personnel' && req.user.profile?.hospitalId) {
        query.hospital = req.user.profile.hospitalId._id || req.user.profile.hospitalId;
      }

      const perPage = parseInt(limit, 10);
      const currentPage = parseInt(page, 10);

      const [records, total] = await Promise.all([
        populateRecord(
          MedicalRecord.find(query)
            .sort({ 'visitInfo.visitDate': -1 })
            .limit(perPage)
            .skip((currentPage - 1) * perPage)
        ),
        MedicalRecord.countDocuments(query)
      ]);

      res.json({
        success: true,
        data: {
          records,
          pagination: {
            current: currentPage,
            pages: Math.ceil(total / perPage),
            total
          }
        }
      });
    } catch (error) {
      console.error('Get medical records error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get medical records',
        error: error.message
      });
    }
  }
);

// @route   GET /api/medical-records/stats/overview
// @desc    Get medical record statistics overview
// @access  Private (Medical personnel, Admin)
router.get(
  '/stats/overview',
  authenticateToken,
  authorize('medical_personnel', 'admin'),
  async (req, res) => {
    try {
      const baseMatch = {};

      if (req.user.role === 'medical_personnel' && req.user.profile?.hospitalId) {
        baseMatch.hospital = req.user.profile.hospitalId._id || req.user.profile.hospitalId;
      }

      const withMatch = (pipeline) => {
        if (!Object.keys(baseMatch).length) return pipeline;
        return [{ $match: baseMatch }, ...pipeline];
      };

      const [totalRecords, recordsByStatus, visitsByType, emergencyCount, topHospitals] = await Promise.all([
        MedicalRecord.countDocuments(baseMatch),
        MedicalRecord.aggregate(
          withMatch([
            { $group: { _id: '$status', count: { $sum: 1 } } }
          ])
        ),
        MedicalRecord.aggregate(
          withMatch([
            { $group: { _id: '$visitInfo.visitType', count: { $sum: 1 } } }
          ])
        ),
        MedicalRecord.countDocuments({ ...baseMatch, isEmergency: true }),
        MedicalRecord.aggregate(
          withMatch([
            { $group: { _id: '$hospital', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 5 },
            {
              $lookup: {
                from: 'hospitals',
                localField: '_id',
                foreignField: '_id',
                as: 'hospital'
              }
            },
            { $unwind: '$hospital' },
            {
              $project: {
                _id: 0,
                hospitalId: '$hospital._id',
                name: '$hospital.name',
                count: 1
              }
            }
          ])
        )
      ]);

      res.json({
        success: true,
        data: {
          overview: {
            totalRecords,
            emergencyCases: emergencyCount
          },
          byStatus: recordsByStatus,
          visitsByType,
          topHospitals
        }
      });
    } catch (error) {
      console.error('Get medical record stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get medical record statistics',
        error: error.message
      });
    }
  }
);

// @route   GET /api/medical-records/patient/:patientId
// @desc    Get medical records for a specific patient
// @access  Private (Patient - own records, Medical personnel, Admin)
router.get(
  '/patient/:patientId',
  authenticateToken,
  canAccessPatient,
  validateObjectId('patientId'),
  validatePagination,
  async (req, res) => {
    try {
      const { patientId } = req.params;
      const { page = 1, limit = 10 } = req.query;

      const perPage = parseInt(limit, 10);
      const currentPage = parseInt(page, 10);

      const [records, total] = await Promise.all([
        populateRecord(
          MedicalRecord.find({ patient: patientId })
            .sort({ 'visitInfo.visitDate': -1 })
            .limit(perPage)
            .skip((currentPage - 1) * perPage)
        ),
        MedicalRecord.countDocuments({ patient: patientId })
      ]);

      res.json({
        success: true,
        data: {
          records,
          pagination: {
            current: currentPage,
            pages: Math.ceil(total / perPage),
            total
          }
        }
      });
    } catch (error) {
      console.error('Get patient medical records error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get patient medical records',
        error: error.message
      });
    }
  }
);

// @route   POST /api/medical-records
// @desc    Create new medical record
// @access  Private (Medical personnel, Admin)
router.post(
  '/',
  authenticateToken,
  authorize('medical_personnel', 'admin'),
  validateMedicalRecord,
  async (req, res) => {
    try {
      const { patient, hospital } = req.body;

      const [patientExists, hospitalExists] = await Promise.all([
        Patient.findById(patient),
        Hospital.findById(hospital)
      ]);

      if (!patientExists) {
        return res.status(400).json({
          success: false,
          message: 'Patient not found'
        });
      }

      if (!hospitalExists) {
        return res.status(400).json({
          success: false,
          message: 'Hospital not found'
        });
      }

      const medicalRecord = new MedicalRecord({
        ...req.body,
        createdBy: req.user._id
      });

      await medicalRecord.save();

      const populatedRecord = await populateRecord(
        MedicalRecord.findById(medicalRecord._id)
      );

      res.status(201).json({
        success: true,
        message: 'Medical record created successfully',
        data: {
          record: populatedRecord
        }
      });
    } catch (error) {
      console.error('Create medical record error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create medical record',
        error: error.message
      });
    }
  }
);

// @route   GET /api/medical-records/:recordId
// @desc    Get single medical record
// @access  Private (Patient - own records, Medical personnel, Admin)
router.get(
  '/:recordId',
  authenticateToken,
  canAccessMedicalRecord,
  validateObjectId('recordId'),
  async (req, res) => {
    try {
      const { recordId } = req.params;

      const record = await populateRecord(MedicalRecord.findById(recordId));

      if (!record) {
        return res.status(404).json({
          success: false,
          message: 'Medical record not found'
        });
      }

      res.json({
        success: true,
        data: {
          record
        }
      });
    } catch (error) {
      console.error('Get medical record error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get medical record',
        error: error.message
      });
    }
  }
);

// @route   PUT /api/medical-records/:recordId
// @desc    Update medical record
// @access  Private (Medical personnel, Admin)
router.put(
  '/:recordId',
  authenticateToken,
  authorize('medical_personnel', 'admin'),
  canAccessMedicalRecord,
  validateObjectId('recordId'),
  async (req, res) => {
    try {
      const { recordId } = req.params;

      const updatedRecord = await populateRecord(
        MedicalRecord.findByIdAndUpdate(
          recordId,
          { $set: req.body },
          { new: true, runValidators: true }
        )
      );

      if (!updatedRecord) {
        return res.status(404).json({
          success: false,
          message: 'Medical record not found'
        });
      }

      res.json({
        success: true,
        message: 'Medical record updated successfully',
        data: {
          record: updatedRecord
        }
      });
    } catch (error) {
      console.error('Update medical record error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update medical record',
        error: error.message
      });
    }
  }
);

// @route   DELETE /api/medical-records/:recordId
// @desc    Archive medical record
// @access  Private (Medical personnel, Admin)
router.delete(
  '/:recordId',
  authenticateToken,
  authorize('medical_personnel', 'admin'),
  canAccessMedicalRecord,
  validateObjectId('recordId'),
  async (req, res) => {
    try {
      const { recordId } = req.params;

      const archivedRecord = await MedicalRecord.findByIdAndUpdate(
        recordId,
        { $set: { status: 'archived' } },
        { new: true }
      );

      if (!archivedRecord) {
        return res.status(404).json({
          success: false,
          message: 'Medical record not found'
        });
      }

      res.json({
        success: true,
        message: 'Medical record archived successfully'
      });
    } catch (error) {
      console.error('Archive medical record error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to archive medical record',
        error: error.message
      });
    }
  }
);

// @route   PUT /api/medical-records/:recordId/vital-signs
// @desc    Update vital signs
// @access  Private (Medical personnel, Admin)
router.put(
  '/:recordId/vital-signs',
  authenticateToken,
  authorize('medical_personnel', 'admin'),
  canAccessMedicalRecord,
  validateObjectId('recordId'),
  async (req, res) => {
    try {
      const { recordId } = req.params;
      const { vitalSigns } = req.body;

      const updatedRecord = await populateRecord(
        MedicalRecord.findByIdAndUpdate(
          recordId,
          { $set: { vitalSigns } },
          { new: true, runValidators: true }
        )
      );

      if (!updatedRecord) {
        return res.status(404).json({
          success: false,
          message: 'Medical record not found'
        });
      }

      res.json({
        success: true,
        message: 'Vital signs updated successfully',
        data: {
          record: updatedRecord
        }
      });
    } catch (error) {
      console.error('Update vital signs error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update vital signs',
        error: error.message
      });
    }
  }
);

// @route   PUT /api/medical-records/:recordId/physical-examination
// @desc    Update physical examination details
// @access  Private (Medical personnel, Admin)
router.put(
  '/:recordId/physical-examination',
  authenticateToken,
  authorize('medical_personnel', 'admin'),
  canAccessMedicalRecord,
  validateObjectId('recordId'),
  async (req, res) => {
    try {
      const { recordId } = req.params;
      const { physicalExamination } = req.body;

      const updatedRecord = await populateRecord(
        MedicalRecord.findByIdAndUpdate(
          recordId,
          { $set: { physicalExamination } },
          { new: true, runValidators: true }
        )
      );

      if (!updatedRecord) {
        return res.status(404).json({
          success: false,
          message: 'Medical record not found'
        });
      }

      res.json({
        success: true,
        message: 'Physical examination updated successfully',
        data: {
          record: updatedRecord
        }
      });
    } catch (error) {
      console.error('Update physical examination error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update physical examination',
        error: error.message
      });
    }
  }
);

// @route   PUT /api/medical-records/:recordId/assessment
// @desc    Update assessment and diagnosis
// @access  Private (Medical personnel, Admin)
router.put(
  '/:recordId/assessment',
  authenticateToken,
  authorize('medical_personnel', 'admin'),
  canAccessMedicalRecord,
  validateObjectId('recordId'),
  async (req, res) => {
    try {
      const { recordId } = req.params;
      const { assessment } = req.body;

      const updatedRecord = await populateRecord(
        MedicalRecord.findByIdAndUpdate(
          recordId,
          { $set: { assessment } },
          { new: true, runValidators: true }
        )
      );

      if (!updatedRecord) {
        return res.status(404).json({
          success: false,
          message: 'Medical record not found'
        });
      }

      res.json({
        success: true,
        message: 'Assessment updated successfully',
        data: {
          record: updatedRecord
        }
      });
    } catch (error) {
      console.error('Update assessment error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update assessment',
        error: error.message
      });
    }
  }
);

// @route   PUT /api/medical-records/:recordId/treatment
// @desc    Update treatment plan
// @access  Private (Medical personnel, Admin)
router.put(
  '/:recordId/treatment',
  authenticateToken,
  authorize('medical_personnel', 'admin'),
  canAccessMedicalRecord,
  validateObjectId('recordId'),
  async (req, res) => {
    try {
      const { recordId } = req.params;
      const { treatment } = req.body;

      const updatedRecord = await populateRecord(
        MedicalRecord.findByIdAndUpdate(
          recordId,
          { $set: { treatment } },
          { new: true, runValidators: true }
        )
      );

      if (!updatedRecord) {
        return res.status(404).json({
          success: false,
          message: 'Medical record not found'
        });
      }

      res.json({
        success: true,
        message: 'Treatment updated successfully',
        data: {
          record: updatedRecord
        }
      });
    } catch (error) {
      console.error('Update treatment error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update treatment',
        error: error.message
      });
    }
  }
);

// @route   POST /api/medical-records/:recordId/laboratory-results
// @desc    Add laboratory result
// @access  Private (Medical personnel, Admin)
router.post(
  '/:recordId/laboratory-results',
  authenticateToken,
  authorize('medical_personnel', 'admin'),
  canAccessMedicalRecord,
  validateObjectId('recordId'),
  async (req, res) => {
    try {
      const { recordId } = req.params;
      const { laboratoryResult } = req.body;

      if (!laboratoryResult || !laboratoryResult.testName) {
        return res.status(400).json({
          success: false,
          message: 'Laboratory result with test name is required'
        });
      }

      laboratoryResult.testDate = laboratoryResult.testDate ? new Date(laboratoryResult.testDate) : new Date();

      const updatedRecord = await populateRecord(
        MedicalRecord.findByIdAndUpdate(
          recordId,
          { $push: { laboratoryResults: laboratoryResult } },
          { new: true, runValidators: true }
        )
      );

      if (!updatedRecord) {
        return res.status(404).json({
          success: false,
          message: 'Medical record not found'
        });
      }

      res.status(201).json({
        success: true,
        message: 'Laboratory result added successfully',
        data: {
          record: updatedRecord
        }
      });
    } catch (error) {
      console.error('Add laboratory result error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to add laboratory result',
        error: error.message
      });
    }
  }
);

// @route   POST /api/medical-records/:recordId/imaging-results
// @desc    Add imaging result
// @access  Private (Medical personnel, Admin)
router.post(
  '/:recordId/imaging-results',
  authenticateToken,
  authorize('medical_personnel', 'admin'),
  canAccessMedicalRecord,
  validateObjectId('recordId'),
  async (req, res) => {
    try {
      const { recordId } = req.params;
      const { imagingResult } = req.body;

      if (!imagingResult || !imagingResult.studyType) {
        return res.status(400).json({
          success: false,
          message: 'Imaging result with study type is required'
        });
      }

      imagingResult.studyDate = imagingResult.studyDate ? new Date(imagingResult.studyDate) : new Date();

      const updatedRecord = await populateRecord(
        MedicalRecord.findByIdAndUpdate(
          recordId,
          { $push: { imagingResults: imagingResult } },
          { new: true, runValidators: true }
        )
      );

      if (!updatedRecord) {
        return res.status(404).json({
          success: false,
          message: 'Medical record not found'
        });
      }

      res.status(201).json({
        success: true,
        message: 'Imaging result added successfully',
        data: {
          record: updatedRecord
        }
      });
    } catch (error) {
      console.error('Add imaging result error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to add imaging result',
        error: error.message
      });
    }
  }
);

// @route   POST /api/medical-records/:recordId/nursing-notes
// @desc    Add nursing note
// @access  Private (Medical personnel, Admin)
router.post(
  '/:recordId/nursing-notes',
  authenticateToken,
  authorize('medical_personnel', 'admin'),
  canAccessMedicalRecord,
  validateObjectId('recordId'),
  async (req, res) => {
    try {
      const { recordId } = req.params;
      const { nursingNote } = req.body;

      if (!nursingNote || !nursingNote.note) {
        return res.status(400).json({
          success: false,
          message: 'Nursing note content is required'
        });
      }

      nursingNote.date = nursingNote.date ? new Date(nursingNote.date) : new Date();

      const updatedRecord = await populateRecord(
        MedicalRecord.findByIdAndUpdate(
          recordId,
          { $push: { nursingNotes: nursingNote } },
          { new: true, runValidators: true }
        )
      );

      if (!updatedRecord) {
        return res.status(404).json({
          success: false,
          message: 'Medical record not found'
        });
      }

      res.status(201).json({
        success: true,
        message: 'Nursing note added successfully',
        data: {
          record: updatedRecord
        }
      });
    } catch (error) {
      console.error('Add nursing note error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to add nursing note',
        error: error.message
      });
    }
  }
);

// @route   PUT /api/medical-records/:recordId/discharge
// @desc    Update discharge information
// @access  Private (Medical personnel, Admin)
router.put(
  '/:recordId/discharge',
  authenticateToken,
  authorize('medical_personnel', 'admin'),
  canAccessMedicalRecord,
  validateObjectId('recordId'),
  async (req, res) => {
    try {
      const { recordId } = req.params;
      const { discharge } = req.body;

      if (!discharge) {
        return res.status(400).json({
          success: false,
          message: 'Discharge information is required'
        });
      }

      const updateData = { discharge };
      if (discharge && discharge.dischargeDate) {
        updateData.status = 'completed';
      }

      const updatedRecord = await populateRecord(
        MedicalRecord.findByIdAndUpdate(
          recordId,
          { $set: updateData },
          { new: true, runValidators: true }
        )
      );

      if (!updatedRecord) {
        return res.status(404).json({
          success: false,
          message: 'Medical record not found'
        });
      }

      res.json({
        success: true,
        message: 'Discharge information updated successfully',
        data: {
          record: updatedRecord
        }
      });
    } catch (error) {
      console.error('Update discharge information error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update discharge information',
        error: error.message
      });
    }
  }
);

module.exports = router;


