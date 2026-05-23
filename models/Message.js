const mongoose = require('mongoose');
const messageSchema = new mongoose.Schema({
  senderId: String,
  senderName: String,
  receiverId: String,
  text: String,
  direction: String, // 'customer_to_admin' | 'admin_to_customer'
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('Message', messageSchema);
