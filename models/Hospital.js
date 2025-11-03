const mongoose = require('mongoose');

const hospitalSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  address: {
    street: String,
    city: String,
    state: String,
    lga: String,
    country: {
      type: String,
      default: 'Nigeria'
    },
    postalCode: String
  },
  contact: {
    phone: String,
    email: {
      type: String,
      lowercase: true,
      trim: true
    },
    website: String
  },
  type: {
    type: String,
    enum: ['public', 'private', 'federal', 'state', 'teaching'],
    required: true
  },
  specialties: [{
    type: String,
    trim: true
  }],
  facilities: [{
    name: String,
    description: String,
    isAvailable: {
      type: Boolean,
      default: true
    }
  }],
  capacity: {
    totalBeds: Number,
    icuBeds: Number,
    emergencyBeds: Number
  },
  accreditation: {
    isAccredited: {
      type: Boolean,
      default: false
    },
    accreditationBody: String,
    accreditationDate: Date,
    expiryDate: Date
  },
  partnership: {
    isPartner: {
      type: Boolean,
      default: false
    },
    partnershipDate: Date,
    partnershipType: {
      type: String,
      enum: ['full', 'limited', 'referral'],
      default: 'limited'
    },
    contactPerson: {
      name: String,
      position: String,
      email: String,
      phone: String
    }
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active'
  },
  coordinates: {
    latitude: Number,
    longitude: Number
  },
  workingHours: {
    monday: { open: String, close: String, isOpen: Boolean },
    tuesday: { open: String, close: String, isOpen: Boolean },
    wednesday: { open: String, close: String, isOpen: Boolean },
    thursday: { open: String, close: String, isOpen: Boolean },
    friday: { open: String, close: String, isOpen: Boolean },
    saturday: { open: String, close: String, isOpen: Boolean },
    sunday: { open: String, close: String, isOpen: Boolean }
  },
  emergencyServices: {
    hasEmergency: {
      type: Boolean,
      default: false
    },
    emergencyPhone: String,
    traumaCenter: Boolean,
    strokeCenter: Boolean,
    cardiacCenter: Boolean
  }
}, {
  timestamps: true
});

// Index for search functionality
hospitalSchema.index({ name: 'text', 'address.city': 'text', 'address.state': 'text' });
hospitalSchema.index({ 'partnership.isPartner': 1 });
hospitalSchema.index({ status: 1 });

// Virtual for full address
hospitalSchema.virtual('fullAddress').get(function() {
  const addr = this.address;
  return `${addr.street}, ${addr.city}, ${addr.lga}, ${addr.state}, ${addr.country}`;
});

module.exports = mongoose.model('Hospital', hospitalSchema);
