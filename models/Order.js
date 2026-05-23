const mongoose = require('mongoose');
const orderSchema = new mongoose.Schema({
  telegramId: String,
  telegramName: String,
  telegramUsername: String,
  items: Array,
  totalAmount: Number,
  status: { type: String, default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('Order', orderSchema);
