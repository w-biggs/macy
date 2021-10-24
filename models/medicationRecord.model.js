const mongoose = require('mongoose');
const { Schema } = mongoose;
const medicationRecordSchema = new Schema({
  date: {
    type: Date,
    required: true
  },
  taken: {
    type: Boolean
  }
});
module.exports = mongoose.model('MedicationRecord', medicationRecordSchema);
