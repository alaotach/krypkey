const mongoose = require('mongoose');

const pendingPasswordSchema = new mongoose.Schema({
  title: { type: String, required: true },
  password: { type: String, required: true },
  saved: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  category: { type: String, default: 'login' },
});

// Update the sessionSchema to handle custom expiry
const sessionSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'KrypKey',
    required: false
  },
  username: {
    type: String,
    required: false
  },
  deviceName: {
    type: String,
    default: 'Unknown Device'
  },
  token: {
    type: String
  },
  authenticated: {
    type: Boolean,
    default: false
  },
  pendingPasswords: [pendingPasswordSchema],
  accessPin: {
    type: String,
    required: false
  },
  useBiometrics: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    default: function() {
      // Default to 2 hours from creation if not specified
      return new Date(Date.now() + 7200000);
    }
    // Remove the "expires: 0" field from here - it's creating a duplicate index
  }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Add privateKey as a virtual (not stored in DB)
sessionSchema.virtual('privateKey');

// Keep only one TTL index definition
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Session', sessionSchema);