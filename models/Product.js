const mongoose = require('mongoose');
const productSchema = new mongoose.Schema({
  id: String,
  name: String,
  description: String,
  price: Number,
  category: String,
  available: { type: Boolean, default: true }
});
module.exports = mongoose.model('Product', productSchema);
