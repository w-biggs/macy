const mongoose = require('mongoose');
const { Schema } = mongoose;
const userSchema = new Schema({
  googleId: {
    type: Number,
    required: true,
    unique: true,
  },
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  profiles: [{
    type: Schema.Types.ObjectId,
    ref: 'Profile'
  }]
});
module.exports = mongoose.model('User', userSchema);
