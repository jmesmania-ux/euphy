const mongoose = require('mongoose');

const shopStatusSchema = new mongoose.Schema({
  isOpen: { type: Boolean, default: true }
});

module.exports = mongoose.model('ShopStatus', shopStatusSchema);
