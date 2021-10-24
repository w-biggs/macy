const mongoose = require('mongoose');
const { Schema } = mongoose;
const profileSchema = new Schema({
  name: {
    type: String,
    required: true
  },
  medications: [{
    type: Schema.Types.ObjectId,
    ref: 'Medication'
  }],
  streak: {
    type: Number,
    default: 0
  },
  streakLastUpdate: {
    type: Date,
    default: Date.now
  },
  wantsNotifications: {
    type: Boolean,
    default: false
  },
  notificationUserId: {
    type: String
  }
});
module.exports = mongoose.model('Profile', profileSchema);
