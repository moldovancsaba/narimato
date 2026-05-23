const mongoose = require('mongoose');

const playSessionIndexSchema = new mongoose.Schema(
  {
    playId: { type: String, required: true, unique: true, index: true },
    organizationId: { type: String, required: true, index: true },
    mode: { type: String, default: '' },
  },
  { timestamps: true }
);

function registerPlaySessionIndexModel(connection) {
  return (
    connection.models.PlaySessionIndex ||
    connection.model('PlaySessionIndex', playSessionIndexSchema)
  );
}

module.exports = {
  playSessionIndexSchema,
  registerPlaySessionIndexModel,
};
