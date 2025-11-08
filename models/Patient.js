const mongoose = require('mongoose');

const patientSchema = new mongoose.Schema({
  // Basic identification
  patientId: {
    type: String,
    unique: true,
    required: true
  },
  qrCode: {
    type: String,
    unique: true
  },
  
  // Biodata
  biodata: {
    firstName: {
      type: String,
      required: true,
      trim: true
    },
    lastName: {
      type: String,
      required: true,
      trim: true
    },
    middleName: String,
    dateOfBirth: {
      type: Date,
      required: true
    },
    age: {
      type: Number,
      required: true
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other'],
      required: true
    },
    maritalStatus: {
      type: String,
      enum: ['single', 'married', 'divorced', 'widowed', 'other']
    },
    occupation: String,
    address: {
      street: String,
      city: String,
      lga: {
        type: String,
        required: true
      },
      state: {
        type: String,
        required: true
      },
      country: {
        type: String,
        default: 'Nigeria'
      },
      postalCode: String
    },
    contact: {
      phone: {
        type: String,
        required: true
      },
      email: String,
      emergencyContact: {
        name: String,
        relationship: String,
        phone: String,
        address: String
      }
    },
    dateOfRegistration: {
      type: Date,
      default: Date.now
    }
  },

  // Medical History
  medicalHistory: {
    bloodGroup: {
      type: String,
      enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown']
    },
    genotype: {
      type: String,
      enum: ['AA', 'AS', 'SS', 'AC', 'SC', 'CC', 'unknown']
    },
    allergies: [{
      allergen: String,
      reaction: String,
      severity: {
        type: String,
        enum: ['mild', 'moderate', 'severe']
      },
      notes: String
    }],
    surgicalHistory: [{
      procedure: String,
      date: Date,
      hospital: String,
      surgeon: String,
      complications: String,
      notes: String
    }],
    chronicIllnesses: [{
      condition: String,
      category: {
        type: String,
        enum: [
          'CNS disorder',
          'CVS disorder', 
          'GIT disorder',
          'MSS disorder',
          'Dermatological disorder',
          'Respiratory disorder',
          'Infectious disease',
          'Immunological disorder',
          'Oncological disorder'
        ]
      },
      diagnosisDate: Date,
      severity: {
        type: String,
        enum: ['mild', 'moderate', 'severe']
      },
      isActive: {
        type: Boolean,
        default: true
      },
      medications: [String],
      notes: String
    }]
  },

  // Presenting complaints
  presentingComplaints: [{
    complaint: String,
    duration: String,
    severity: {
      type: String,
      enum: ['mild', 'moderate', 'severe']
    },
    associatedSymptoms: [String],
    notes: String,
    dateRecorded: {
      type: Date,
      default: Date.now
    }
  }],

  // Emergency health subscription
  emergencySubscription: {
    isActive: {
      type: Boolean,
      default: false
    },
    subscriptionType: {
      type: String,
      enum: ['basic', 'premium', 'emergency_only']
    },
    startDate: Date,
    expiryDate: Date,
    benefits: [String],
    coverage: {
      emergency: Boolean,
      ambulance: Boolean,
      surgery: Boolean,
      medication: Boolean
    }
  },

  // HMO Provider
  hmoProvider: {
    providerName: String,
    policyNumber: String,
    status: {
      type: String,
      enum: ['active', 'inactive', 'unsubscribed'],
      default: 'unsubscribed'
    },
    startDate: Date,
    expiryDate: Date,
    coverage: {
      inpatient: Boolean,
      outpatient: Boolean,
      emergency: Boolean,
      surgery: Boolean,
      medication: Boolean
    },
    contactInfo: {
      phone: String,
      email: String,
      address: String
    }
  },

  // Hospital association
  primaryHospital: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hospital'
  },
  registeredHospitals: [{
    hospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hospital'
    },
    registrationDate: {
      type: Date,
      default: Date.now
    },
    isActive: {
      type: Boolean,
      default: true
    }
  }],

  // Access control
  accessLevel: {
    type: String,
    enum: ['full', 'limited', 'emergency_only'],
    default: 'limited'
  },
  isActive: {
    type: Boolean,
    default: true
  },

  // Additional metadata
  notes: String,
  lastVisit: Date,
  totalVisits: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Indexes for better performance
patientSchema.index({ 'biodata.firstName': 1, 'biodata.lastName': 1 });
patientSchema.index({ 'biodata.contact.phone': 1 });
patientSchema.index({ primaryHospital: 1 });
patientSchema.index({ isActive: 1 });

// Virtual for full name
patientSchema.virtual('fullName').get(function() {
  const bio = this.biodata;
  return `${bio.firstName} ${bio.middleName ? bio.middleName + ' ' : ''}${bio.lastName}`;
});

// Virtual for age calculation
patientSchema.virtual('calculatedAge').get(function() {
  const today = new Date();
  const birthDate = new Date(this.biodata.dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
});

// Pre-save middleware to generate patient ID and QR code
patientSchema.pre('save', async function(next) {
  if (this.isNew) {
    // Generate unique patient ID
    const count = await this.constructor.countDocuments();
    this.patientId = `PA${String(count + 1).padStart(6, '0')}`;
    
    // Generate QR code data
    this.qrCode = `LAMR-${this.patientId}-${Date.now()}`;
  }
  next();
});

module.exports = mongoose.model('Patient', patientSchema);
