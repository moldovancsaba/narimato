const mongoose = require('mongoose');

const organizationSchema = new mongoose.Schema({
  uuid: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  description: { type: String, default: '' },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true
});

module.exports = mongoose.models.Organization || mongoose.model('Organization', organizationSchema);
