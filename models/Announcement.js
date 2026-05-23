const mongoose = require('mongoose');
const announcementSchema = new mongoose.Schema({
  text: String,
  imageUrl: String, // 🆕 Added for images
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('Announcement', announcementSchema);
