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
app.use(express.static('public'));          // Customer App
app.use('/admin', express.static('admin-dashboard')); // 🆕 Admin Dashboard Website

// Database
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(async () => {
  console.log('✅ DB Connected');
  if (!(await ShopStatus.findOne())) await new ShopStatus({ isOpen: true }).save();
  if (!(await Product.findOne())) {
    await Product.insertMany([
      { id: 'U10', name: 'U10', description: 'Sobrang sarap na signature drink!', price: 100, category: 'Signatures' },
      { id: 'U20', name: 'U20', description: 'Mas malaki at mas masarap.', price: 150, category: 'Signatures' },
      { id: 'U30', name: 'U30', description: 'Premium blend.', price: 200, category: 'Signatures' },
      { id: 'UHG', name: 'UHG', description: 'Heavy glass serving.', price: 250, category: 'Signatures' },
      { id: 'U1G', name: 'U1G', description: 'One Gallon size.', price: 450, category: 'Signatures' },
      { id: 'LR', name: 'Lime Rush', description: 'Maasim-matamis.', price: 120, category: 'Flavored' },
      { id: 'BS', name: 'Blue Sapphire', description: 'Matamis at malamig.', price: 120, category: 'Flavored' },
      { id: 'PS', name: 'Pink Sakura', description: 'Malambot na lasa.', price: 120, category: 'Flavored' },
      { id: 'E1', name: 'The E 1', description: 'Special blend.', price: 180, category: 'TheE' },
      { id: 'E2', name: 'The E 2', description: 'Dagdag flavor.', price: 180, category: 'TheE' },
      { id: 'E3', name: 'The E 3', description: 'Mas matapang.', price: 200, category: 'TheE' },
      { id: 'E4', name: 'The E 4', description: 'Pinaka-espesyal.', price: 220, category: 'TheE' },
      { id: 'STRAW', name: 'Extra Straw', description: 'Karagdagang straw.', price: 10, category: 'AddOns-Essentials' },
      { id: 'ICE', name: 'Extra Ice', description: 'Dagdag yelo.', price: 15, category: 'AddOns-Essentials' },
      { id: 'NAPKIN', name: 'Napkin', description: 'Pangpunas.', price: 5, category: 'AddOns-Miscellaneous' },
      { id: 'BAG', name: 'Carry Bag', description: 'Matibay na bag.', price: 20, category: 'AddOns-Miscellaneous' },
      { id: 'POP1', name: 'Fruit Pop', description: 'Matamis na prutas.', price: 30, category: 'AddOns-Pops' },
      { id: 'POP2', name: 'Cream Pop', description: 'Malambot at creamy.', price: 35, category: 'AddOns-Pops' }
    ]);
  }
})
.catch(err => console.error('❌ DB Error:', err));

// Bot Webhook
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);
const ADMIN_ID = process.env.ADMIN_CHAT_ID;
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const ADMIN_PASS = process.env.ADMIN_PASSWORD;

bot.setWebHook(`${WEBHOOK_URL}/bot${process.env.TELEGRAM_BOT_TOKEN}`)
  .then(() => console.log(`✅ Webhook: ${WEBHOOK_URL}/bot${process.env.TELEGRAM_BOT_TOKEN}`))
  .catch(err => console.error('❌ Webhook Error:', err));

app.post(`/bot${process.env.TELEGRAM_BOT_TOKEN}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// Typing Helper
async function sendWithTyping(chatId, text, options = {}) {
  try {
    await bot.sendChatAction(chatId, 'typing');
    await new Promise(r => setTimeout(r, 800));
    return bot.sendMessage(chatId, text, options);
  } catch (e) { console.error('Send error:', e) }
}

// --------------------------
// 🔐 ADMIN AUTH MIDDLEWARE
// --------------------------
const adminAuth = (req, res, next) => {
  const pass = req.headers['x-admin-password'];
  if (pass !== ADMIN_PASS) return res.status(401).json({ error: 'Unauthorized' });
  next();
};

// --------------------------
// 📱 CUSTOMER API ROUTES
// --------------------------
app.get('/products', async (req, res) => {
  const all = await Product.find();
  res.json({
    Signatures: all.filter(p => p.category === 'Signatures'),
    Flavored: all.filter(p => p.category === 'Flavored'),
    TheE: all.filter(p => p.category === 'TheE'),
    AddOns: {
      Essentials: all.filter(p => p.category === 'AddOns-Essentials'),
      Miscellaneous: all.filter(p => p.category === 'AddOns-Miscellaneous'),
      Pops: all.filter(p => p.category === 'AddOns-Pops')
    }
  });
});

app.get('/announcement', async (req, res) => {
  res.json(await Announcement.findOne({ active: true }) || { text: '', active: false });
});

app.get('/shop-status', async (req, res) => {
  res.json({ isOpen: (await ShopStatus.findOne()).isOpen });
});

app.post('/submit-order', async (req, res) => {
  try {
    const { telegramId, telegramName, telegramUsername, items, total } = req.body;
    if (!(await ShopStatus.findOne()).isOpen) return res.json({ success: false, message: '❌ CLOSED po muna.' });

    for (let i of items) {
      const p = await Product.findOne({ id: i.id });
      if (!p || !p.available) return res.json({ success: false, message: `❌ "${i.name}" is unavailable` });
    }

    const order = new Order({ telegramId, telegramName, telegramUsername, items, totalAmount: total });
    await order.save();

    const text = `📥 *NEW ORDER*\n\n👤 ${telegramName}\n🆔 ${telegramId}\n📛 @${telegramUsername}\n🛒 ${items.map(i => `${i.name} x${i.qty}`).join(', ')}\n💵 ₱${total}\n\nCheck dashboard: ${WEBHOOK_URL}/admin`;
    bot.sendMessage(ADMIN_ID, text, { parse_mode: 'Markdown' });

    res.json({ success: true, message: 'Sent to Admin!' });
  } catch (e) { res.status(500).json({ error: e.message }) }
});

// --------------------------
// 🛡️ ADMIN DASHBOARD API ROUTES 🆕
// --------------------------

// -- Shop Status --
app.get('/api/admin/shop-status', adminAuth, async (req, res) => {
  res.json(await ShopStatus.findOne());
});
app.post('/api/admin/toggle-shop', adminAuth, async (req, res) => {
  const s = await ShopStatus.findOne(); s.isOpen = !s.isOpen; await s.save();
  res.json({ success: true, isOpen: s.isOpen });
  sendWithTyping(ADMIN_ID, `🔄 Shop: ${s.isOpen ? 'OPEN ✅' : 'CLOSED ❌'}`);
});

// -- Announcements --
app.get('/api/admin/announcements', adminAuth, async (req, res) => {
  res.json(await Announcement.find().sort({ createdAt: -1 }));
});
app.post('/api/admin/post-update', adminAuth, async (req, res) => {
  const { text } = req.body;
  await Announcement.updateMany({}, { active: false });
  const a = new Announcement({ text, active: true }); await a.save();
  res.json({ success: true });
});

// -- Products --
app.get('/api/admin/products', adminAuth, async (req, res) => {
  res.json(await Product.find());
});
app.post('/api/admin/add-product', adminAuth, async (req, res) => {
  await new Product(req.body).save(); res.json({ success: true });
});
app.post('/api/admin/remove-product', adminAuth, async (req, res) => {
  await Product.deleteOne({ id: req.body.id }); res.json({ success: true });
});
app.post('/api/admin/toggle-product', adminAuth, async (req, res) => {
  const p = await Product.findOne({ id: req.body.id }); p.available = !p.available; await p.save(); res.json({ success: true });
});

// -- Orders --
app.get('/api/admin/orders', adminAuth, async (req, res) => {
  res.json(await Order.find().sort({ createdAt: -1 }));
});
app.post('/api/admin/update-order', adminAuth, async (req, res) => {
  const { orderId, status } = req.body;
  const o = await Order.findById(orderId); o.status = status; await o.save();

  if (status === 'approved') {
    sendWithTyping(o.telegramId, `✅ *ORDER APPROVED!*\n\nSalamat!\n1. Pay via QR:\n${process.env.QR_CODE_URL}\n2. Book delivery:\n${process.env.LALAMOVE_LINK}`, { parse_mode: 'Markdown' });
  }
  if (status === 'denied') {
    sendWithTyping(o.telegramId, `❌ *Order denied*\nPasensya na po.`, { parse_mode: 'Markdown' });
  }
  res.json({ success: true });
});

// -- Messages / Chat --
app.get('/api/admin/messages/:customerId', adminAuth, async (req, res) => {
  res.json(await Message.find({ $or: [{senderId: req.params.customerId}, {receiverId: req.params.customerId}] }).sort({ createdAt: 1 }));
});
app.post('/api/admin/send-chat', adminAuth, async (req, res) => {
  const { customerId, text } = req.body;
  await new Message({ senderId: ADMIN_ID, senderName: 'Admin', receiverId: customerId, text, direction: 'admin_to_customer' }).save();
  sendWithTyping(customerId, `💬 *Admin:* ${text}`, { parse_mode: 'Markdown' });
  res.json({ success: true });
});

// --------------------------
// 🤖 BOT COMMANDS & CHAT
// --------------------------
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  if (chatId == ADMIN_ID) {
    sendWithTyping(ADMIN_ID, `👋 ADMIN PANEL\n\n🔗 Dashboard: ${WEBHOOK_URL}/admin\n\n🔧 /toggleopen — Open/Close\n📢 /announce TEXT — Alert\n➕ /addprod | ID | NAME | DESC | PRICE | CAT\n❌ /removeprod ID\n🔄 /toggleavail ID`, {
      reply_markup: { remove_keyboard: true }
    });
  } else {
    sendWithTyping(chatId, `👋 Welcome! Choose below:`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '📝 Order Now', web_app: { url: WEBHOOK_URL } }],
          [{ text: '💬 Message Admin', callback_data: 'openchat' }]
        ]
      }
    });
  }
});

bot.on('callback_query', (query) => {
  if (query.data === 'openchat') {
    sendWithTyping(query.message.chat.id, `💬 *Chat with Admin*\nJust type your message and send it — I’ll get it and reply!`, { parse_mode: 'Markdown' });
    bot.answerCallbackQuery(query.id);
  }
});

bot.on('message', async (msg) => {
  if (msg.text?.startsWith('/')) return;

  // Customer → Admin
  if (msg.chat.id != ADMIN_ID) {
    await new Message({
      senderId: msg.chat.id,
      senderName: msg.from.first_name || 'Customer',
      receiverId: ADMIN_ID,
      text: msg.text || '[Non-text message]',
      direction: 'customer_to_admin'
    }).save();
    sendWithTyping(ADMIN_ID, `💬 *NEW MESSAGE*\n👤 ${msg.from.first_name}\n🆔 ${msg.chat.id}\n📝 ${msg.text}\n\nOpen dashboard to reply: ${WEBHOOK_URL}/admin`, { parse_mode: 'Markdown' });
    return;
  }
});

// --- Admin Commands ---
bot.onText(/\/toggleopen/, async (msg) => {
  if (msg.chat.id != ADMIN_ID) return;
  const s = await ShopStatus.findOne(); s.isOpen = !s.isOpen; await s.save();
  sendWithTyping(ADMIN_ID, `🔄 Shop: ${s.isOpen ? 'OPEN ✅' : 'CLOSED ❌'}`);
});
bot.onText(/\/announce (.+)/, async (msg, m) => {
  if (msg.chat.id != ADMIN_ID) return;
  await Announcement.updateMany({}, { active: false }); await new Announcement({ text: m[1], active: true }).save();
  sendWithTyping(ADMIN_ID, `📢 Announced: ${m[1]}`);
});
bot.onText(/\/addprod \| (.+) \| (.+) \| (.+) \| (.+) \| (.+)/, async (msg, m) => {
  if (msg.chat.id != ADMIN_ID) return; await new Product({ id: m[1], name: m[2], description: m[3], price: Number(m[4]), category: m[5] }).save(); sendWithTyping(ADMIN_ID, `✅ Added: ${m[2]}`);
});
bot.onText(/\/removeprod (.+)/, async (msg, m) => {
  if (msg.chat.id != ADMIN_ID) return; await Product.deleteOne({ id: m[1] }); sendWithTyping(ADMIN_ID, `❌ Removed: ${m[1]}`);
});
bot.onText(/\/toggleavail (.+)/, async (msg, m) => {
  if (msg.chat.id != ADMIN_ID) return; const p = await Product.findOne({ id: m[1] }); p.available = !p.available; await p.save(); sendWithTyping(ADMIN_ID, `🔄 ${p.name}: ${p.available ? 'AVAIL ✅' : 'UNAVAIL ❌'}`);
});

// Start Server
app.listen(PORT, () => console.log(`🚀 Running on port ${PORT}`));
