const mongoose = require('mongoose');

// Base password schema with common fields
const passwordSchema = new mongoose.Schema({
  title: { type: String, required: true },
  category: { type: String, required: false }, // login, social, card, voucher, giftcard, address, other
  notes: { type: String },
  // Login specific fields
  username: { type: String },
  password: { type: String },
  website: { type: String },
  // Social media specific fields
  platform: { type: String },
  profileUrl: { type: String },
  // Card specific fields
  cardType: { type: String },
  cardNumber: { type: String },
  cardholderName: { type: String },
  expiryDate: { type: Date },
  cvv: { type: String },
  // Voucher specific fields
  store: { type: String },
  code: { type: String },
  value: { type: String },
  // Gift card specific fields
  pin: { type: String },
  balance: { type: String },
  // Address specific fields
  fullName: { type: String },
  streetAddress: { type: String },
  city: { type: String },
  state: { type: String },
  zipCode: { type: String },
  country: { type: String },
  phoneNumber: { type: String },
  email: { type: String },
  // Other category - custom fields
  customFields: [{ 
    label: { type: String },
    value: { type: String },
    isSecret: { type: Boolean, default: false }
  }],
  // Security and metadata
  favorite: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true }, // Add login password field
  mnemonic: { type: String, required: true },
  privateKey: { type: String, default: null },
  passwords: [passwordSchema], // Stored encrypted passwords
  sessions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session'
  }],
 
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

module.exports = mongoose.model('KrypKey', userSchema);