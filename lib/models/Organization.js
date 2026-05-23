const mongoose = require('mongoose');

const organizationSchema = new mongoose.Schema({
  uuid: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  description: { type: String, default: '' },
  databaseName: { type: String, index: true },
  settings: { type: mongoose.Schema.Types.Mixed, default: {} },
  isActive: { type: Boolean, default: true },
}, {
  timestamps: true,
});

function registerOrganizationModel(connection) {
  return (
    connection.models.Organization ||
    connection.model('Organization', organizationSchema)
  );
}

// Default export: legacy scripts using mongoose.connect on master URI
const Organization =
  mongoose.models.Organization || mongoose.model('Organization', organizationSchema);

module.exports = Organization;
module.exports.organizationSchema = organizationSchema;
module.exports.registerOrganizationModel = registerOrganizationModel;
