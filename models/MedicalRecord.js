const mongoose = require('mongoose');

const medicalRecordSchema = new mongoose.Schema({
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },
  hospital: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hospital',
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Visit information
  visitInfo: {
    visitDate: {
      type: Date,
      default: Date.now
    },
    visitType: {
      type: String,
      enum: ['routine', 'emergency', 'follow_up', 'consultation', 'surgery'],
      required: true
    },
    department: String,
    chiefComplaint: String,
    visitNumber: String
  },

  // Vital signs
  vitalSigns: {
    bloodPressure: {
      systolic: Number,
      diastolic: Number,
      unit: {
        type: String,
        default: 'mmHg'
      }
    },
    heartRate: {
      value: Number,
      unit: {
        type: String,
        default: 'bpm'
      }
    },
    temperature: {
      value: Number,
      unit: {
        type: String,
        default: '°C'
      }
    },
    respiratoryRate: {
      value: Number,
      unit: {
        type: String,
        default: 'breaths/min'
      }
    },
    oxygenSaturation: {
      value: Number,
      unit: {
        type: String,
        default: '%'
      }
    },
    weight: {
      value: Number,
      unit: {
        type: String,
        default: 'kg'
      }
    },
    height: {
      value: Number,
      unit: {
        type: String,
        default: 'cm'
      }
    },
    bmi: Number
  },

  // Physical examination
  physicalExamination: {
    generalAppearance: String,
    cardiovascular: {
      heartSounds: String,
      murmurs: String,
      peripheralPulses: String,
      notes: String
    },
    respiratory: {
      breathSounds: String,
      chestExpansion: String,
      notes: String
    },
    gastrointestinal: {
      abdomen: String,
      bowelSounds: String,
      liver: String,
      spleen: String,
      notes: String
    },
    neurological: {
      consciousness: String,
      cranialNerves: String,
      motor: String,
      sensory: String,
      reflexes: String,
      notes: String
    },
    musculoskeletal: {
      joints: String,
      muscleStrength: String,
      rangeOfMotion: String,
      notes: String
    },
    dermatological: {
      skinCondition: String,
      rashes: String,
      lesions: String,
      notes: String
    }
  },

  // Assessment and diagnosis
  assessment: {
    primaryDiagnosis: String,
    secondaryDiagnoses: [String],
    differentialDiagnoses: [String],
    icd10Codes: [String],
    severity: {
      type: String,
      enum: ['mild', 'moderate', 'severe', 'critical']
    },
    prognosis: String
  },

  // Treatment plan
  treatment: {
    medications: [{
      name: String,
      dosage: String,
      frequency: String,
      duration: String,
      instructions: String,
      prescribedBy: String
    }],
    procedures: [{
      name: String,
      date: Date,
      performedBy: String,
      notes: String
    }],
    referrals: [{
      department: String,
      doctor: String,
      reason: String,
      urgency: {
        type: String,
        enum: ['routine', 'urgent', 'emergency']
      }
    }],
    followUp: {
      required: Boolean,
      date: Date,
      instructions: String,
      doctor: String
    }
  },

  // Laboratory results
  laboratoryResults: [{
    testName: String,
    testDate: Date,
    results: mongoose.Schema.Types.Mixed,
    normalRange: String,
    status: {
      type: String,
      enum: ['normal', 'abnormal', 'critical', 'pending']
    },
    notes: String,
    labTechnician: String
  }],

  // Imaging results
  imagingResults: [{
    studyType: String,
    studyDate: Date,
    findings: String,
    impression: String,
    radiologist: String,
    images: [String], // URLs to image files
    notes: String
  }],

  // Nursing notes
  nursingNotes: [{
    date: Date,
    nurse: String,
    note: String,
    vitalSigns: mongoose.Schema.Types.Mixed
  }],

  // Discharge information
  discharge: {
    dischargeDate: Date,
    dischargeType: {
      type: String,
      enum: ['home', 'transfer', 'ama', 'deceased']
    },
    condition: {
      type: String,
      enum: ['improved', 'stable', 'critical', 'deceased']
    },
    instructions: String,
    medications: [String],
    followUpAppointment: Date,
    dischargeSummary: String
  },

  // Additional notes
  notes: String,
  attachments: [{
    filename: String,
    fileType: String,
    filePath: String,
    uploadedBy: String,
    uploadDate: Date
  }],

  // Status and access
  status: {
    type: String,
    enum: ['draft', 'active', 'completed', 'archived'],
    default: 'active'
  },
  isEmergency: {
    type: Boolean,
    default: false
  },
  confidentiality: {
    level: {
      type: String,
      enum: ['public', 'confidential', 'restricted'],
      default: 'confidential'
    },
    accessList: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      accessLevel: {
        type: String,
        enum: ['read', 'write', 'admin']
      }
    }]
  }
}, {
  timestamps: true
});

// Indexes for better performance
medicalRecordSchema.index({ patient: 1, visitInfo.visitDate: -1 });
medicalRecordSchema.index({ hospital: 1 });
medicalRecordSchema.index({ createdBy: 1 });
medicalRecordSchema.index({ 'visitInfo.visitDate': -1 });
medicalRecordSchema.index({ status: 1 });
medicalRecordSchema.index({ isEmergency: 1 });

// Virtual for visit summary
medicalRecordSchema.virtual('visitSummary').get(function() {
  return {
    patient: this.patient,
    hospital: this.hospital,
    visitDate: this.visitInfo.visitDate,
    chiefComplaint: this.visitInfo.chiefComplaint,
    primaryDiagnosis: this.assessment.primaryDiagnosis,
    status: this.status
  };
});

module.exports = mongoose.model('MedicalRecord', medicalRecordSchema);
