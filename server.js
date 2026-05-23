require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const TelegramBot = require('node-telegram-bot-api');
const Product = require('./models/Product');
const Announcement = require('./models/Announcement');
const Order = require('./models/Order');
const Message = require('./models/Message');
const ShopStatus = require('./models/ShopStatus');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Database Connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(async () => {
  console.log('✅ Database connected');
  // Initialize shop status
  if (!(await ShopStatus.findOne())) await new ShopStatus({ isOpen: true }).save();
  // Insert default products if empty
  if (!(await Product.findOne())) {
    await Product.insertMany([
      // Signatures
      { id: 'U10', name: 'U10', description: 'Sobrang sarap na signature drink, perfect sa mainit na panahon!', price: 100, category: 'Signatures' },
      { id: 'U20', name: 'U20', description: 'Mas malaki at mas masarap na version ng ating classic favorite.', price: 150, category: 'Signatures' },
      { id: 'U30', name: 'U30', description: 'Premium blend, may dagdag na lasa na siguradong magugustuhan mo.', price: 200, category: 'Signatures' },
      { id: 'UHG', name: 'UHG', description: 'Heavy glass serving, puno ng lasa at quality ingredients.', price: 250, category: 'Signatures' },
      { id: 'U1G', name: 'U1G', description: 'One Gallon size! Angkop para sa pamilya o barkada bonding.', price: 450, category: 'Signatures' },
      // Flavored
      { id: 'LR', name: 'Lime Rush', description: 'Maasim-matamis na lasa ng dayap, nakakarefresh talaga!', price: 120, category: 'Flavored' },
      { id: 'BS', name: 'Blue Sapphire', description: 'Matamis at malamig na lasa, parang dagat na nasa baso mo.', price: 120, category: 'Flavored' },
      { id: 'PS', name: 'Pink Sakura', description: 'Malambot na lasa, matamis at maganda tignan, parang bulaklak.', price: 120, category: 'Flavored' },
      // The E
      { id: 'E1', name: 'The E 1', description: 'Unang level ng special blend, simple pero masarap.', price: 180, category: 'TheE' },
      { id: 'E2', name: 'The E 2', description: 'May dagdag na flavor, mas may character ang lasa.', price: 180, category: 'TheE' },
      { id: 'E3', name: 'The E 3', description: 'Mas matapang at mas mayaman na lasa para sa mga mahilig.', price: 200, category: 'TheE' },
      { id: 'E4', name: 'The E 4', description: 'Pinaka-espesyal, full flavor experience talaga ito!', price: 220, category: 'TheE' },
      // AddOns
      { id: 'STRAW', name: 'Extra Straw', description: 'Karagdagang straw kung kailangan mo pa.', price: 10, category: 'AddOns-Essentials' },
      { id: 'ICE', name: 'Extra Ice', description: 'Dagdag na yelo para manatiling malamig.', price: 15, category: 'AddOns-Essentials' },
      { id: 'NAPKIN', name: 'Napkin', description: 'Punasan mo na kasi baka tumapon pa!', price: 5, category: 'AddOns-Miscellaneous' },
      { id: 'BAG', name: 'Carry Bag', description: 'Matibay na bag para dala mo kahit saan.', price: 20, category: 'AddOns-Miscellaneous' },
      { id: 'POP1', name: 'Fruit Pop', description: 'Matamis na prutas na nakalagay sa stick, masarap pangdagdag.', price: 30, category: 'AddOns-Pops' },
      { id: 'POP2', name: 'Cream Pop', description: 'Malambot at creamy na pop, pampaganda ng lasa.', price: 35, category: 'AddOns-Pops' }
    ]);
  }
})
.catch(err => console.error('❌ DB Error:', err));

// --- TELEGRAM BOT SETUP (WEBHOOK) ---
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);
const ADMIN_ID = process.env.ADMIN_CHAT_ID;
const WEBHOOK_URL = process.env.WEBHOOK_URL;

bot.setWebHook(`${WEBHOOK_URL}/bot${process.env.TELEGRAM_BOT_TOKEN}`)
  .then(() => console.log(`✅ Webhook set to: ${WEBHOOK_URL}/bot${process.env.TELEGRAM_BOT_TOKEN}`))
  .catch(err => console.error('❌ Webhook error:', err));

app.post(`/bot${process.env.TELEGRAM_BOT_TOKEN}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// --- TYPING INDICATOR HELPER ---
async function sendWithTyping(chatId, text, options = {}) {
  try {
    await bot.sendChatAction(chatId, 'typing');
    await new Promise(resolve => setTimeout(resolve, 1000));
    return bot.sendMessage(chatId, text, options);
  } catch (err) {
    console.error('❌ Send error:', err.message);
  }
}

// --- API ROUTES ---

// Get all products grouped by category
app.get('/products', async (req, res) => {
  const all = await Product.find();
  const grouped = {
    Signatures: all.filter(p => p.category === 'Signatures'),
    Flavored: all.filter(p => p.category === 'Flavored'),
    TheE: all.filter(p => p.category === 'TheE'),
    AddOns: {
      Essentials: all.filter(p => p.category === 'AddOns-Essentials'),
      Miscellaneous: all.filter(p => p.category === 'AddOns-Miscellaneous'),
      Pops: all.filter(p => p.category === 'AddOns-Pops')
    }
  };
  res.json(grouped);
});

// Get active announcement
app.get('/announcement', async (req, res) => {
  const ann = await Announcement.findOne({ active: true });
  res.json(ann || { text: '', active: false });
});

// Shop status
app.get('/shop-status', async (req, res) => {
  const status = await ShopStatus.findOne();
  res.json({ isOpen: status.isOpen });
});

app.post('/toggle-shop', async (req, res) => {
  const status = await ShopStatus.findOne();
  status.isOpen = !status.isOpen;
  await status.save();
  res.json({ success: true, isOpen: status.isOpen });
  sendWithTyping(ADMIN_ID, `🔄 Shop is now ${status.isOpen ? 'OPEN ✅' : 'CLOSED ❌'}`);
});

// Submit order
app.post('/submit-order', async (req, res) => {
  try {
    const { telegramId, telegramName, telegramUsername, items, total } = req.body;
    const shopStatus = await ShopStatus.findOne();
    if (!shopStatus.isOpen) return res.json({ success: false, message: '❌ Pasensya na, CLOSED po muna kami.' });

    // Check if all items are available
    for (const item of items) {
      const prod = await Product.findOne({ id: item.id });
      if (!prod || !prod.available) return res.json({ success: false, message: `❌ "${item.name}" is currently unavailable!` });
    }

    const newOrder = new Order({ telegramId, telegramName, telegramUsername, items, totalAmount: total });
    await newOrder.save();

    const orderText = `📥 *Bagong Order Natanggap!*\n\n👤 Pangalan: ${telegramName}\n🆔 ID: ${telegramId}\n📛 Username: @${telegramUsername}\n🛒 Items: ${items.map(i => `${i.name} x${i.qty}`).join(', ')}\n💵 Total: ₱${total}\n\n✅ I-approve o ❌ I-deny?`;

    bot.sendMessage(ADMIN_ID, orderText, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '✅ Approve', callback_data: `approve_${newOrder._id}` }], [{ text: '❌ Deny', callback_data: `deny_${newOrder._id}` }]] }
    });

    res.json({ success: true, message: 'Order sent sa admin!' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Send message to admin
app.post('/send-message', async (req, res) => {
  try {
    const { senderId, senderName, text } = req.body;
    const msg = new Message({ senderId, senderName, receiverId: ADMIN_ID, text, direction: 'to_admin' });
    await msg.save();
    sendWithTyping(ADMIN_ID, `💬 *Message mula sa Customer:*\n👤 ${senderName}\n🆔 ${senderId}\n📝 ${text}`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// --- ADMIN COMMANDS ---

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  if (chatId == ADMIN_ID) {
    bot.sendMessage(ADMIN_ID, `👋 Hello Admin! Control Panel:\n\n🔄 /toggleopen - Open/Close Shop\n📢 /announce TEXT - Post alert (e.g. /announce SALE! 20% OFF)\n❌ /removeprod ID - Remove product\n🔄 /toggleavail ID - Mark Available/Unavailable\n➕ /addprod | ID | Name | Desc | Price | Category\n\nCategories: Signatures, Flavored, TheE, AddOns-Essentials, AddOns-Miscellaneous, AddOns-Pops\n\n💬 /reply ID MESSAGE - Reply to customer`, {
      reply_markup: { keyboard: [[{ text: '🔄 Toggle Open/Close' }]], resize_keyboard: true }
    });
  } else {
    sendWithTyping(chatId, `👋 Hi! Welcome sa aming shop. Magbukas lang ng Mini App para umorder o mag-message. 😊`);
  }
});

bot.onText(/🔄 Toggle Open\/Close/, async (msg) => {
  if (msg.chat.id != ADMIN_ID) return;
  const status = await ShopStatus.findOne();
  status.isOpen = !status.isOpen;
  await status.save();
  sendWithTyping(ADMIN_ID, `🔄 Shop is now ${status.isOpen ? 'OPEN ✅' : 'CLOSED ❌'}`);
});

// Announcement command
bot.onText(/\/announce (.+)/, async (msg, match) => {
  if (msg.chat.id != ADMIN_ID) return;
  await Announcement.updateMany({}, { active: false });
  await new Announcement({ text: match[1], active: true }).save();
  sendWithTyping(ADMIN_ID, `📢 Announcement posted: ${match[1]}`);
});

// Remove product
bot.onText(/\/removeprod (.+)/, async (msg, match) => {
  if (msg.chat.id != ADMIN_ID) return;
  await Product.deleteOne({ id: match[1] });
  sendWithTyping(ADMIN_ID, `❌ Product ${match[1]} removed.`);
});

// Toggle availability
bot.onText(/\/toggleavail (.+)/, async (msg, match) => {
  if (msg.chat.id != ADMIN_ID) return;
  const prod = await Product.findOne({ id: match[1] });
  if (!prod) return sendWithTyping(ADMIN_ID, '❌ Product not found');
  prod.available = !prod.available;
  await prod.save();
  sendWithTyping(ADMIN_ID, `🔄 ${prod.name} is now ${prod.available ? 'AVAILABLE ✅' : 'UNAVAILABLE ❌'}`);
});

// Add product
bot.onText(/\/addprod \| (.+) \| (.+) \| (.+) \| (.+) \| (.+)/, async (msg, match) => {
  if (msg.chat.id != ADMIN_ID) return;
  const [id, name, desc, price, cat] = match.slice(1);
  await new Product({ id, name, description: desc, price: Number(price), category: cat }).save();
  sendWithTyping(ADMIN_ID, `✅ Product added: ${name}`);
});

// Reply to customer
bot.onText(/\/reply (\d+) (.+)/, async (msg, match) => {
  if (msg.chat.id != ADMIN_ID) return;
  const customerId = match[1], text = match[2];
  await new Message({ senderId: ADMIN_ID, senderName: 'Admin', receiverId: customerId, text, direction: 'to_customer' }).save();
  sendWithTyping(customerId, `💬 *Reply mula sa Admin:*\n${text}`);
  sendWithTyping(ADMIN_ID, '✅ Reply sent!');
});

// Order approval/denial
bot.on('callback_query', async (query) => {
  const data = query.data;
  const orderId = data.split('_')[1];
  const order = await Order.findById(orderId);
  if (!order) return bot.answerCallbackQuery(query.id, { text: 'Order not found!' });

  if (data.startsWith('approve')) {
    order.status = 'approved'; await order.save();
    sendWithTyping(order.telegramId, `✅ *Approved na ang order mo!*\n\nSalamat sa pag-order! 🥰\n1. Gamitin ang QR code para sa bayad.\n2. Pindutin ang link para sa Lalamove.`, { parse_mode: 'Markdown' });
    bot.sendPhoto(order.telegramId, process.env.QR_CODE_URL);
    sendWithTyping(order.telegramId, `📦 *Lalamove Booking:*\n${process.env.LALAMOVE_LINK}`);
    bot.answerCallbackQuery(query.id, { text: 'Approved ✅' });
    bot.editMessageText('✅ Order approved.', { chat_id: query.message.chat.id, message_id: query.message.message_id });
  } else if (data.startsWith('deny')) {
    order.status = 'denied'; await order.save();
    sendWithTyping(order.telegramId, `❌ *Pasensya na, hindi natuloy ang order mo.*\nMay naging problema po — pwede kang umulit o magtanong. 🙏`, { parse_mode: 'Markdown' });
    bot.answerCallbackQuery(query.id, { text: 'Denied ❌' });
    bot.editMessageText('❌ Order denied.', { chat_id: query.message.chat.id, message_id: query.message.message_id });
  }
});

// --- START SERVER ---
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
