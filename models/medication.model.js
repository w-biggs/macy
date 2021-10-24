const mongoose = require('mongoose');
const { Schema } = mongoose;
const medicationSchema = new Schema({
  name: {
    type: String,
    required: true
  },
  times: [{
    type: Schema.Types.ObjectId,
    ref: 'MedicationTime'
  }]
});
module.exports = mongoose.model('Medication', medicationSchema);
