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
// 📱 API ROUTES (MINI APP ONLY)
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

app.post('/toggle-shop', async (req, res) => {
  const s = await ShopStatus.findOne(); s.isOpen = !s.isOpen; await s.save();
  res.json({ success: true, isOpen: s.isOpen });
  sendWithTyping(ADMIN_ID, `🔄 Shop: ${s.isOpen ? 'OPEN ✅' : 'CLOSED ❌'}`);
});

app.post('/submit-order', async (req, res) => {
  try {
    const { telegramId, telegramName, telegramUsername, items, total } = req.body;
    if (!(await ShopStatus.findOne()).isOpen) return res.json({ success: false, message: '❌ CLOSED po muna.' });

    // Check availability
    for (let i of items) {
      const p = await Product.findOne({ id: i.id });
      if (!p || !p.available) return res.json({ success: false, message: `❌ "${i.name}" is unavailable` });
    }

    const order = new Order({ telegramId, telegramName, telegramUsername, items, totalAmount: total });
    await order.save();

    const text = `📥 *NEW ORDER*\n\n👤 ${telegramName}\n🆔 ${telegramId}\n📛 @${telegramUsername}\n🛒 ${items.map(i => `${i.name} x${i.qty}`).join(', ')}\n💵 ₱${total}\n\nApprove?`;
    bot.sendMessage(ADMIN_ID, text, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[{ text: '✅ Approve', callback_data: `appr_${order._id}` }], [{ text: '❌ Deny', callback_data: `deny_${order._id}` }]]
      }
    });

    res.json({ success: true, message: 'Sent to Admin!' });
  } catch (e) { res.status(500).json({ error: e.message }) }
});

// --------------------------
// 🤖 BOT COMMANDS & CHAT
// --------------------------

// /start — INLINE BUTTONS: Order Now + Message Admin
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  if (chatId == ADMIN_ID) {
    sendWithTyping(ADMIN_ID, `👋 ADMIN PANEL\n\n🔧 /toggleopen — Open/Close\n📢 /announce TEXT — Alert\n➕ /addprod | ID | NAME | DESC | PRICE | CAT\n❌ /removeprod ID\n🔄 /toggleavail ID\n\n💡 To reply: just REPLY to any customer message — bot auto-sends back`, {
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

// Open Chat — just tell them to type
bot.on('callback_query', (query) => {
  if (query.data === 'openchat') {
    sendWithTyping(query.message.chat.id, `💬 *Chat with Admin*\nJust type your message and send it — I’ll get it and reply!`, { parse_mode: 'Markdown' });
    bot.answerCallbackQuery(query.id);
  }

  // Order Approve/Deny
  else if (query.data.startsWith('appr_') || query.data.startsWith('deny_')) {
    const chatId = query.message.chat.id;
    const orderId = query.data.split('_')[1];
    (async () => {
      const order = await Order.findById(orderId);
      if (!order) return bot.answerCallbackQuery(query.id, { text: 'Not found' });

      if (query.data.startsWith('appr_')) {
        order.status = 'approved'; await order.save();
        sendWithTyping(order.telegramId, `✅ *ORDER APPROVED!*\n\nSalamat!\n1. Pay via QR:\n${process.env.QR_CODE_URL}\n2. Book delivery:\n${process.env.LALAMOVE_LINK}`, { parse_mode: 'Markdown' });
        bot.editMessageText('✅ Approved', { chat_id: chatId, message_id: query.message.message_id });
      } else {
        order.status = 'denied'; await order.save();
        sendWithTyping(order.telegramId, `❌ *Order denied*\nPasensya na po.`, { parse_mode: 'Markdown' });
        bot.editMessageText('❌ Denied', { chat_id: chatId, message_id: query.message.message_id });
      }
      bot.answerCallbackQuery(query.id);
    })();
  }
});

// 📨 MAIN CHAT LOGIC — 100% INSIDE TELEGRAM
bot.on('message', async (msg) => {
  // Ignore commands
  if (msg.text?.startsWith('/')) return;

  // 👤 CUSTOMER MESSAGE → send to Admin
  if (msg.chat.id != ADMIN_ID) {
    // Save message
    await new Message({
      senderId: msg.chat.id,
      senderName: msg.from.first_name || 'Customer',
      receiverId: ADMIN_ID,
      text: msg.text || '[Non-text message]',
      direction: 'customer_to_admin'
    }).save();

    // Send to Admin with info
    sendWithTyping(ADMIN_ID, `💬 *MESSAGE FROM CUSTOMER*\n\n👤 ${msg.from.first_name || 'Unknown'}\n🆔 ${msg.chat.id}\n📛 @${msg.from.username || 'no username'}\n📝 ${msg.text || '[sent a photo/file]'}\n\n*Just REPLY to this message to answer*`, { parse_mode: 'Markdown' });
    return;
  }

  // 🛡️ ADMIN REPLY → send back to correct customer
  if (msg.chat.id == ADMIN_ID && msg.reply_to_message) {
    const originalText = msg.reply_to_message.text || '';
    const match = originalText.match(/🆔 (\d+)/); // extract customer ID from original message
    if (match) {
      const targetId = match[1];
      // Save reply
      await new Message({
        senderId: ADMIN_ID,
        senderName: 'Admin',
        receiverId: targetId,
        text: msg.text,
        direction: 'admin_to_customer'
      }).save();
      // Send to customer
      sendWithTyping(targetId, `💬 *Admin:* ${msg.text}`, { parse_mode: 'Markdown' });
      sendWithTyping(ADMIN_ID, `✅ Reply sent to customer ${targetId}`);
    }
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
  await Announcement.updateMany({}, { active: false });
  await new Announcement({ text: m[1], active: true }).save();
  sendWithTyping(ADMIN_ID, `📢 Announced: ${m[1]}`);
});

bot.onText(/\/addprod \| (.+) \| (.+) \| (.+) \| (.+) \| (.+)/, async (msg, m) => {
  if (msg.chat.id != ADMIN_ID) return;
  await new Product({ id: m[1], name: m[2], description: m[3], price: Number(m[4]), category: m[5] }).save();
  sendWithTyping(ADMIN_ID, `✅ Added: ${m[2]}`);
});

bot.onText(/\/removeprod (.+)/, async (msg, m) => {
  if (msg.chat.id != ADMIN_ID) return;
  await Product.deleteOne({ id: m[1] });
  sendWithTyping(ADMIN_ID, `❌ Removed: ${m[1]}`);
});

bot.onText(/\/toggleavail (.+)/, async (msg, m) => {
  if (msg.chat.id != ADMIN_ID) return;
  const p = await Product.findOne({ id: m[1] });
  if (!p) return sendWithTyping(ADMIN_ID, '❌ Not found');
  p.available = !p.available; await p.save();
  sendWithTyping(ADMIN_ID, `🔄 ${p.name}: ${p.available ? 'AVAIL ✅' : 'UNAVAIL ❌'}`);
});

// Start Server
app.listen(PORT, () => console.log(`🚀 Running on port ${PORT}`));
