const express = require('express');
const Hospital = require('../models/Hospital');
const { authenticateToken, authorize, requireAdmin } = require('../middleware/auth');
const { validateHospital, validatePagination, validateObjectId, validateSearch } = require('../middleware/validation');

const router = express.Router();

// @route   GET /api/hospitals
// @desc    Get all hospitals with filtering and pagination
// @access  Private (Medical personnel, Admin)
router.get('/', authenticateToken, authorize('medical_personnel', 'admin'), validatePagination, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      type, 
      state, 
      lga, 
      isPartner, 
      status,
      search 
    } = req.query;

    // Build query
    const query = {};
    
    if (type) query.type = type;
    if (state) query['address.state'] = new RegExp(state, 'i');
    if (lga) query['address.lga'] = new RegExp(lga, 'i');
    if (isPartner !== undefined) query['partnership.isPartner'] = isPartner === 'true';
    if (status) query.status = status;
    
    if (search) {
      query.$or = [
        { name: new RegExp(search, 'i') },
        { 'address.city': new RegExp(search, 'i') },
        { 'address.state': new RegExp(search, 'i') },
        { 'address.lga': new RegExp(search, 'i') }
      ];
    }

    const hospitals = await Hospital.find(query)
      .sort({ name: 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Hospital.countDocuments(query);

    res.json({
      success: true,
      data: {
        hospitals,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    console.error('Get hospitals error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get hospitals',
      error: error.message
    });
  }
});

// @route   GET /api/hospitals/partners
// @desc    Get partner hospitals only
// @access  Private (Medical personnel, Admin)
router.get('/partners', authenticateToken, authorize('medical_personnel', 'admin'), async (req, res) => {
  try {
    const partnerHospitals = await Hospital.find({ 
      'partnership.isPartner': true,
      status: 'active'
    })
    .sort({ name: 1 })
    .select('name address contact type partnership specialties');

    res.json({
      success: true,
      data: {
        hospitals: partnerHospitals,
        count: partnerHospitals.length
      }
    });
  } catch (error) {
    console.error('Get partner hospitals error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get partner hospitals',
      error: error.message
    });
  }
});

// @route   GET /api/hospitals/:id
// @desc    Get single hospital by ID
// @access  Private (Medical personnel, Admin)
router.get('/:id', authenticateToken, authorize('medical_personnel', 'admin'), validateObjectId('id'), async (req, res) => {
  try {
    const hospital = await Hospital.findById(req.params.id);
    
    if (!hospital) {
      return res.status(404).json({
        success: false,
        message: 'Hospital not found'
      });
    }

    res.json({
      success: true,
      data: {
        hospital
      }
    });
  } catch (error) {
    console.error('Get hospital error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get hospital',
      error: error.message
    });
  }
});

// @route   POST /api/hospitals
// @desc    Create new hospital
// @access  Private (Admin only)
router.post('/', authenticateToken, requireAdmin, validateHospital, async (req, res) => {
  try {
    const hospital = new Hospital(req.body);
    await hospital.save();

    res.status(201).json({
      success: true,
      message: 'Hospital created successfully',
      data: {
        hospital
      }
    });
  } catch (error) {
    console.error('Create hospital error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create hospital',
      error: error.message
    });
  }
});

// @route   PUT /api/hospitals/:id
// @desc    Update hospital
// @access  Private (Admin only)
router.put('/:id', authenticateToken, requireAdmin, validateObjectId('id'), async (req, res) => {
  try {
    const hospital = await Hospital.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!hospital) {
      return res.status(404).json({
        success: false,
        message: 'Hospital not found'
      });
    }

    res.json({
      success: true,
      message: 'Hospital updated successfully',
      data: {
        hospital
      }
    });
  } catch (error) {
    console.error('Update hospital error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update hospital',
      error: error.message
    });
  }
});

// @route   DELETE /api/hospitals/:id
// @desc    Delete hospital
// @access  Private (Admin only)
router.delete('/:id', authenticateToken, requireAdmin, validateObjectId('id'), async (req, res) => {
  try {
    const hospital = await Hospital.findByIdAndDelete(req.params.id);

    if (!hospital) {
      return res.status(404).json({
        success: false,
        message: 'Hospital not found'
      });
    }

    res.json({
      success: true,
      message: 'Hospital deleted successfully'
    });
  } catch (error) {
    console.error('Delete hospital error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete hospital',
      error: error.message
    });
  }
});

// @route   PUT /api/hospitals/:id/partnership
// @desc    Update hospital partnership status
// @access  Private (Admin only)
router.put('/:id/partnership', authenticateToken, requireAdmin, validateObjectId('id'), async (req, res) => {
  try {
    const { isPartner, partnershipType, contactPerson } = req.body;

    const updateData = {
      'partnership.isPartner': isPartner,
      'partnership.partnershipDate': isPartner ? new Date() : null,
      'partnership.partnershipType': partnershipType || 'limited'
    };

    if (contactPerson) {
      updateData['partnership.contactPerson'] = contactPerson;
    }

    const hospital = await Hospital.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!hospital) {
      return res.status(404).json({
        success: false,
        message: 'Hospital not found'
      });
    }

    res.json({
      success: true,
      message: `Hospital partnership ${isPartner ? 'activated' : 'deactivated'} successfully`,
      data: {
        hospital
      }
    });
  } catch (error) {
    console.error('Update partnership error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update partnership status',
      error: error.message
    });
  }
});

// @route   PUT /api/hospitals/:id/status
// @desc    Update hospital status
// @access  Private (Admin only)
router.put('/:id/status', authenticateToken, requireAdmin, validateObjectId('id'), async (req, res) => {
  try {
    const { status } = req.body;

    if (!['active', 'inactive', 'suspended'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be active, inactive, or suspended'
      });
    }

    const hospital = await Hospital.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );

    if (!hospital) {
      return res.status(404).json({
        success: false,
        message: 'Hospital not found'
      });
    }

    res.json({
      success: true,
      message: `Hospital status updated to ${status}`,
      data: {
        hospital
      }
    });
  } catch (error) {
    console.error('Update hospital status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update hospital status',
      error: error.message
    });
  }
});

// @route   GET /api/hospitals/:id/patients
// @desc    Get patients registered at a specific hospital
// @access  Private (Medical personnel, Admin)
router.get('/:id/patients', authenticateToken, authorize('medical_personnel', 'admin'), validateObjectId('id'), validatePagination, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const Patient = require('../models/Patient');

    const patients = await Patient.find({
      $or: [
        { primaryHospital: req.params.id },
        { 'registeredHospitals.hospital': req.params.id, 'registeredHospitals.isActive': true }
      ]
    })
    .populate('primaryHospital', 'name')
    .sort({ 'biodata.lastName': 1, 'biodata.firstName': 1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

    const total = await Patient.countDocuments({
      $or: [
        { primaryHospital: req.params.id },
        { 'registeredHospitals.hospital': req.params.id, 'registeredHospitals.isActive': true }
      ]
    });

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
    console.error('Get hospital patients error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get hospital patients',
      error: error.message
    });
  }
});

// @route   GET /api/hospitals/stats/overview
// @desc    Get hospital statistics overview
// @access  Private (Admin only)
router.get('/stats/overview', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const totalHospitals = await Hospital.countDocuments();
    const partnerHospitals = await Hospital.countDocuments({ 'partnership.isPartner': true });
    const activeHospitals = await Hospital.countDocuments({ status: 'active' });
    
    const hospitalsByType = await Hospital.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]);

    const hospitalsByState = await Hospital.aggregate([
      { $group: { _id: '$address.state', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    res.json({
      success: true,
      data: {
        overview: {
          totalHospitals,
          partnerHospitals,
          activeHospitals,
          inactiveHospitals: totalHospitals - activeHospitals
        },
        byType: hospitalsByType,
        byState: hospitalsByState
      }
    });
  } catch (error) {
    console.error('Get hospital stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get hospital statistics',
      error: error.message
    });
  }
});

module.exports = router;

