const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
  text: String,
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Announcement', announcementSchema);
