// FUNCTIONAL: Mongoose model for application users (admin/editor roles)
// STRATEGIC: Enables credential-based admin login and RBAC for protected pages/APIs

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, index: true },
  role: { type: String, enum: ['superadmin', 'admin', 'editor'], default: 'admin' },
  passwordHash: { type: String, required: true },
  salt: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

function registerUserModel(connection) {
  return connection.models.User || connection.model('User', userSchema);
}

const User = mongoose.models.User || mongoose.model('User', userSchema);

module.exports = User;
module.exports.registerUserModel = registerUserModel;
