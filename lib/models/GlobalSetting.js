const mongoose = require('mongoose');

const globalSettingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    value: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

function registerGlobalSettingModel(connection) {
  return (
    connection.models.GlobalSetting ||
    connection.model('GlobalSetting', globalSettingSchema)
  );
}

module.exports = {
  globalSettingSchema,
  registerGlobalSettingModel,
};
