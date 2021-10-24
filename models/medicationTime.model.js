const mongoose = require('mongoose');
const { Schema } = mongoose;
const medicationTimeSchema = new Schema({
  time: {
    type: Number,
    required: true
  },
  records: [{
    type: Schema.Types.ObjectId,
    ref: 'MedicationRecord'
  }],
  lastNotification: {
    type: Date
  }
});
module.exports = mongoose.model('MedicationTime', medicationTimeSchema);
