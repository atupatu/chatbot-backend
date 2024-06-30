const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String },
  verified: { type: Boolean, default: false },
  verificationCode: { type: String }, // New field for verification code
});

module.exports = mongoose.model('User', UserSchema);
